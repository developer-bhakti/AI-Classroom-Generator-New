// Pure assessment logic: shaping the model's questions, checking answers, scoring and levels.
// Nothing in here talks to the network, so it can be reasoned about (and tested) on its own.

import { isEmojiString } from "./emoji";

// Order matters: it is the order of the sections on a printed paper.
export const QUESTION_TYPES = {
  picture: "Identify the picture",
  mcq: "Multiple choice",
  true_false: "True / False",
  fill_blank: "Fill in the blank",
  match: "Match the following",
  problem_solving: "Problem solving",
  short_answer: "Short answer",
  activity: "Activity"
};

// Types that may be answered by typing. A typed answer that misses the key may still be right
// ("hundreds" vs "hundred", "45" vs "45 apples"), so these are the only ones a second opinion may
// overturn. A fill-in-the-blank that comes with choices is graded like multiple choice instead.
export const OPEN_TYPES = new Set(["fill_blank", "problem_solving", "short_answer"]);

// Choice questions whose options are shown as A, B, C, D.
const LETTERED_TYPES = new Set(["mcq", "picture", "fill_blank"]);

export const OPTION_LABELS = ["A", "B", "C", "D"];

// Activities are done, not answered: the adult watches the child and records the outcome.
export const ACTIVITY_OPTIONS = ["Did it on their own", "Needed help or not yet"];

// A skill counts as understood at this accuracy; it matches the bottom of the "Good" band.
export const MASTERY_THRESHOLD = 75;

// ---- Performance levels ----

const LEVELS = [
  { min: 90, label: "Excellent", tone: "excellent" },
  { min: 75, label: "Good", tone: "good" },
  { min: 60, label: "Average", tone: "average" },
  { min: 0, label: "Needs Improvement", tone: "improve" }
];

// Names used by earlier versions of the app, still found on rows saved back then.
const LEGACY_LEVELS = {
  "Good Performance": "Good",
  "Average Performance": "Average",
  "Improvement Required": "Needs Improvement"
};

export const getPerformanceLevel = (percentage) => LEVELS.find((level) => percentage >= level.min) || LEVELS[LEVELS.length - 1];

// The bands as a reader sees them ("Good: 75–89%"), for legends on the report.
export const LEVEL_BANDS = LEVELS.map((level, index) => ({
  label: level.label,
  tone: level.tone,
  from: level.min,
  to: index === 0 ? 100 : LEVELS[index - 1].min - 1
}));

/** "Good: 75–89%", or "Needs Improvement: below 60%" for the bottom band. */
export const describeBand = (band) => (band.from === 0 ? `${band.label}: below ${band.to + 1}%` : `${band.label}: ${band.from}–${band.to}%`);

export const canonicalLevel = (label) => LEGACY_LEVELS[label] || label;

export const toneForLevelLabel = (label) => LEVELS.find((level) => level.label === canonicalLevel(label))?.tone || "average";

// ---- What the teacher observes ----

export const NEEDS_IMPROVEMENT = "Needs Improvement";

// The four judgements a teacher can give for each syllabus topic before the paper is taken.
export const RATINGS = [
  { value: "Excellent", emoji: "🌟", tone: "excellent" },
  { value: "Good", emoji: "😊", tone: "good" },
  { value: "Average", emoji: "🙂", tone: "average" },
  { value: NEEDS_IMPROVEMENT, emoji: "🌱", tone: "improve" }
];

// ---- Development areas ----
// Every question is tagged with one, so a paper can report "Numeracy: 40%" as well as the specific
// topic underneath it.

export const SKILL_AREAS = [
  "Language & Communication",
  "Literacy",
  "Numeracy",
  "Cognitive Skills",
  "Social & Emotional Skills",
  "Environmental Awareness",
  "Movement & Physical Development"
];

export const AREA_EMOJI = {
  "Language & Communication": "🗣️",
  "Literacy": "🔤",
  "Numeracy": "🔢",
  "Cognitive Skills": "🧠",
  "Social & Emotional Skills": "💛",
  "Environmental Awareness": "🌿",
  "Movement & Physical Development": "🤸"
};

const SUBJECT_AREAS = {
  "English": "Literacy",
  "Math": "Numeracy",
  "EVS": "Environmental Awareness",
  "Science": "Environmental Awareness",
  "Social Studies": "Environmental Awareness"
};

