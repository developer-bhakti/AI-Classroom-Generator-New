import { supabase } from "./supabaseClient";
import { generateBookIndex, describeGeminiError, isGeminiError, GeminiResponseError } from "./geminiService";
import { openPdf, readBytes, bytesToBase64 } from "./bookPdf";
import { buildIndexPrompt } from "./bookGrounding";
import {
  BookSourceError,
  indexWindows,
  normaliseChapters,
  fallbackChapters,
  pickChapters,
  validateChapterEdits
} from "./bookChapters";
import { explainDataError } from "./dataErrors";

// Textbooks. An admin uploads a PDF once; Gemini reads it and lists the chapters; later, any generator can cut the
// chapters it needs out of the stored PDF and attach just those pages to a request (see bookGrounding.js).
// Rows live in `books` / `book_chapters`, the PDF in the private `books` storage bucket (supabase/schema.sql).

const BUCKET = "books";
export const MAX_PDF_BYTES = 50 * 1024 * 1024;
// What one request can carry is about 20 MB including the prompt; stay well inside it.
export const MAX_SOURCE_BYTES = 14 * 1024 * 1024;

const COLUMNS = "id, title, class_name, subject, language, page_count, status, file_path, created_at, book_chapters(id, position, title, start_page, end_page, summary, topics)";

const chapterFromRow = (row) => ({
  id: row.id,
  position: row.position,
  title: row.title,
  startPage: row.start_page,
  endPage: row.end_page,
  summary: row.summary || "",
  topics: row.topics || []
});

const bookFromRow = (row) => ({
  id: row.id,
  title: row.title,
  className: row.class_name,
  subject: row.subject,
  language: row.language || "English",
  pageCount: row.page_count,
  status: row.status,
  filePath: row.file_path,
  createdAt: row.created_at,
  chapters: (row.book_chapters || []).map(chapterFromRow).sort((a, b) => a.position - b.position)
});

// ---- reading

let booksCache = null;
const bytesCache = new Map(); // book id -> Promise of the PDF bytes (one download per book per visit)
const sliceCache = new Map(); // "book:ranges" -> base64 of the cut pages
const SLICE_CACHE_LIMIT = 6;

const forgetEverything = () => {
  booksCache = null;
  bytesCache.clear();
  sliceCache.clear();
};

export const listBooks = async ({ force = false } = {}) => {
  if (booksCache && !force) return booksCache;
  const { data, error } = await supabase.from("books").select(COLUMNS).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  booksCache = (data || []).map(bookFromRow);
  return booksCache;
};

/** Ready books for one class and subject (what a generator offers). */
export const booksFor = (books, className, subject) => books.filter((book) => book.status === "ready" && book.className === className && book.subject === subject);

// ---- uploading (admin)

const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// One part of the book at a time, so a 200-page book is read as a few small requests, not one big one.
const readPart = async (prompt, documents) => {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await generateBookIndex(prompt, documents);
    } catch (err) {
      // A badly formed answer is worth one more try; anything else (key, quota, network) is not.
      if (!(err instanceof GeminiResponseError)) throw err;
    }
  }
  return null;
};

const MIN_SPLIT_PAGES = 4;

/**
 * Reads the chapters that start inside `range` (1-based, inclusive) and returns them with GLOBAL page numbers.
 * Scanned books can be 300 KB a page, so a part that is too big for one request is cut in half and each half is
 * read on its own. `failed` counts the pieces Gemini could not read after a retry.
 */
