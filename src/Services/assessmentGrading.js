// Pure assessment logic: shaping the model's questions, checking answers, scoring and levels.
// Nothing in here talks to the network, so it can be reasoned about (and tested) on its own.

export const QUESTION_TYPES = {
  mcq: "Multiple choice",
  fill_blank: "Fill in the blank",
  true_false: "True / False",
  match: "Match the following",
  problem_solving: "Problem solving",
  short_answer: "Short answer"
};

// Types answered by typing. A typed answer that misses the key may still be right ("hundreds"
// vs "hundred", "45" vs "45 apples"), so these are the only ones a second opinion may overturn.
export const OPEN_TYPES = new Set(["fill_blank", "problem_solving", "short_answer"]);

export const OPTION_LABELS = ["A", "B", "C", "D"];

// A skill counts as understood at this accuracy; it matches the bottom of the "Good" band.
export const MASTERY_THRESHOLD = 75;

const LEVELS = [
  { min: 90, label: "Excellent", tone: "excellent" },
  { min: 75, label: "Good", tone: "good" },
  { min: 50, label: "Average", tone: "average" },
  { min: 0, label: "Improvement Required", tone: "improve" }
];

export const getPerformanceLevel = (percentage) => LEVELS.find((level) => percentage >= level.min) || LEVELS[LEVELS.length - 1];

export const toneForLevelLabel = (label) => LEVELS.find((level) => level.label === label)?.tone || "average";

const roundTo = (value, places = 1) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export const toPercentage = (correct, total) => (total > 0 ? roundTo((correct / total) * 100) : 0);

const cleanString = (value) => (typeof value === "string" ? value.trim() : "");

const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// ---- Shaping the model's questions ----

const normalizeQuestion = (raw, index) => {
  const type = raw.type;
  if (!QUESTION_TYPES[type]) return null;

  const question = cleanString(raw.question);
  const topic = cleanString(raw.topic);
  if (!question || !topic) return null;

  const base = {
    id: `q${index + 1}`,
    type,
    topic,
    skill: cleanString(raw.skill) || topic,
    question,
    explanation: cleanString(raw.explanation)
  };

  if (type === "mcq") {
    const options = Array.isArray(raw.options) ? raw.options.map(cleanString) : [];
    const distinct = new Set(options.map((option) => option.toLowerCase()));
    if (options.length !== 4 || options.some((option) => !option) || distinct.size !== 4) return null;
    if (!Number.isInteger(raw.correctIndex) || raw.correctIndex < 0 || raw.correctIndex > 3) return null;
    return { ...base, options, correctIndex: raw.correctIndex };
  }

  if (type === "true_false") {
    // The options are fixed; only the key matters, so a model that words them differently can't break grading.
    let correctIndex = raw.correctIndex;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 1) {
      const answer = cleanString(raw.answer).toLowerCase();
      if (answer === "true") correctIndex = 0;
      else if (answer === "false") correctIndex = 1;
      else return null;
    }
    return { ...base, options: ["True", "False"], correctIndex };
  }

  if (type === "match") {
    const pairs = Array.isArray(raw.pairs)
      ? raw.pairs.map((pair) => ({ left: cleanString(pair?.left), right: cleanString(pair?.right) }))
      : [];
    if (pairs.length < 3 || pairs.length > 6 || pairs.some((pair) => !pair.left || !pair.right)) return null;
    // Two identical right-hand items would make "the" correct match ambiguous.
    if (new Set(pairs.map((pair) => pair.right.toLowerCase())).size !== pairs.length) return null;

    let order = shuffle(pairs.map((_, i) => i));
    for (let attempt = 0; attempt < 5 && order.every((value, i) => value === i); attempt += 1) order = shuffle(order);

    return {
      ...base,
      lefts: pairs.map((pair) => pair.left),
      rights: order.map((i) => pairs[i].right),
      // correctMatches[i] = position in `rights` that belongs with lefts[i]
      correctMatches: pairs.map((_, i) => order.indexOf(i))
    };
  }

  const answer = cleanString(raw.answer);
  if (!answer) return null;
  const acceptedAnswers = Array.isArray(raw.acceptedAnswers) ? raw.acceptedAnswers.map(cleanString).filter(Boolean) : [];
  return { ...base, answer, acceptedAnswers };
};

const TYPE_ORDER = Object.keys(QUESTION_TYPES);

/**
 * Keeps every usable question (bad ones are dropped, not fatal), groups them by type the way a
 * printed paper is sectioned — whatever order the model returned them in — and renumbers them.
 */
export const normalizeQuestions = (rawQuestions) =>
  rawQuestions
    .map((raw, index) => normalizeQuestion(raw, index))
    .filter(Boolean)
    // Array.prototype.sort is stable, so questions keep the model's order within a type.
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
    .map((question, index) => ({ ...question, id: `q${index + 1}` }));

// ---- Checking answers ----