/** The area to fall back on when the model leaves one out or invents one. */
export const defaultAreaForSubject = (subject) => SUBJECT_AREAS[subject] || "Cognitive Skills";

// ---- Small helpers ----

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

const skillKey = (skill) => skill.trim().toLowerCase();

export const findSkillKey = skillKey;

// Lower-cases and strips punctuation, so "Count 1 to 5!" and "count 1 to 5" compare equal. Also used
// to compare typed answers with the key.
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

// ---- Tying questions back to the syllabus ----

const topicTokens = (text) => normalizeText(text).split(" ").filter((token) => token.length > 1 || /\d/.test(token));

/**
 * Finds which syllabus item a label means when the model paraphrased it: exact match first, then
 * one containing the other, then the best word overlap. Null when nothing is close.
 */
export const matchSyllabusTopic = (label, topics) => {
  const wanted = normalizeText(label);
  if (!wanted) return null;

  const candidates = topics.map((topic) => ({ topic, text: normalizeText(topic) }));

  const exact = candidates.find((candidate) => candidate.text === wanted);
  if (exact) return exact.topic;

  const contained = candidates.find((candidate) => (
    candidate.text.length >= 6 && wanted.length >= 6 && (candidate.text.includes(wanted) || wanted.includes(candidate.text))
  ));
  if (contained) return contained.topic;

  const wantedTokens = new Set(topicTokens(label));
  let best = null;
  let bestScore = 0;
  candidates.forEach((candidate) => {
    const tokens = new Set(topicTokens(candidate.topic));
    const shared = [...wantedTokens].filter((token) => tokens.has(token)).length;
    const union = new Set([...wantedTokens, ...tokens]).size;
    const score = union > 0 ? shared / union : 0;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });
  return best && bestScore >= 0.5 ? best.topic : null;
};

// ---- Shaping the model's questions ----

const distinctOptions = (value, min, max) => {
  const options = Array.isArray(value) ? value.map(cleanString) : [];
  if (options.length < min || options.length > max || options.some((option) => !option)) return null;
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) return null;
  return options;
};

// Models love to make the first option the right one. Shuffling here (rather than trusting the prompt)
// means a child can't score by always tapping A.
export const shuffleChoices = (options, correctIndex) => {
  const order = shuffle(options.map((_, i) => i));
  return { options: order.map((i) => options[i]), correctIndex: order.indexOf(correctIndex) };
};

const withChoices = (base, raw, shuffleOptions) => {
  const options = distinctOptions(raw.options, 3, 4);
  if (!options || !Number.isInteger(raw.correctIndex) || raw.correctIndex < 0 || raw.correctIndex >= options.length) return null;
  return { ...base, ...(shuffleOptions ? shuffleChoices(options, raw.correctIndex) : { options, correctIndex: raw.correctIndex }) };
};

