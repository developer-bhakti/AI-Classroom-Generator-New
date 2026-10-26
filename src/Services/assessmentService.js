import {
  GeminiResponseError,
  generateAssessmentContent,
  analyzeAssessmentContent,
  generateTutorTurn
} from "./geminiService";
import {
  buildAssessmentPrompt,
  buildPracticePrompt,
  buildAnalysisPrompt,
  buildTutorContext,
  flattenSyllabus
} from "./assessmentPrompts";
import {
  NEEDS_IMPROVEMENT,
  defaultAreaForSubject,
  deriveStrengths,
  deriveWeakAreas,
  findReviewCandidates,
  findSkillKey,
  formatCorrectAnswer,
  formatStudentAnswer,
  gradePaper,
  normalizeQuestions,
  ratingFor
} from "./assessmentGrading";

export const ASSESSMENT_LENGTH = 20;
export const PRACTICE_LENGTH = 10;

const MAX_PAPER_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const MAX_MISTAKES_PER_SKILL = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The model occasionally returns a malformed question or comes up short. Each attempt keeps whatever
// was usable and the best one wins, so one bad question never costs the teacher the whole paper.
const requestPaper = async (prompt, count, context) => {
  let best = { title: "", questions: [] };
  let lastError = null;

  for (let attempt = 0; attempt < MAX_PAPER_ATTEMPTS && best.questions.length < count; attempt += 1) {
    // A "high demand" 503 comes back as a response error too; give the model a breath before asking again.
    if (attempt > 0) await wait(RETRY_DELAY_MS * attempt);
    try {
      const generated = await generateAssessmentContent(prompt);
      const questions = normalizeQuestions(generated.questions, { ...context, limit: count });
      if (questions.length > best.questions.length) best = { title: generated.title, questions };
    } catch (err) {
      // Only a bad response is worth another go; a timeout, bad key or rate limit would just repeat.
      if (!(err instanceof GeminiResponseError)) throw err;
      lastError = err;
    }
  }

  if (best.questions.length < count) {
    if (best.questions.length === 0 && lastError) throw lastError;
    throw new GeminiResponseError(`Gemini only produced ${best.questions.length} usable questions out of ${count}. Try again.`);
  }

  return best;
};

/**
 * Builds a 20-question paper from the syllabus loaded for the chosen month (or term) and the
 * teacher's rating of each item. `syllabus` is [{ month, topics }]; `ratings` is [{ topic, rating }];
 * `history` ({ weakSkills, lastPercentage }) lets the paper revisit what this child struggled with.
 */
export const createAssessmentPaper = async ({ kind, className, subject, academicYear, period, syllabus, ratings, history }) => {
  const items = flattenSyllabus(syllabus);
  const paper = await requestPaper(
    buildAssessmentPrompt({ kind, className, subject, academicYear, periodLabel: period.label, syllabus, ratings, history, count: ASSESSMENT_LENGTH }),
    ASSESSMENT_LENGTH,
    { syllabusTopics: items.length > 0 ? items.map((item) => item.text) : null, defaultArea: defaultAreaForSubject(subject) }
  );
  const label = kind === "end_term" ? "End-Term Assessment" : "Assessment";
  return { ...paper, title: paper.title || `${className} ${subject} ${period.label} ${label}` };
};

/** The 10-question reassessment that follows an AI teaching session on one weak topic. */
export const createPracticePaper = async ({ className, subject, skill, diagnosis }) => {
  const paper = await requestPaper(
    buildPracticePrompt({ className, subject, skill, diagnosis, count: PRACTICE_LENGTH }),
    PRACTICE_LENGTH,
    { syllabusTopics: [skill], defaultArea: defaultAreaForSubject(subject) }
  );
  return {
    title: paper.title || `${skill} practice`,
    // Mastery is tracked per topic label, so every practice question must carry the exact label.
    questions: paper.questions.map((question) => ({ ...question, topic: skill, skill }))
  };
};

const describeMistakes = (questions, answers, results, skill) => {
  const key = findSkillKey(skill);
  return questions
    .map((question, index) => ({ question, index }))
    .filter(({ question, index }) => findSkillKey(question.skill) === key && !results[index].correct)
    .slice(0, MAX_MISTAKES_PER_SKILL)
    .map(({ question, index }) => `${question.question} (child answered: ${formatStudentAnswer(question, answers[index])}; correct: ${formatCorrectAnswer(question)})`);
};

const fallbackDiagnosis = (entry) => {
  if (entry.total === 0) return "You marked this topic as needing improvement. It wasn't covered by the paper, so keep practising it.";
  if (entry.reason === "observation") return `You marked this topic as needing improvement; the child answered ${entry.correct} of ${entry.total} correctly. Keep practising it.`;
  return `Got ${entry.total - entry.correct} of ${entry.total} questions on this topic wrong.`;
};

