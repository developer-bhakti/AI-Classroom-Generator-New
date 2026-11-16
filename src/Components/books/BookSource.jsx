import React from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useAuth } from "../../context/useAuth";

// The "Textbook" choice on a generator form. All the logic lives in useBookSelection; this only draws it.

const BookSource = ({ state, className }) => {
  const { isAdmin } = useAuth();
  const { available, loading, selection, setSelection, book } = state;

  if (loading) return null;

  if (!available.length) {
    // Class 1 is the class that is meant to follow the NCERT book, so say how to turn that on.
    if (className !== "Class 1") return null;
    return (
      <p className="book-source-hint">
        <BookOpen size={14} /> Class 1 resources can follow the NCERT book.{" "}
        {isAdmin ? <Link to="/books">Upload the book under Textbooks.</Link> : "Ask your admin to upload it under Textbooks."}
      </p>
    );
  }

  const toggleChapter = (id) =>
    setSelection((previous) => ({
      ...previous,
      chapterIds: previous.chapterIds.includes(id) ? previous.chapterIds.filter((item) => item !== id) : [...previous.chapterIds, id]
    }));

  const on = selection.enabled && book;

  return (
    <>
      <label>Textbook</label>
      <div className="book-source">
        <label className="book-source-toggle">
          <input
            type="checkbox"
            checked={selection.enabled}
            onChange={(e) => setSelection((previous) => ({ ...previous, enabled: e.target.checked }))}
          />
          <span>Use only the textbook</span>
        </label>

        {on ? (
          <>
            {available.length > 1 ? (
              <select
                aria-label="Textbook"
                value={book.id}
                onChange={(e) => setSelection((previous) => ({ ...previous, bookId: e.target.value, chapterIds: [] }))}
              >
                {available.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            ) : (
              <p className="book-source-name"><BookOpen size={15} /> {book.title}</p>
            )}

            <div className="book-chapter-chips" role="group" aria-label="Chapters to use">
              <button
                type="button"
                className={`book-chip ${selection.chapterIds.length === 0 ? "on" : ""}`}
                aria-pressed={selection.chapterIds.length === 0}
                onClick={() => setSelection((previous) => ({ ...previous, chapterIds: [] }))}
              >
                Match my topic
              </button>
              {book.chapters.map((chapter) => (
                <button
                  type="button"
                  key={chapter.id}
                  className={`book-chip ${selection.chapterIds.includes(chapter.id) ? "on" : ""}`}
                  aria-pressed={selection.chapterIds.includes(chapter.id)}
                  onClick={() => toggleChapter(chapter.id)}
                  title={`Pages ${chapter.startPage}-${chapter.endPage}`}
                >
                  {chapter.title}
                </button>
              ))}
            </div>
            <p className="book-source-hint">Only the pages of these chapters go to the AI, and it is told to use nothing else.</p>
          </>
        ) : (
          <p className="book-source-hint">The AI will use its general knowledge instead of the book.</p>
        )}
      </div>
    </>
  );
};

export default BookSource;