const normalizeQuestion = (raw, index, { syllabusTopics, defaultArea, shuffleOptions }) => {
  const type = raw.type;
  if (!QUESTION_TYPES[type]) return null;

  const question = cleanString(raw.question);
  if (!question) return null;

  // With a syllabus, a question belongs to the item it names (by number, else by wording); the item's
  // own text becomes the topic and skill, so teacher ratings and weak topics line up exactly.
  let topic = cleanString(raw.topic);
  let skill = cleanString(raw.skill) || topic;
  if (syllabusTopics?.length) {
    const byNumber = Number.isInteger(raw.topicNumber) && raw.topicNumber >= 1 && raw.topicNumber <= syllabusTopics.length
      ? syllabusTopics[raw.topicNumber - 1]
      : null;
    const resolved = byNumber || matchSyllabusTopic(skill, syllabusTopics) || matchSyllabusTopic(topic, syllabusTopics);
    if (resolved) {
      topic = resolved;
      skill = resolved;
    }
  }
  if (!topic) return null;

  const picture = isEmojiString(raw.picture) ? raw.picture.trim() : "";

  const base = {
    id: `q${index + 1}`,
    type,
    topic,
    skill: skill || topic,
    area: SKILL_AREAS.find((area) => area.toLowerCase() === cleanString(raw.area).toLowerCase()) || defaultArea,
    question,
    ...(picture ? { picture } : {}),
    explanation: cleanString(raw.explanation)
  };

  if (type === "mcq") return withChoices(base, raw, shuffleOptions);

  if (type === "picture") return picture ? withChoices(base, raw, shuffleOptions) : null;

  if (type === "activity") return { ...base, options: ACTIVITY_OPTIONS, correctIndex: 0 };

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

  // A fill-in-the-blank that offers choices ("which letter is missing?") is the usual kind for young
  // children, who can tap but not type.
  if (type === "fill_blank" && Array.isArray(raw.options) && raw.options.length > 0) {
    const chosen = withChoices(base, raw, shuffleOptions);
    if (chosen) return chosen;
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
 *
 * `syllabusTopics` ties each question to a syllabus item; `defaultArea` is used when the model
 * leaves out or invents a development area; `limit` keeps the first N valid questions in the
 * model's own order (so an over-long reply loses its last questions, not a whole section);
 * `shuffleOptions` randomises where the right answer sits (tests turn it off to stay deterministic).
 */
export const normalizeQuestions = (rawQuestions, { syllabusTopics = null, defaultArea = "Cognitive Skills", limit = Infinity, shuffleOptions = true } = {}) =>
  rawQuestions
    .map((raw, index) => normalizeQuestion(raw, index, { syllabusTopics, defaultArea, shuffleOptions }))
    .filter(Boolean)
    .slice(0, limit)
    // Array.prototype.sort is stable, so questions keep the model's order within a type.
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
    .map((question, index) => ({ ...question, id: `q${index + 1}` }));

// ---- Checking answers ----

const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;

const numbersIn = (normalized) => (normalized.match(NUMBER_PATTERN) || []).map(Number);

const sameNumbers = (a, b) => a.length > 0 && a.length === b.length && a.every((value, i) => value === b[i]);

/** Answered by tapping one of `options`: multiple choice, pictures, activities, true/false, choice-based blanks. */
export const isChoiceQuestion = (question) => Array.isArray(question.options) && Number.isInteger(question.correctIndex);

/** Answered by typing. */
export const isTypedQuestion = (question) => OPEN_TYPES.has(question.type) && !isChoiceQuestion(question);

export const usesLetterLabels = (question) => LETTERED_TYPES.has(question.type);

const matchesTypedAnswer = (question, answer) => {
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
  if (isTypedQuestion(question)) return typeof answer === "string" && answer.trim() !== "";
  return Number.isInteger(answer);
};

/** Local, deterministic check of one answer against the key. */
export const checkAnswer = (question, answer) => {
  if (!isAnswered(question, answer)) return false;
  if (question.type === "match") return question.correctMatches.every((expected, i) => answer[i] === expected);
  if (isChoiceQuestion(question)) return answer === question.correctIndex;
  return matchesTypedAnswer(question, answer);
};

export const blankAnswerFor = (question) => {
  if (question.type === "match") return new Array(question.lefts.length).fill(null);
  if (isTypedQuestion(question)) return "";
  return null;
};

const describeOption = (question, index) =>
  (usesLetterLabels(question) ? `${OPTION_LABELS[index]}. ${question.options[index]}` : question.options[index]);

export const formatCorrectAnswer = (question) => {
  if (question.type === "match") return question.lefts.map((left, i) => `${left} → ${question.rights[question.correctMatches[i]]}`).join("; ");
  if (isChoiceQuestion(question)) return describeOption(question, question.correctIndex);
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
  if (question.type === "match") return question.lefts.map((left, i) => `${left} → ${question.rights[answer[i]]}`).join("; ");
  if (isChoiceQuestion(question)) return describeOption(question, answer);
  return answer.trim();
};

// ---- Scoring ----

/**
 * Accuracy per development area (Numeracy, Literacy, ...). Computed from the questions and
 * per-question outcomes, so it can be rebuilt for any saved assessment. Areas outside the standard
 * list (from older papers) are kept, after the standard ones.
 */
export const summarizeAreas = (questions, results) => {
  const byArea = new Map();
  questions.forEach((question, index) => {
    const name = question.area || "Cognitive Skills";
    const entry = byArea.get(name) || { area: name, total: 0, correct: 0 };
    entry.total += 1;
    if (results[index]?.correct) entry.correct += 1;
    byArea.set(name, entry);
  });

  const names = [...SKILL_AREAS.filter((name) => byArea.has(name)), ...[...byArea.keys()].filter((name) => !SKILL_AREAS.includes(name))];
  return names.map((name) => ({ ...byArea.get(name), percentage: toPercentage(byArea.get(name).correct, byArea.get(name).total) }));
};

/**
 * Scores a paper. `acceptedIndexes` are 0-based positions of typed answers a second opinion
 * judged correct although they missed the key; they only count for typed questions.
 */
export const gradePaper = (questions, answers, acceptedIndexes = []) => {
  const accepted = new Set(acceptedIndexes);

  const results = questions.map((question, index) => {
    const answered = isAnswered(question, answers[index]);
    const viaReview = answered && isTypedQuestion(question) && accepted.has(index);
    return { answered, correct: answered && (checkAnswer(question, answers[index]) || viaReview) };
  });

  const total = questions.length;
  const correct = results.filter((result) => result.correct).length;
  const percentage = toPercentage(correct, total);

  const bySkill = new Map();
  questions.forEach((question, index) => {
    const key = skillKey(question.skill);
    const entry = bySkill.get(key) || { skill: question.skill, topic: question.topic, area: question.area || "Cognitive Skills", total: 0, correct: 0 };
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
    areaResults: summarizeAreas(questions, results),
    // Weak = under the mastery bar, so one slip on a four-question skill isn't flagged but a
    // single miss on a one-question skill is.
    weakSkills: skillResults.filter((entry) => entry.percentage < MASTERY_THRESHOLD)
  };
};

/** Typed answers that missed the key — the ones worth a second opinion before they count as wrong. */
export const findReviewCandidates = (questions, answers, results) =>
  questions
    .map((question, index) => ({ question, index }))
    .filter(({ question, index }) => isTypedQuestion(question) && results[index].answered && !results[index].correct)
    .map(({ question, index }) => ({
      number: index + 1,
      question: question.question,
      expected: question.answer,
      acceptable: question.acceptedAnswers || [],
      given: answers[index].trim()
    }));

// ---- Combining the paper with the teacher's observation ----

export const ratingFor = (skill, ratings = []) => ratings.find((entry) => skillKey(entry.topic) === skillKey(skill))?.rating || null;

/**
 * Topics to practise: those the child scored under the mastery bar on, plus any the teacher marked
 * "Needs Improvement" (the child may have guessed their way through a question or two). A topic the
 * teacher flagged that the paper never asked about is kept, with no score.
 */
export const deriveWeakAreas = (skillResults, ratings = [], defaultArea = "Cognitive Skills") => {
  const seen = new Set();
  const weak = [];

  skillResults.forEach((entry) => {
    seen.add(skillKey(entry.skill));
    const rating = ratingFor(entry.skill, ratings);
    const byAnswers = entry.percentage < MASTERY_THRESHOLD;
    const byTeacher = rating === NEEDS_IMPROVEMENT;
    if (byAnswers || byTeacher) {
      weak.push({ ...entry, rating, reason: byAnswers && byTeacher ? "both" : byAnswers ? "answers" : "observation" });
    }
  });

  ratings.forEach((entry) => {
    if (entry.rating === NEEDS_IMPROVEMENT && !seen.has(skillKey(entry.topic))) {
      weak.push({ skill: entry.topic, topic: entry.topic, area: defaultArea, total: 0, correct: 0, percentage: null, rating: entry.rating, reason: "observation" });
    }
  });

  // Weakest first; topics with no score go last.
  return weak.sort((a, b) => (a.percentage ?? 101) - (b.percentage ?? 101) || a.skill.localeCompare(b.skill));
};

/** What the child is doing well: answered at the mastery bar or better, and not flagged by the teacher. */
export const deriveStrengths = (skillResults, ratings = []) =>
  skillResults
    .filter((entry) => entry.total > 0 && entry.percentage >= MASTERY_THRESHOLD && ratingFor(entry.skill, ratings) !== NEEDS_IMPROVEMENT)
    .map((entry) => ({ ...entry, rating: ratingFor(entry.skill, ratings) }))
    .sort((a, b) => b.percentage - a.percentage || a.skill.localeCompare(b.skill));
