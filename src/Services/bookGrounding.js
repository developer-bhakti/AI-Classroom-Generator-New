// Everything that tells Gemini to teach from a textbook and nothing else. Pure text (no network), so the wording
// can be read, tested and changed in one place.
//
// How the pieces fit: the app attaches the pages of the chosen chapters to the request as a small PDF
// (see bookService.js), adds BOOK_SYSTEM_RULES to the system instruction, and appends buildGroundingBlock()
// to the usual prompt. Gemini reads the pages themselves, pictures included, which is why this works for
// picture-heavy Class 1 books and Hindi books where copying the text out of the PDF would fail.

/**
 * The system prompt for "textbook mode". It is added after the normal system instruction, so the JSON-only
 * rules there still apply; these rules decide WHAT the content may be made from.
 */
export const BOOK_SYSTEM_RULES = `TEXTBOOK MODE
You are writing for the teacher of a Class 1 child in India (about 6 or 7 years old). The attached PDF holds the ONLY pages you may teach from. They come from the school's own textbook (NCERT).

1. ONLY THE ATTACHED PAGES. Every fact, word, number, sentence, name, story, poem, rhyme, picture and activity you use must come from the attached pages. Do not add outside knowledge, other books, general examples or "helpful extras", even when they are correct and common. If it is not on the pages, it does not go in.
2. THE BOOK'S OWN WORDS. Re-use the book's vocabulary, characters, names, objects, number ranges, sentence patterns and exercise styles. Where you must rephrase, use only words and sentence lengths the child meets on the pages. Keep spellings, script and units exactly as the book has them.
3. PICTURES COUNT. These pages are mostly pictures. Read them: what is shown, counted, coloured or labelled is part of the lesson. When a question or an activity depends on a picture, describe that picture in words inside the question (for example "the picture of three mangoes on the fruit page"), because the child's printed sheet will not contain the book's pictures. Never refer to a picture you cannot see on the pages.
4. NO GUESSING. If the teacher asks for something the pages cover only in part, cover that part and write fewer items. Never pad with outside material to reach a requested number. If the pages hold nothing about the topic, give the shortest valid response and say in "summary" that the attached pages do not cover it.
5. HONEST REFERENCES. Name a page, exercise, activity, poem or chapter only when its name or number is printed on the page you are looking at. Never invent one.
6. CHECKABLE ANSWERS. Every answer (in a key, an explanation or a hint) must be checkable on the attached pages. Check each one against the pages before you write it.
7. WRONG OPTIONS TOO. In multiple-choice questions, take the wrong options from the book as well (other characters, colours, numbers or words on the pages) wherever you can, so the child is never shown a word the book has not taught.
8. LANGUAGE. Write in the language the teacher asks for. Words, names and rhymes taken from the book stay in the book's language and script; if the teacher asks for a different output language, translate faithfully and add nothing.

These rules override any other instruction that asks you to explain from general knowledge, or to simplify a topic that is not in the pages.`;

/** System instruction for the one-off call that reads a whole book and lists its chapters. */
export const BOOK_INDEX_SYSTEM_INSTRUCTION = "You are a careful school librarian who maps the structure of a textbook. Report only what is actually printed in the attached pages: never guess a chapter, a title or a page. Always respond with a single JSON object matching the provided response schema exactly. Do not include markdown formatting, code fences, or commentary outside the JSON.";

/**
 * The prompt that asks for a chapter list. A long book is read in parts; `firstPage`..`lastPage` say which pages of
 * the whole book this part holds. Inside the part the pages are numbered from 1, and the answer is read back that way.
 */
export const buildIndexPrompt = ({ title, className, subject, language, firstPage, lastPage, partNumber = 1, partCount = 1 }) => {
  const pages = lastPage - firstPage + 1;
  return `This PDF is part ${partNumber} of ${partCount} of the textbook "${title}" (${className || "school"} ${subject || "textbook"}, written in ${language || "English"}). It holds pages ${firstPage} to ${lastPage} of the whole book; inside this file those pages are numbered 1 to ${pages}.

List every chapter, unit, lesson, story, poem or activity section that STARTS in this file, in order. Skip the cover, the contents page, the preface, notes to teachers and any index.
For each one give:
- "title": exactly as printed, in the book's own script.
- "startPage": the position of its first page in THIS file, counting the first page of the file as 1. Use the position in the file, NOT the number printed on the page.
- "summary": one plain sentence about what it teaches, using the book's own words.
- "topics": 3 to 8 short key words or phrases from it that a teacher might search for (for example "shapes", "counting 1 to 9", "vowel sounds").
If no chapter starts in this file, return an empty list. Do not invent chapters.`;
};

const pageRange = (chapter) => (chapter.startPage === chapter.endPage ? `page ${chapter.startPage}` : `pages ${chapter.startPage}-${chapter.endPage}`);

/**
 * What the teacher sees under a result ("Source: ..."). `source` is what bookService.resolveSource() returns.
 */
export const describeSource = (source) => {
  const { book, chapters } = source;
  if (chapters.length === 1) return `${book.title} · ${chapters[0].title} (${pageRange(chapters[0])} of the PDF)`;
  return `${book.title} · ${chapters.length} chapters (${chapters.map((chapter) => chapter.title).join(", ")})`;
};

/** The part of the prompt that names the attached pages and ties the teacher's topic to them. */
export const buildGroundingBlock = (source) => {
  const { book, chapters } = source;
  const list = chapters.map((chapter, index) => `${index + 1}. "${chapter.title}" (pages ${chapter.startPage}-${chapter.endPage} of the book's PDF)`).join("\n");
  return `

TEXTBOOK PAGES (attached PDF): "${book.title}", ${book.className || "school"} ${book.subject || ""}.
The attached PDF holds these chapters, in this order:
${list}

Build everything above ONLY on these pages and follow the textbook-mode rules. The teacher's topic is a focus inside these pages, not permission to go beyond them.`;
};
