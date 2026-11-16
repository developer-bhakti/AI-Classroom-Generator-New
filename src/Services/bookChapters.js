// Chapter lists for an uploaded textbook: cleaning what Gemini reports, finding the chapters that match a topic,
// and keeping the pages sent to the AI within what one request can carry. Pure (no network).

// One request can carry about 20 MB. A page of a picture book is well under 300 KB once cut out, so this
// leaves room; bookService also checks the real size after cutting.
export const MAX_SOURCE_PAGES = 60;
// A book is read in parts of this many pages so each request stays small.
export const INDEX_WINDOW_PAGES = 80;
// The fallback "Pages 1-20" sections used when no chapters could be read.
const FALLBACK_SECTION_PAGES = 20;

/** Thrown for problems the teacher can fix themselves (no chapter matched, too many pages chosen). */
export class BookSourceError extends Error {}

const clean = (text, max) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// The first spelling of each word or phrase wins; "Counting" and "counting" are one entry.
const uniqueIgnoringCase = (list) => {
  const seen = new Set();
  return list.filter((item) => (seen.has(item.toLowerCase()) ? false : (seen.add(item.toLowerCase()), true)));
};

/** Splits pages 1..pageCount into consecutive windows: [{ start, end }] (1-based, inclusive). */
export const indexWindows = (pageCount, size = INDEX_WINDOW_PAGES) => {
  const windows = [];
  for (let start = 1; start <= pageCount; start += size) windows.push({ start, end: Math.min(pageCount, start + size - 1) });
  return windows;
};

/**
 * Turns the raw chapter starts found by the model (with GLOBAL page numbers) into a clean list:
 * ignores entries with no title or an impossible page, sorts by page, keeps the first of two chapters that start on
 * the same page, and ends each chapter on the page before the next one starts (the last one ends on the last page).
 */
export const normaliseChapters = (raw, pageCount) => {
  const seen = new Set();
  const starts = (Array.isArray(raw) ? raw : [])
    .map((item) => ({
      title: clean(item?.title, 120),
      startPage: Number(item?.startPage),
      summary: clean(item?.summary, 240),
      topics: uniqueIgnoringCase((Array.isArray(item?.topics) ? item.topics : []).map((topic) => clean(topic, 40)).filter(Boolean)).slice(0, 10)
    }))
    .filter((item) => item.title && Number.isInteger(item.startPage) && item.startPage >= 1 && item.startPage <= pageCount)
    .sort((a, b) => a.startPage - b.startPage)
    .filter((item) => (seen.has(item.startPage) ? false : (seen.add(item.startPage), true)));

  return starts.map((item, index) => ({
    position: index + 1,
    title: item.title,
    startPage: item.startPage,
    endPage: index + 1 < starts.length ? starts[index + 1].startPage - 1 : pageCount,
    summary: item.summary,
    topics: item.topics
  }));
};

/** When no chapter could be read: equal sections of 20 pages, so the book is still usable. */
export const fallbackChapters = (pageCount, size = FALLBACK_SECTION_PAGES) =>
  indexWindows(pageCount, size).map((window, index) => ({
    position: index + 1,
    title: `Pages ${window.start}-${window.end}`,
    startPage: window.start,
    endPage: window.end,
    summary: "",
    topics: []
  }));

/**
 * Checks a chapter list a person has edited. Returns a list of plain-language problems (empty = fine).
 * Ranges may touch but a chapter must stay inside the book and start no later than it ends.
 */
export const validateChapterEdits = (chapters, pageCount) => {
  const problems = [];
  if (!chapters.length) problems.push("Keep at least one chapter.");
  chapters.forEach((chapter, index) => {
    const label = `Chapter ${index + 1}`;
    const start = Number(chapter.startPage);
    const end = Number(chapter.endPage);
    if (!clean(chapter.title, 120)) problems.push(`${label} needs a title.`);
    if (!Number.isInteger(start) || !Number.isInteger(end)) problems.push(`${label}: the first and last page must be whole numbers.`);
    else if (start < 1 || end > pageCount) problems.push(`${label}: pages must be between 1 and ${pageCount}.`);
    else if (start > end) problems.push(`${label}: the first page is after the last page.`);
  });
  return problems;
};

export const pagesIn = (chapters) => chapters.reduce((sum, chapter) => sum + (chapter.endPage - chapter.startPage + 1), 0);

// ---- finding the chapters that match a topic

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "in", "on", "to", "for", "with", "is", "are", "at", "my", "our", "about", "from", "chapter", "unit", "lesson", "class", "ch"]);

// Light stemming so "shape" finds "Shapes" and "fruits" finds "fruit".
const stem = (word) => {
  if (word.length <= 3) return word;
  if (/ies$/.test(word)) return word.replace(/ies$/, "y");
  if (/(ss|us|is)$/.test(word)) return word; // grass, bus, this: the s belongs to the word
  if (/(sh|ch|x|z|s)es$/.test(word)) return word.replace(/es$/, ""); // boxes, dishes, buses
  return word.replace(/s$/, ""); // shapes, fruits
};

const wordsOf = (text) =>
  String(text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((word) => word && !STOP_WORDS.has(word))
    .map(stem);

/**
 * The chapters that talk about the topic, best first (at most 3, and only those nearly as good as the best).
 * Titles count most, then the key words the model listed, then the one-line summary.
 */
export const matchChapters = (chapters, topic) => {
  const wanted = [...new Set(wordsOf(topic))];
  if (!wanted.length) return [];

  const scored = chapters
    .map((chapter) => {
      const title = new Set(wordsOf(chapter.title));
      const keys = new Set(wordsOf((chapter.topics || []).join(" ")));
      const summary = new Set(wordsOf(chapter.summary));
      const score = wanted.reduce((sum, word) => sum + (title.has(word) ? 3 : 0) + (keys.has(word) ? 2 : 0) + (summary.has(word) ? 1 : 0), 0);
      return { chapter, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.chapter.position - b.chapter.position);

  if (!scored.length) return [];
  const best = scored[0].score;
  return scored.filter((item) => item.score >= best * 0.6).slice(0, 3).map((item) => item.chapter).sort((a, b) => a.position - b.position);
};

/**
 * Which chapters to send: the ones the teacher ticked, otherwise the ones that match the topic.
 * Throws a BookSourceError a teacher can act on.
 */
export const pickChapters = ({ chapters, chapterIds = [], topic }) => {
  const chosen = chapterIds.length
    ? chapters.filter((chapter) => chapterIds.includes(chapter.id)).sort((a, b) => a.position - b.position)
    : matchChapters(chapters, topic);

  if (!chosen.length) {
    throw new BookSourceError(chapterIds.length
      ? "The chapters you picked are no longer in this book. Pick again."
      : `I couldn't find "${clean(topic, 60)}" in this book. Pick the chapter yourself, or change the topic to match a chapter.`);
  }

  const pages = pagesIn(chosen);
  if (pages > MAX_SOURCE_PAGES) {
    throw new BookSourceError(`Those chapters add up to ${pages} pages, and ${MAX_SOURCE_PAGES} is the most that can be sent at once. Pick fewer chapters.`);
  }
  return chosen;
};