/**
 * Scores a finished paper and works out where the child needs help.
 *
 * The score itself comes from deterministic checking; the AI is only asked to (a) give a second
 * opinion on typed answers that missed the key, (b) explain the pattern behind the mistakes and
 * (c) draft the teacher's note to the parents. Which topics need practice combines the answers with
 * the teacher's own rating of each topic. If the AI call fails the teacher still gets the score and
 * the topics, just with plainer text.
 */
export const evaluateAssessment = async ({ questions, answers, className, subject, ratings = [] }) => {
  const defaultArea = defaultAreaForSubject(subject);
  const first = gradePaper(questions, answers);
  const reviewCandidates = findReviewCandidates(questions, answers, first.results);

  // Topics worth a written diagnosis: those with a wrong answer, and those the teacher flagged.
  const askAbout = first.skillResults
    .filter((entry) => entry.correct < entry.total || ratingFor(entry.skill, ratings) === NEEDS_IMPROVEMENT)
    .map((entry) => entry.skill);

  let analysis = null;
  if (reviewCandidates.length > 0 || askAbout.length > 0) {
    try {
      analysis = await analyzeAssessmentContent(buildAnalysisPrompt({
        className,
        subject,
        percentage: first.percentage,
        mistakeSkills: askAbout,
        reviewCandidates,
        rows: questions.map((question, index) => ({
          number: index + 1,
          type: question.type,
          skill: question.skill,
          area: question.area,
          rating: ratingFor(question.skill, ratings),
          question: question.question,
          expected: formatCorrectAnswer(question),
          given: formatStudentAnswer(question, answers[index]),
          correct: first.results[index].correct
        }))
      }));
    } catch (err) {
      console.warn("Could not analyse the assessment:", err);
    }
  }

  // Only answers the review was actually asked about can be overturned.
  const reviewable = new Set(reviewCandidates.map((candidate) => candidate.number));
  const acceptedIndexes = (analysis?.acceptedQuestions || []).filter((number) => reviewable.has(number)).map((number) => number - 1);
  const graded = acceptedIndexes.length > 0 ? gradePaper(questions, answers, acceptedIndexes) : first;

  const diagnoses = new Map((analysis?.weakAreas || []).map((area) => [findSkillKey(area.skill), area.diagnosis]));
  const weakAreas = deriveWeakAreas(graded.skillResults, ratings, defaultArea).map((entry) => ({
    ...entry,
    diagnosis: diagnoses.get(findSkillKey(entry.skill)) || fallbackDiagnosis(entry),
    mistakes: describeMistakes(questions, answers, graded.results, entry.skill)
  }));

  // One plan entry per weak topic; if the AI skipped one (or was unavailable) the teacher still gets a usable starting point.
  const plans = new Map((analysis?.improvementPlan || []).map((item) => [findSkillKey(item.skill), item]));
  const improvementPlan = weakAreas.map((area) => {
    const planned = plans.get(findSkillKey(area.skill));
    return {
      skill: area.skill,
      activities: planned?.activities?.length ? planned.activities : [`Practise ${area.skill} a little every day, using real objects and songs.`, "Ask the child to explain what they are doing, out loud."],
      resources: planned?.resources?.length ? planned.resources : ["Worked examples from the class notebook or textbook"]
    };
  });

  const recommendations = analysis?.recommendations?.length
    ? analysis.recommendations
    : weakAreas.length > 0
      ? weakAreas.map((area) => `Revisit "${area.skill}" with a few short practice activities.`)
      : ["Keep up the good work and move on to the next topics."];

  const { weakSkills: _weakSkills, ...rest } = graded;
  return {
    ...rest,
    weakAreas,
    strengths: deriveStrengths(graded.skillResults, ratings),
    recommendations,
    improvementPlan,
    summary: analysis?.summary || `Scored ${graded.correct} out of ${graded.total} (${graded.percentage}%).`,
    // A starting point for the "Teacher's remarks" box; the teacher edits it before it is printed.
    remarksDraft: analysis?.remarks || "",
    analysisFailed: analysis === null && (reviewCandidates.length > 0 || askAbout.length > 0)
  };
};

// ---- AI teacher ----

export const TUTOR_OPENING = { role: "user", text: "Hi! I'm ready to learn." };

/** Wraps a teacher turn the way the model should see its own earlier replies. */
export const tutorHistoryEntry = (turn) => ({ role: "model", text: JSON.stringify(turn) });

export const askTutor = ({ className, subject, weakArea, history }) =>
  generateTutorTurn({
    systemContext: buildTutorContext({
      className,
      subject,
      skill: weakArea.skill,
      diagnosis: weakArea.diagnosis,
      mistakes: weakArea.mistakes
    }),
    history
  });