const readRange = async (context, range) => {
  const { pdf, title, className, subject, language, partNumber, partCount, limitBytes } = context;
  const part = await pdf.extract([range]);
  const pages = range.end - range.start + 1;

  if (part.length > limitBytes && pages > MIN_SPLIT_PAGES) {
    const middle = range.start + Math.floor(pages / 2) - 1;
    const first = await readRange(context, { start: range.start, end: middle });
    const second = await readRange(context, { start: middle + 1, end: range.end });
    return { found: [...first.found, ...second.found], failed: first.failed + second.failed };
  }

  const prompt = buildIndexPrompt({ title, className, subject, language, firstPage: range.start, lastPage: range.end, partNumber, partCount });
  const chapters = await readPart(prompt, [{ mimeType: "application/pdf", data: bytesToBase64(part) }]);
  if (!chapters) return { found: [], failed: 1 };

  const found = [];
  chapters.forEach((chapter) => {
    const relative = Number(chapter?.startPage);
    // The model counts from 1 inside the part; a number outside it can't be right, so it is dropped.
    if (Number.isInteger(relative) && relative >= 1 && relative <= pages) found.push({ ...chapter, startPage: range.start + relative - 1 });
  });
  return { found, failed: 0 };
};

export const readChapters = async ({ pdf, title, className, subject, language, onProgress = () => {}, limitBytes = MAX_SOURCE_BYTES }) => {
  const windows = indexWindows(pdf.pageCount);
  const found = [];
  let unreadParts = 0;

  for (const [index, window] of windows.entries()) {
    onProgress({ step: "read", message: `Reading the chapters (part ${index + 1} of ${windows.length})`, done: index, total: windows.length });
    const result = await readRange({ pdf, title, className, subject, language, partNumber: index + 1, partCount: windows.length, limitBytes }, window);
    found.push(...result.found);
    unreadParts += result.failed;
  }

  const chapters = normaliseChapters(found, pdf.pageCount);
  if (!chapters.length) {
    return {
      chapters: fallbackChapters(pdf.pageCount),
      warning: "The chapters could not be read from this book automatically, so it was split into 20-page sections. You can rename them and fix the pages with Edit chapters."
    };
  }
  return {
    chapters,
    warning: unreadParts ? `${unreadParts} part${unreadParts === 1 ? "" : "s"} of the book could not be read, so some chapters may be missing. Check the list and fix it with Edit chapters.` : ""
  };
};

const chapterRows = (bookId, chapters) =>
  chapters.map((chapter, index) => ({
    book_id: bookId,
    position: index + 1,
    title: chapter.title,
    start_page: chapter.startPage,
    end_page: chapter.endPage,
    summary: chapter.summary || "",
    topics: chapter.topics || []
  }));

/**
 * Admin only (the database enforces it). Checks the PDF, stores it, has Gemini list the chapters, saves them.
 * `onProgress({ step, message, done, total })` lets the page show where it is. Returns { book, warning }.
 * Anything that goes wrong leaves nothing half-saved behind.
 */
