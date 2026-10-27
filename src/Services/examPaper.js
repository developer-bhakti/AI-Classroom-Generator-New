// An exam paper is two separate things: the paper a student sits (questions and options only) and the
// answer key for the teacher. They are kept in different fields (`sections` and `answerKey`) all the way
// from the model to the database, so no screen that renders `sections` can ever show an answer.

// Headings a model uses for its answers. Deliberately narrow: "Answer the following questions" is a
// question heading and must stay on the paper.
const ANSWER_HEADINGS = [
  /answer\s*(key|guide|sheet|scheme)/i,
  /^\s*answers?\s*$/i,
  /marking\s*(scheme|guide|hints?|notes?)|mark\s*scheme/i,
  /^\s*(solutions?|memo|model\s*answers?)\b/i,
  /teacher'?s?\s*(key|notes?|guide|only)/i
];

export const isAnswerSection = (section) => ANSWER_HEADINGS.some((pattern) => pattern.test(String(section?.heading || "")));

/**
 * Splits sections into the student's paper and anything that is really an answer key. This is the safety
 * net: the prompt asks for the two to be separate, but a model sometimes still adds an "Answer Guide"
 * section, and exam papers saved before the change have one. Nothing is thrown away; answers move to
 * `answerKey`, where only the teacher-only view shows them.
 */
export const splitExamSections = (sections = []) => ({
  paperSections: sections.filter((section) => !isAnswerSection(section)),
  answerKey: sections.filter(isAnswerSection)
});
