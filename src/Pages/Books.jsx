import React, { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { BookOpen, UploadCloud, AlertTriangle, CheckCircle2, Trash2, Pencil, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { classOptions, subjectMap } from "../Services/curriculum";
import { LANGUAGES } from "../Services/contentStore";
import { logActivity } from "../Services/activityLog";
import { listBooks, uploadBook, deleteBook, saveChapters, explainBookError, MAX_PDF_BYTES } from "../Services/bookService";

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const titleFromFile = (name) => String(name || "").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

const EMPTY_FORM = { title: "", className: classOptions[0], subject: (subjectMap[classOptions[0]] || [""])[0], language: "English", file: null };

const Books = () => {
  const { user, isAdmin } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [fileKey, setFileKey] = useState(0); // changing it clears the file picker
  const [progress, setProgress] = useState(null);

  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null); // { bookId, rows }
  const [busy, setBusy] = useState(false);

  const subjects = useMemo(() => subjectMap[form.className] || [], [form.className]);

  const refresh = useCallback(async () => {
    try {
      setBooks(await listBooks({ force: true }));
      setError(null);
    } catch (err) {
      setError(explainBookError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Reading a book takes a minute or two; leaving the page would stop it half way.
  useEffect(() => {
    if (!progress) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [progress]);

  const handleField = (e) => {
    const { name, value } = e.target;
    if (name === "className") setForm((prev) => ({ ...prev, className: value, subject: (subjectMap[value] || [""])[0] }));
    else setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, file, title: prev.title || titleFromFile(file?.name) }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setProgress({ message: "Starting" });
    try {
      const { book, warning } = await uploadBook({ ...form, userId: user?.id, onProgress: setProgress });
      logActivity(user?.id, "book_uploaded", { title: book.title, className: book.className, subject: book.subject });
      setNotice(warning
        ? { type: "warn", text: `"${book.title}" was saved with ${book.chapters.length} section${book.chapters.length === 1 ? "" : "s"}. ${warning}` }
        : { type: "ok", text: `"${book.title}" is ready: ${book.chapters.length} chapter${book.chapters.length === 1 ? "" : "s"} found in ${book.pageCount} pages.` });
      setForm(EMPTY_FORM);
      setFileKey((key) => key + 1);
      setOpenId(book.id);
      await refresh();
    } catch (err) {
      setError(explainBookError(err));
    } finally {
      setProgress(null);
    }
  };

  const handleDelete = async (book) => {
    if (!window.confirm(`Delete "${book.title}"? Lessons, quizzes and papers already made from it stay saved.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteBook(book);
      setNotice({ type: "ok", text: `"${book.title}" was deleted.` });
      if (openId === book.id) setOpenId(null);
      if (editing?.bookId === book.id) setEditing(null);
      await refresh();
    } catch (err) {
      setError(explainBookError(err));
    } finally {
      setBusy(false);
    }
  };

  const startEditing = (book) => {
    setOpenId(book.id);
    setEditing({ bookId: book.id, rows: book.chapters.map((c) => ({ key: c.id, title: c.title, startPage: c.startPage, endPage: c.endPage, summary: c.summary, topics: c.topics })) });
  };

  const changeRow = (index, field, value) =>
    setEditing((prev) => ({ ...prev, rows: prev.rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)) }));

  const handleSaveChapters = async (book) => {
    setBusy(true);
    setError(null);
    try {
      await saveChapters({ book, chapters: editing.rows });
      setEditing(null);
      setNotice({ type: "ok", text: "The chapters were saved." });
      await refresh();
    } catch (err) {
      setError(explainBookError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Textbooks" />
        <div className="content-area books-page">
          <section className="page-intro">
            <div className="page-intro-badge">Textbooks</div>
            <h3>Make every resource follow the textbook</h3>
            <p>
              {isAdmin
                ? "Upload an NCERT book as a PDF. The app reads its chapters once. After that, lesson plans, quizzes and exam papers for that class and subject are written only from the chapter pages you choose."
                : "These are the textbooks your school has added. When one exists for a class and subject, lesson plans, quizzes and exam papers can be written only from its chapters. Your admin adds and removes books."}
            </p>
          </section>

          {error ? <div className="error-state" role="alert"><p><AlertTriangle size={16} /> {error}</p></div> : null}
          {notice ? (
            <div className={notice.type === "ok" ? "success-state" : "error-state"} role="status">
              <p>{notice.type === "ok" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {notice.text}</p>
            </div>
          ) : null}

          {isAdmin ? (
            <form className="panel-card book-upload" onSubmit={handleUpload}>
              <h3><UploadCloud size={18} /> Upload a textbook</h3>
              <label htmlFor="book-file">PDF file (up to {Math.round(MAX_PDF_BYTES / (1024 * 1024))} MB)</label>
              <input id="book-file" key={fileKey} type="file" accept="application/pdf,.pdf" onChange={handleFile} disabled={Boolean(progress)} />
              <label htmlFor="book-title">Book title</label>
              <input id="book-title" name="title" value={form.title} onChange={handleField} placeholder="For example: Joyful Mathematics" disabled={Boolean(progress)} />
              <div className="book-upload-row">
                <div>
                  <label htmlFor="book-class">Class</label>
                  <select id="book-class" name="className" value={form.className} onChange={handleField} disabled={Boolean(progress)}>
                    {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="book-subject">Subject</label>
                  <select id="book-subject" name="subject" value={form.subject} onChange={handleField} disabled={Boolean(progress)}>
                    {subjects.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="book-language">Book language</label>
                  <select id="book-language" name="language" value={form.language} onChange={handleField} disabled={Boolean(progress)}>
                    {LANGUAGES.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>
              <button className="primary-btn full" type="submit" disabled={Boolean(progress)}>
                {progress ? "Working..." : "Upload and read the book"}
              </button>
              {progress ? (
                <div className="book-progress" role="status" aria-live="polite">
                  <div className="spinner" />
                  <p>{progress.message}{progress.total > 1 ? "" : "..."} Please keep this page open.</p>
                </div>
              ) : null}
            </form>
          ) : null}

          <h3 className="section-heading">Your school's textbooks ({books.length})</h3>
          {loading ? (
            <div className="panel-card"><div className="loading-state"><div className="spinner" /><p>Loading the textbooks...</p></div></div>
          ) : books.length === 0 ? (
            <div className="panel-card"><p className="table-empty">No textbooks yet.{isAdmin ? " Upload the first one above." : " Ask your admin to upload one."}</p></div>
          ) : (
            <div className="book-list">
              {books.map((book) => {
                const open = openId === book.id;
                const isEditing = editing?.bookId === book.id;
                return (
                  <article key={book.id} className="panel-card book-card">
                    <div className="book-card-head">
                      <div className="resource-icon"><BookOpen size={18} /></div>
                      <div className="book-card-title">
                        <h4>{book.title}</h4>
                        <p className="content-row-meta">
                          {book.className} · {book.subject} · {book.language} · {book.pageCount} pages · {book.chapters.length} chapter{book.chapters.length === 1 ? "" : "s"} · added {formatDate(book.createdAt)}
                        </p>
                      </div>
                      <span className={`status-pill ${book.status === "ready" ? "active" : "expired"}`}>{book.status === "ready" ? "Ready" : book.status === "processing" ? "Not finished" : book.status}</span>
                    </div>

                    <div className="book-card-actions">
                      <button type="button" className="secondary-btn" onClick={() => setOpenId(open ? null : book.id)} aria-expanded={open}>
                        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Chapters
                      </button>
                      {isAdmin ? (
                        <>
                          <button type="button" className="secondary-btn" onClick={() => startEditing(book)} disabled={busy || book.status !== "ready"}><Pencil size={15} /> Edit chapters</button>
                          <button type="button" className="secondary-btn danger-btn" onClick={() => handleDelete(book)} disabled={busy}><Trash2 size={15} /> Delete</button>
                        </>
                      ) : null}
                    </div>

                    {open && !isEditing ? (
                      <ol className="book-chapter-list">
                        {book.chapters.map((chapter) => (
                          <li key={chapter.id}>
                            <strong>{chapter.title}</strong> <span className="cell-muted">pages {chapter.startPage}-{chapter.endPage}</span>
                            {chapter.summary ? <p>{chapter.summary}</p> : null}
                            {chapter.topics.length ? <p className="cell-muted">{chapter.topics.join(" · ")}</p> : null}
                          </li>
                        ))}
                      </ol>
                    ) : null}

                    {isEditing ? (
                      <div className="book-edit">
                        <p className="content-row-meta">Pages are counted from the first page of the PDF (1 to {book.pageCount}), not the numbers printed on the pages.</p>
                        <div className="book-edit-rows">
                          {editing.rows.map((row, index) => (
                            <div className="book-edit-row" key={row.key || index}>
                              <input aria-label={`Chapter ${index + 1} title`} value={row.title} onChange={(e) => changeRow(index, "title", e.target.value)} />
                              <input aria-label={`Chapter ${index + 1} first page`} type="number" min="1" max={book.pageCount} value={row.startPage} onChange={(e) => changeRow(index, "startPage", e.target.value)} />
                              <input aria-label={`Chapter ${index + 1} last page`} type="number" min="1" max={book.pageCount} value={row.endPage} onChange={(e) => changeRow(index, "endPage", e.target.value)} />
                              <button type="button" className="text-btn danger-text" aria-label={`Remove chapter ${index + 1}`} onClick={() => setEditing((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== index) }))}><Trash2 size={15} /></button>
                            </div>
                          ))}
                        </div>
                        <div className="book-card-actions">
                          <button type="button" className="secondary-btn" onClick={() => setEditing((prev) => ({ ...prev, rows: [...prev.rows, { key: `new-${prev.rows.length}`, title: "", startPage: 1, endPage: 1, summary: "", topics: [] }] }))}><Plus size={15} /> Add a chapter</button>
                          <button type="button" className="primary-btn" onClick={() => handleSaveChapters(book)} disabled={busy}>Save chapters</button>
                          <button type="button" className="secondary-btn" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Books;