export const uploadBook = async ({ file, title, className, subject, language = "English", userId, onProgress = () => {} }) => {
  const name = String(title || "").replace(/\s+/g, " ").trim();
  if (!file) throw new BookSourceError("Choose the PDF file first.");
  if (!name) throw new BookSourceError("Give the book a title.");
  if (!className || !subject) throw new BookSourceError("Choose the class and the subject.");
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name || "")) throw new BookSourceError("Only PDF files can be uploaded.");
  if (file.size > MAX_PDF_BYTES) throw new BookSourceError(`This file is ${mb(file.size)}; the limit is ${mb(MAX_PDF_BYTES)}. Upload the book in two parts, or use a smaller copy.`);

  onProgress({ step: "check", message: "Checking the PDF" });
  const pdf = await openPdf(await readBytes(file));

  onProgress({ step: "save", message: "Saving the book" });
  const { data: row, error } = await supabase
    .from("books")
    .insert({ title: name, class_name: className, subject, language, page_count: pdf.pageCount, status: "processing", uploaded_by: userId || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const path = `${row.id}/book.pdf`;
  try {
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { chapters, warning } = await readChapters({ pdf, title: name, className, subject, language, onProgress });

    onProgress({ step: "finish", message: "Saving the chapters" });
    const { error: chaptersError } = await supabase.from("book_chapters").insert(chapterRows(row.id, chapters));
    if (chaptersError) throw new Error(chaptersError.message);
    const { error: readyError } = await supabase.from("books").update({ status: "ready", file_path: path }).eq("id", row.id);
    if (readyError) throw new Error(readyError.message);

    forgetEverything();
    const book = (await listBooks({ force: true })).find((item) => item.id === row.id);
    return { book, warning };
  } catch (err) {
    await supabase.storage.from(BUCKET).remove([path]);
    await supabase.from("books").delete().eq("id", row.id);
    forgetEverything();
    throw err;
  }
};

/** Admin only. Removes the book, its chapters (cascade) and the stored PDF. */
export const deleteBook = async (book) => {
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([book.filePath || `${book.id}/book.pdf`]);
  if (removeError) throw new Error(removeError.message);
  const { error } = await supabase.from("books").delete().eq("id", book.id);
  if (error) throw new Error(error.message);
  forgetEverything();
};

/** Admin only. Replaces a book's chapters with an edited list (titles and page ranges). */
export const saveChapters = async ({ book, chapters }) => {
  const problems = validateChapterEdits(chapters, book.pageCount);
  if (problems.length) throw new BookSourceError(problems.join(" "));

  const { error: deleteError } = await supabase.from("book_chapters").delete().eq("book_id", book.id);
  if (deleteError) throw new Error(deleteError.message);
  const ordered = [...chapters].map((chapter) => ({ ...chapter, startPage: Number(chapter.startPage), endPage: Number(chapter.endPage) })).sort((a, b) => a.startPage - b.startPage);
  const { error } = await supabase.from("book_chapters").insert(chapterRows(book.id, ordered));
  if (error) throw new Error(error.message);
  forgetEverything();
};

// ---- using a book in a generator

const downloadBookBytes = (book) => {
  if (!bytesCache.has(book.id)) {
    const download = (async () => {
      const { data, error } = await supabase.storage.from(BUCKET).download(book.filePath);
      if (error) throw new BookSourceError(`The textbook file could not be loaded (${error.message || "download failed"}). Try again, or ask your admin to upload the book again.`);
      return readBytes(data);
    })().catch((err) => {
      bytesCache.delete(book.id);
      throw err;
    });
    bytesCache.set(book.id, download);
  }
  return bytesCache.get(book.id);
};

/**
 * Builds what a generator sends along with its prompt: the chosen chapters (or the ones matching `topic`) cut out of
 * the book as one small PDF. Throws a BookSourceError a teacher can act on.
 */
export const resolveSource = async ({ book, chapterIds = [], topic }) => {
  const chapters = pickChapters({ chapters: book.chapters, chapterIds, topic });
  const key = `${book.id}:${chapters.map((chapter) => `${chapter.startPage}-${chapter.endPage}`).join(",")}`;

  let data = sliceCache.get(key);
  if (!data) {
    const pdf = await openPdf(await downloadBookBytes(book));
    const cut = await pdf.extract(chapters.map((chapter) => ({ start: chapter.startPage, end: chapter.endPage })));
    if (cut.length > MAX_SOURCE_BYTES) {
      throw new BookSourceError(`These chapters are too large to send together (${mb(cut.length)}). Pick fewer chapters.`);
    }
    data = bytesToBase64(cut);
    if (sliceCache.size >= SLICE_CACHE_LIMIT) sliceCache.delete(sliceCache.keys().next().value);
    sliceCache.set(key, data);
  }

  return {
    book: { id: book.id, title: book.title, className: book.className, subject: book.subject },
    chapters: chapters.map(({ id, title, startPage, endPage }) => ({ id, title, startPage, endPage })),
    documents: [{ mimeType: "application/pdf", data }]
  };
};

/** One clear sentence for whatever went wrong on the textbook pages. */
export const explainBookError = (err) => {
  if (err instanceof BookSourceError) return err.message;
  if (isGeminiError(err)) return describeGeminiError(err);
  if (/bucket not found/i.test(err?.message || "")) return "The textbook storage is not set up yet. Run the latest supabase/schema.sql in the Supabase SQL editor.";
  return explainDataError(err?.message, { missing: "the textbook tables" });
};
