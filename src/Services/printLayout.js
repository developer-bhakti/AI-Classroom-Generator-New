// Small pure helpers for the printable sheets: how an item is shown and how much room to leave to write.

const NUMBERED = /^\s*\d+[.)]\s/;

/** "1. What is half of 8?" already carries its number, so it prints without a bullet. */
export const isNumberedItem = (item) => NUMBERED.test(String(item));

// The model sometimes repeats the label it was given before the instructions it was asked to print.
export const cleanPrintedItem = (item) => String(item).replace(/^\s*teacher'?s instructions to include on the paper:\s*/i, "").trim();

/** A multiple-choice question lists its own options (A) ... B) ...), so it needs no lines to write on. */
export const hasOptions = (item) => /(^|\s)\(?A[.)]\s.*\(?B[.)]\s/s.test(String(item));

/**
 * How many ruled lines to leave under an item so a child can write the answer on the sheet.
 * Teacher documents (lesson plans, activities) and multiple-choice questions get none.
 */
export const answerLines = (kind, heading, item) => {
  if (!isNumberedItem(item) || hasOptions(item)) return 0;
  const name = String(heading || "");
  if (kind === "exam") return /section\s*b/i.test(name) ? 4 : 2;
  if (kind === "worksheet") {
    if (/warm/i.test(name)) return 1;
    if (/reflect/i.test(name)) return 3;
    return 2;
  }
  return 0;
};

const KIND_LABELS = {
  worksheet: "Worksheet",
  lesson: "Lesson plan",
  quiz: "Quiz",
  activity: "Activity ideas",
  exam: "Exam paper",
  "answer-key": "Answer key"
};

export const kindLabel = (kind) => KIND_LABELS[kind] || "Resource";

/** The line under the title: "Class 3 · Math · 40 mins · 20 marks". Only what is known is shown. */
export const metaLine = (kind, meta = {}) => {
  const parts = [meta.className, meta.subject];
  if (meta.duration) parts.push(meta.duration);
  if (kind === "exam" && meta.totalMarks) parts.push(`${meta.totalMarks} marks`);
  return parts.filter(Boolean).join(" · ");
};

/** Documents a child writes on get Name / Date lines; teacher documents do not. */
export const isStudentSheet = (kind) => kind === "worksheet" || kind === "quiz" || kind === "exam";

/** The file name the browser suggests when someone chooses "Save as PDF". */
export const printTitle = (kind, title) => `${String(title || kindLabel(kind)).trim()}${kind === "answer-key" ? " - Answer key (teacher only)" : ""}`;
