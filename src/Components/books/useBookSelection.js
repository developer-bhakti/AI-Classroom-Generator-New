import { useCallback, useEffect, useMemo, useState } from "react";
import { listBooks, booksFor, resolveSource } from "../../Services/bookService";

/**
 * The textbook choice on a generator page. Finds the books uploaded for the chosen class and subject and, when there
 * is one, switches it on by default: "all input should come from the book" is the normal case, and turning it off is
 * the exception. `buildSource(topic)` returns what generateResource() needs, or null when the textbook is off.
 */
export const useBookSelection = (className, subject) => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState({ enabled: false, bookId: "", chapterIds: [] });

  useEffect(() => {
    let active = true;
    listBooks()
      .then((rows) => { if (active) setBooks(rows); })
      // No books table yet (schema.sql not re-run) or offline: the page simply behaves as before.
      .catch(() => { if (active) setBooks([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const available = useMemo(() => booksFor(books, className, subject), [books, className, subject]);

  useEffect(() => {
    setSelection((previous) => {
      if (!available.length) return previous.enabled || previous.bookId ? { enabled: false, bookId: "", chapterIds: [] } : previous;
      return available.some((book) => book.id === previous.bookId) ? previous : { enabled: true, bookId: available[0].id, chapterIds: [] };
    });
  }, [available]);

  const book = available.find((item) => item.id === selection.bookId) || null;

  const buildSource = useCallback(
    async (topic) => (selection.enabled && book ? resolveSource({ book, chapterIds: selection.chapterIds, topic }) : null),
    [selection, book]
  );

  return { available, loading, selection, setSelection, book, buildSource };
};
