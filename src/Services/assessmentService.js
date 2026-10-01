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
  buildTutorContext
} from "./assessmentPrompts";
import {
  normalizeQuestions,
  gradePaper,
  findReviewCandidates,
  findSkillKey,
  formatCorrectAnswer,
  formatStudentAnswer
} from "./assessmentGrading";

export const ASSESSMENT_LENGTH = 20;
export const PRACTICE_LENGTH = 10;

const MAX_PAPER_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2000;
const MAX_MISTAKES_PER_SKILL = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The model occasionally returns a malformed question or comes up short. Each attempt keeps whatever
// was usable and the best one wins, so one bad question never costs the teacher the whole paper.
const requestPaper = async (prompt, count) => {
  let best = { title: "", questions: [] };
  let lastError = null;

  for (let attempt = 0; attempt < MAX_PAPER_ATTEMPTS && best.questions.length < count; attempt += 1) {
    // A "high demand" 503 comes back as a response error too; give the model a breath before asking again.
    if (attempt > 0) await wait(RETRY_DELAY_MS);
    try {
      const generated = await generateAssessmentContent(prompt);
      const questions = normalizeQuestions(generated.questions);
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

  return {
    title: best.title,
    questions: best.questions.slice(0, count).map((question, index) => ({ ...question, id: `q${index + 1}` }))
  };
};

/**
 * Builds a 20-question paper. `history` ({ weakSkills, lastPercentage }) lets the paper revisit
 * what this child struggled with before.
 */
export const createAssessmentPaper = async ({ kind, className, subject, topics, progressNote, history }) => {
  const paper = await requestPaper(
    buildAssessmentPrompt({ kind, className, subject, topics, progressNote, history, count: ASSESSMENT_LENGTH }),
    ASSESSMENT_LENGTH
  );
  const label = kind === "end_term" ? "End-Term Assessment" : "Current Academic Assessment";
  return { ...paper, title: paper.title || `${className} ${subject} ${label}` };
};

/** The 10-question reassessment that follows an AI teaching session on one weak skill. */
export const createPracticePaper = async ({ className, subject, skill, diagnosis }) => {
  const paper = await requestPaper(
    buildPracticePrompt({ className, subject, skill, diagnosis, count: PRACTICE_LENGTH }),
    PRACTICE_LENGTH
  );
  return {
    title: paper.title || `${skill} practice`,
    // Mastery is tracked per skill label, so every practice question must carry the exact label.
    questions: paper.questions.map((question) => ({ ...question, skill }))
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

/**
 * Scores a finished paper and works out where the child went wrong.
 *
 * The score itself comes from deterministic checking; the AI is only asked to (a) give a second
 * opinion on typed answers that missed the key and (b) explain the pattern behind the mistakes.
 * If that call fails the teacher still gets the score and the weak skills, just with plainer text.
 */
export const evaluateAssessment = async ({ questions, answers, className, subject }) => {
  const first = gradePaper(questions, answers);
  const reviewCandidates = findReviewCandidates(questions, answers, first.results);
  const mistakeSkills = first.skillResults.filter((entry) => entry.correct < entry.total).map((entry) => entry.skill);

  let analysis = null;
  if (reviewCandidates.length > 0 || mistakeSkills.length > 0) {
    try {
      analysis = await analyzeAssessmentContent(buildAnalysisPrompt({
        className,
        subject,
        percentage: first.percentage,
        mistakeSkills,
        reviewCandidates,
        rows: questions.map((question, index) => ({
          number: index + 1,
          type: question.type,
          skill: question.skill,
          topic: question.topic,
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
  const weakAreas = graded.weakSkills.map((entry) => ({
    ...entry,
    diagnosis: diagnoses.get(findSkillKey(entry.skill)) || `Got ${entry.total - entry.correct} of ${entry.total} questions on this skill wrong.`,
    mistakes: describeMistakes(questions, answers, graded.results, entry.skill)
  }));

  const recommendations = analysis?.recommendations?.length
    ? analysis.recommendations
    : weakAreas.length > 0
      ? weakAreas.map((area) => `Revisit "${area.skill}" with a few short practice questions.`)
      : ["Keep up the good work and move on to the next topics."];

  const { weakSkills: _weakSkills, ...rest } = graded;
  return {
    ...rest,
    weakAreas,
    recommendations,
    summary: analysis?.summary || `Scored ${graded.correct} out of ${graded.total} (${graded.percentage}%).`,
    analysisFailed: analysis === null && (reviewCandidates.length > 0 || mistakeSkills.length > 0)
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
