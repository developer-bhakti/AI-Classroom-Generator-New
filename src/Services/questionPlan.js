// How many questions fit the time a teacher chose. Pure (no network), so the prompt, the output size and the
// tests all use the same numbers.
//
// The estimate is a plain rule of thumb for young children: a multiple-choice question takes about a minute
// (longer in Class 1 where reading is slower, and in Maths where there is working out), harder papers take
// longer, and 15% of the time is kept back for settling in and checking answers.

const USABLE_SHARE = 0.85;

// Seconds a child needs for one multiple-choice question, by class.
const SECONDS_PER_MCQ = { "Class 1": 75, "Class 2": 60, "Class 3": 50 };
const DEFAULT_SECONDS_PER_MCQ = 60;

// Minutes for one short-answer exam question (Section A); a Section B question takes twice as long.
const MINUTES_PER_SHORT_ANSWER = { "Class 1": 3, "Class 2": 2.5, "Class 3": 2 };
const DEFAULT_MINUTES_PER_SHORT_ANSWER = 2.5;

const SUBJECT_FACTOR = { Math: 1.3, English: 1.1 };
const DIFFICULTY_FACTOR = { Easy: 0.85, Medium: 1, Hard: 1.25 };

export const QUIZ_LIMITS = { min: 3, max: 40, defaultMinutes: 15 };
export const EXAM_LIMITS = { sectionA: { min: 2, max: 20 }, sectionB: { min: 1, max: 8 }, defaultMinutes: 60 };

const factor = (table, key) => table[key] ?? 1;

/**
 * Reads a duration a person typed: "15 mins", "45", "1 hour", "1.5 hours", "1h 30m", "90 minutes".
 * Returns minutes, or null when no number can be found.
 */
export const parseMinutes = (text) => {
  const value = String(text ?? "").toLowerCase().trim();
  if (!value) return null;

  const hours = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/.exec(value);
  const minutes = /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/.exec(value);
  if (hours || minutes) {
    const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
    return total > 0 ? total : null;
  }

  const bare = /^(\d+(?:\.\d+)?)$/.exec(value);
  return bare && Number(bare[1]) > 0 ? Number(bare[1]) : null;
};

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Multiple-choice quiz: how many questions a child can finish in the time. */
export const planQuizLength = ({ duration, className, subject, difficulty } = {}) => {
  const minutes = parseMinutes(duration) ?? QUIZ_LIMITS.defaultMinutes;
  const secondsEach = (SECONDS_PER_MCQ[className] ?? DEFAULT_SECONDS_PER_MCQ) * factor(SUBJECT_FACTOR, subject) * factor(DIFFICULTY_FACTOR, difficulty || "Medium");
  const count = clamp(Math.floor((minutes * 60 * USABLE_SHARE) / secondsEach), QUIZ_LIMITS.min, QUIZ_LIMITS.max);
  return { count, minutes, secondsEach: Math.round(secondsEach) };
};

/**
 * Exam paper: how many short-answer (Section A) and longer (Section B) questions fit the time. About 60% of the
 * time goes to Section A and 40% to Section B; the counts are then trimmed until they fit.
 */
export const planExamLength = ({ duration, className, subject, difficulty, totalMarks } = {}) => {
  const minutes = parseMinutes(duration) ?? EXAM_LIMITS.defaultMinutes;
  const budget = minutes * USABLE_SHARE;
  const shortEach = (MINUTES_PER_SHORT_ANSWER[className] ?? DEFAULT_MINUTES_PER_SHORT_ANSWER) * factor(SUBJECT_FACTOR, subject) * factor(DIFFICULTY_FACTOR, difficulty || "Medium");
  const longEach = shortEach * 2;
  const { sectionA, sectionB } = EXAM_LIMITS;

  let a = clamp(Math.floor((budget * 0.6) / shortEach), sectionA.min, sectionA.max);
  let b = clamp(Math.floor((budget * 0.4) / longEach), sectionB.min, sectionB.max);
  // The minimums can overshoot a very short paper; give back questions until it fits (never below the minimums).
  while (a * shortEach + b * longEach > budget && (a > sectionA.min || b > sectionB.min)) {
    if (a > sectionA.min) a -= 1;
    else b -= 1;
  }
  // Every question is worth at least one whole mark, so a 10-mark paper cannot have 13 questions.
  const marks = Number.parseInt(totalMarks, 10);
  while (marks > 0 && a + b > marks && (a > sectionA.min || b > sectionB.min)) {
    if (a > sectionA.min) a -= 1;
    else b -= 1;
  }

  return { sectionA: a, sectionB: b, total: a + b, minutes };
};
