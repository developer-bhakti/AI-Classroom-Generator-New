// Prompts for the student-assessment flow (paper, analysis, practice set, AI teacher).
// Child names are deliberately never put in these prompts: the model only needs the class,
// subject and what the child got wrong, not who the child is.

// How many of each type to ask for, as a share of the paper. Order matters: papers are
// grouped by type, the way a printed paper would be.
const ASSESSMENT_MIX = [
  ["mcq", 0.3],
  ["fill_blank", 0.15],
  ["true_false", 0.15],
  ["match", 0.1],
  ["problem_solving", 0.2],
  ["short_answer", 0.1]
];

const MIX_LABELS = {
  mcq: 'multiple choice ("mcq")',
  fill_blank: 'fill in the blank ("fill_blank")',
  true_false: 'true/false ("true_false")',
  match: 'match the following ("match")',
  problem_solving: 'problem solving ("problem_solving")',
  short_answer: 'short answer ("short_answer")'
};

export const planQuestionMix = (count) => {
  const plan = ASSESSMENT_MIX.map(([type, share]) => ({ type, count: Math.floor(count * share) }));
  // Rounding down loses a few questions; give them to multiple choice, the safest type to over-supply.
  plan[0].count += count - plan.reduce((sum, entry) => sum + entry.count, 0);
  return plan.filter((entry) => entry.count > 0);
};

const describeMix = (count) => planQuestionMix(count).map((entry) => `${entry.count} × ${MIX_LABELS[entry.type]}`).join(", ");

const QUESTION_RULES = `Rules for every question:
- Test understanding and application, not memorisation. Use a spread of easy, medium and a few harder questions, pitched at the age of the class.
- "topic" is the syllabus topic the question belongs to. "skill" is the specific skill it checks, in 2-4 words (for example "Addition with regrouping" or "Place value"). Give questions that check the same skill the exact same "skill" wording.
- Plain text only: no markdown, no LaTeX, no pictures or diagrams the child cannot see. Use symbols like × and ÷ and write powers as words or with ².
- "explanation" is one sentence showing the working or the reason the answer is right.
- mcq: exactly 4 distinct options, one correct, "correctIndex" 0-3, distractors based on typical mistakes. Do not put "A.", "B." in the options.
- true_false: set "correctIndex" to 0 when the statement is true and 1 when it is false, and use a good mix of true and false statements.
- fill_blank: write the blank as _____ inside the question. "answer" is the single word or number that fills it; "acceptedAnswers" lists other correct spellings or forms.
- match: provide "pairs" of 3 or 4 {left, right} items. Every "right" must be different and each left must have exactly one right.
- problem_solving: a short word problem or multi-step reasoning task with one final answer in "answer" (for example "45 apples"); put the bare value in "acceptedAnswers" too (for example "45"). In subjects other than maths, use a short scenario that needs applying what was learned.
- short_answer: a question answered by a word or one short sentence. "answer" is the model answer and "acceptedAnswers" lists acceptable wordings.
- Leave out fields that do not apply to a question's type.`;

const JSON_ONLY = "Respond only with the requested JSON structure — no markdown, no extra commentary.";

export const buildAssessmentPrompt = ({ kind, className, subject, topics, progressNote, count, history }) => {
  const topicList = topics?.length
    ? `Draw questions ONLY from these syllabus topics, spreading them as evenly as you can:\n${topics.map((topic) => `- ${topic}`).join("\n")}`
    : `No topic list was supplied, so use the standard ${className} ${subject} syllabus${kind === "end_term" ? " and cover the whole term broadly" : ""}.`;

  return [
    `Create an assessment paper of exactly ${count} questions for ${className} students studying ${subject}.`,
    kind === "end_term"
      ? "This is an END-TERM assessment: it checks the whole term's syllabus."
      : "This is a CURRENT ACADEMIC assessment: it checks only what the class has been taught so far, so do not ask about anything beyond the topics below.",
    topicList,
    progressNote ? `The teacher's note on syllabus progress: ${progressNote}` : null,
    history?.weakSkills?.length
      ? `This child previously struggled with: ${history.weakSkills.join(", ")}. Where those skills fall inside the syllabus above, include one or two fresh questions on each to see whether they have improved.`
      : null,
    history?.lastPercentage != null
      ? `The child's previous score in this subject was ${history.lastPercentage}%, so pitch the difficulty to be fair for that level while still stretching them a little.`
      : null,
    `Use exactly this mix, grouped in this order: ${describeMix(count)}.`,
    QUESTION_RULES,
    `${JSON_ONLY} "title" is a short paper title.`
  ].filter(Boolean).join("\n\n");
};