const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    // 1,250 -> 1250 so an Indian- or Western-style grouping both compare equal
    .replace(/\d{1,3}(?:,\d{2,3})+(?!\d)/g, (group) => group.replace(/,/g, ""))
    .replace(/[^\p{L}\p{N}.\-\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter((token) => token && token !== "-")
    .join(" ");

const numbersIn = (normalized) => (normalized.match(NUMBER_PATTERN) || []).map(Number);

const sameNumbers = (a, b) => a.length > 0 && a.length === b.length && a.every((value, i) => value === b[i]);

const matchesOpenAnswer = (question, answer) => {
  const given = normalizeText(answer);
  if (!given) return false;
  const givenNumbers = numbersIn(given);
  const givenTokenCount = given.split(" ").length;

  const candidates = [question.answer, ...(question.acceptedAnswers || [])].map(normalizeText).filter(Boolean);

  return candidates.some((candidate) => {
    if (candidate === given) return true;

    // "45" is right for "45 apples" (and vice versa) — but only for typed-number types, and only
    // when the child's answer is short, so a sentence that merely contains the number doesn't pass.
    if (question.type !== "short_answer" && givenTokenCount <= 3 && sameNumbers(givenNumbers, numbersIn(candidate))) return true;

    // "it is a triangle" is right for "triangle" on a short answer.
    if (question.type === "short_answer" && candidate.length >= 3 && ` ${given} `.includes(` ${candidate} `)) return true;

    return false;
  });
};

export const isAnswered = (question, answer) => {
  if (question.type === "match") {
    return Array.isArray(answer) && answer.length === question.lefts.length && answer.every((value) => Number.isInteger(value));
  }
  if (OPEN_TYPES.has(question.type)) return typeof answer === "string" && answer.trim() !== "";
  return Number.isInteger(answer);
};

/** Local, deterministic check of one answer against the key. */
export const checkAnswer = (question, answer) => {
  if (!isAnswered(question, answer)) return false;
  if (question.type === "mcq" || question.type === "true_false") return answer === question.correctIndex;
  if (question.type === "match") return question.correctMatches.every((expected, i) => answer[i] === expected);
  return matchesOpenAnswer(question, answer);
};

export const blankAnswerFor = (question) => {
  if (question.type === "match") return new Array(question.lefts.length).fill(null);
  if (OPEN_TYPES.has(question.type)) return "";
  return null;
};

export const formatCorrectAnswer = (question) => {
  if (question.type === "mcq") return `${OPTION_LABELS[question.correctIndex]}. ${question.options[question.correctIndex]}`;
  if (question.type === "true_false") return question.options[question.correctIndex];
  if (question.type === "match") return question.lefts.map((left, i) => `${left} → ${question.rights[question.correctMatches[i]]}`).join("; ");
  return question.answer;
};

export const formatStudentAnswer = (question, answer) => {
  if (!isAnswered(question, answer)) {
    // A half-finished match still shows what was picked.
    if (question.type === "match" && Array.isArray(answer) && answer.some((value) => Number.isInteger(value))) {
      return question.lefts.map((left, i) => `${left} → ${Number.isInteger(answer[i]) ? question.rights[answer[i]] : "—"}`).join("; ");
    }
    return "(no answer)";
  }
  if (question.type === "mcq") return `${OPTION_LABELS[answer]}. ${question.options[answer]}`;
  if (question.type === "true_false") return question.options[answer];
  if (question.type === "match") return question.lefts.map((left, i) => `${left} → ${question.rights[answer[i]]}`).join("; ");
  return answer.trim();
};

// ---- Scoring ----

const skillKey = (skill) => skill.trim().toLowerCase();

/**
 * Scores a paper. `acceptedIndexes` are 0-based positions of typed answers a second opinion
 * judged correct although they missed the key; they only count for typed question types.
 */
export const gradePaper = (questions, answers, acceptedIndexes = []) => {
  const accepted = new Set(acceptedIndexes);

  const results = questions.map((question, index) => {
    const answered = isAnswered(question, answers[index]);
    const viaReview = answered && OPEN_TYPES.has(question.type) && accepted.has(index);
    return { answered, correct: answered && (checkAnswer(question, answers[index]) || viaReview) };
  });

  const total = questions.length;
  const correct = results.filter((result) => result.correct).length;
  const percentage = toPercentage(correct, total);

  const bySkill = new Map();
  questions.forEach((question, index) => {
    const key = skillKey(question.skill);
    const entry = bySkill.get(key) || { skill: question.skill, topic: question.topic, total: 0, correct: 0 };
    entry.total += 1;
    if (results[index].correct) entry.correct += 1;
    bySkill.set(key, entry);
  });

  const skillResults = [...bySkill.values()]
    .map((entry) => ({ ...entry, percentage: toPercentage(entry.correct, entry.total) }))
    .sort((a, b) => a.percentage - b.percentage || a.skill.localeCompare(b.skill));

  return {
    results,
    total,
    correct,
    incorrect: total - correct,
    percentage,
    level: getPerformanceLevel(percentage).label,
    skillResults,
    // Weak = under the mastery bar, so one slip on a four-question skill isn't flagged but a
    // single miss on a one-question skill is.
    weakSkills: skillResults.filter((entry) => entry.percentage < MASTERY_THRESHOLD)
  };
};

/** Typed answers that missed the key — the ones worth a second opinion before they count as wrong. */
export const findReviewCandidates = (questions, answers, results) =>
  questions
    .map((question, index) => ({ question, index }))
    .filter(({ question, index }) => OPEN_TYPES.has(question.type) && results[index].answered && !results[index].correct)
    .map(({ question, index }) => ({
      number: index + 1,
      question: question.question,
      expected: question.answer,
      acceptable: question.acceptedAnswers || [],
      given: answers[index].trim()
    }));

export const findSkillKey = skillKey;