export const buildPracticePrompt = ({ className, subject, skill, diagnosis, count }) => [
  `Create a practice set of exactly ${count} NEW questions for a ${className} child studying ${subject}. Every question must practise this one skill: "${skill}".`,
  diagnosis ? `In the last assessment the child showed this weakness: ${diagnosis} Make the questions probe exactly that, starting gentle and getting a little harder.` : null,
  `Use this mix, grouped in this order: ${describeMix(count)}. If a type does not suit the skill, replace it with multiple choice.`,
  `Every question's "skill" must be exactly "${skill}". Use the same string for "topic" if you have no better syllabus topic name.`,
  QUESTION_RULES,
  `${JSON_ONLY} "title" is a short set title.`
].filter(Boolean).join("\n\n");

export const buildAnalysisPrompt = ({ className, subject, percentage, rows, reviewCandidates, mistakeSkills }) => {
  const paper = rows.map((row) => (
    `Q${row.number} [${row.type}] skill: ${row.skill} | topic: ${row.topic}\n  Question: ${row.question}\n  Answer key: ${row.expected}\n  Child's answer: ${row.given}\n  Result: ${row.correct ? "correct" : "WRONG"}`
  )).join("\n");

  const review = reviewCandidates.length
    ? `These typed answers did not match the answer key word for word. Decide which of them are actually correct (right value, equivalent wording, minor spelling slip) and list those question numbers in "acceptedQuestions". Be strict about answers that are genuinely wrong.\n${reviewCandidates.map((c) => `Q${c.number}: ${c.question} | key: ${c.expected}${c.acceptable.length ? ` (also acceptable: ${c.acceptable.join(", ")})` : ""} | child wrote: ${c.given}`).join("\n")}`
    : 'No typed answers need review: return an empty "acceptedQuestions" list.';

  const weakAreas = mistakeSkills.length
    ? `For "weakAreas", give one entry for EACH of these skills (copy the skill text exactly): ${mistakeSkills.map((skill) => `"${skill}"`).join(", ")}. The "diagnosis" is one sentence naming the specific error pattern visible in the child's wrong answers (for example "adds the digits but forgets to carry over").`
    : 'The child made no mistakes, so return an empty "weakAreas" list.';

  return [
    `A ${className} child has just taken a ${subject} assessment and scored ${percentage}%. Diagnose where they are struggling, based on their actual answers.`,
    `THE PAPER AND THE CHILD'S ANSWERS:\n${paper}`,
    review,
    weakAreas,
    '"summary" is two or three sentences for the teacher on how the child did overall and what stands out. "recommendations" is 3 to 5 short, concrete next steps for the teacher or parents.',
    JSON_ONLY
  ].join("\n\n");
};

export const buildTutorContext = ({ className, subject, skill, diagnosis, mistakes }) => `THE LESSON
The child is in ${className} and is learning ${subject}. The only skill to teach is: "${skill}".
${diagnosis ? `In their assessment they showed this weakness: ${diagnosis}\n` : ""}${mistakes?.length ? `Questions they got wrong:\n${mistakes.map((m) => `- ${m}`).join("\n")}\n` : ""}
HOW TO TEACH (follow every time)
1. Your first reply (the child's first message just says they are ready): greet them in one short line, explain the idea in very simple words, give one or two worked examples, then ask ONE easy practice question. Put that question in "practiceQuestion" and set "answerStatus" to "none".
2. After that, the child's message is the answer to your last practice question. Judge it: set "answerStatus" to "correct" or "incorrect". In "message", say whether it was right; if it was wrong, kindly show the correct working step by step so they see the mistake; then add a short encouraging line.
3. Then ask the NEXT practice question in "practiceQuestion": a little harder after a correct answer, the same idea shown a different way after a wrong one. Never repeat a question and never include the answer to it.
4. If the child asks you something or says something unrelated to the practice answer, reply helpfully in "message" about the skill, set "answerStatus" to "none", and put the current practice question again in "practiceQuestion".
5. Set "understandingDemonstrated" to true only once the child has answered at least 3 practice questions correctly in total and their latest two answers were both correct. In that reply, congratulate them, say they are ready for a short practice test, and set "practiceQuestion" to an empty string. Until then it must be false.
6. Keep "message" under about 120 words, in plain text with no markdown. Put the practice question only in "practiceQuestion", not inside "message".`;
