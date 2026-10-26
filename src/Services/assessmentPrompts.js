// Prompts for the student-assessment flow (paper, analysis, practice set, syllabus draft, AI teacher).
// Child names are deliberately never put in these prompts: the model only needs the class,
// subject and what the child got wrong, not who the child is.

import { describeLearners, isYoungLearner } from "./curriculum";
import { ratingFor } from "./assessmentGrading";

// How many of each type to ask for, as a share of the paper. Order matters: papers are grouped by
// type, the way a printed paper would be. Children who are still learning to read get pictures,
// matching and simple activities that a grown-up reads aloud; older classes get a text-led paper.
const MIXES = {
  young: [["picture", 0.2], ["mcq", 0.3], ["fill_blank", 0.2], ["match", 0.15], ["activity", 0.15]],
  older: [["mcq", 0.6], ["fill_blank", 0.15], ["true_false", 0.1], ["match", 0.1], ["problem_solving", 0.05]]
};

const MIX_LABELS = {
  picture: 'identify the picture ("picture")',
  mcq: 'multiple choice ("mcq")',
  true_false: 'true/false ("true_false")',
  fill_blank: 'fill in the blank ("fill_blank")',
  match: 'match the following ("match")',
  problem_solving: 'problem solving ("problem_solving")',
  short_answer: 'short answer ("short_answer")',
  activity: 'simple activity ("activity")'
};

export const planQuestionMix = (count, className) => {
  const plan = MIXES[isYoungLearner(className) ? "young" : "older"].map(([type, share]) => ({ type, count: Math.floor(count * share) }));
  // Rounding down loses a few questions; give them to multiple choice, the safest type to over-supply.
  plan.find((entry) => entry.type === "mcq").count += count - plan.reduce((sum, entry) => sum + entry.count, 0);
  return plan.filter((entry) => entry.count > 0);
};

const describeMix = (count, className) => planQuestionMix(count, className).map((entry) => `${entry.count} × ${MIX_LABELS[entry.type]}`).join(", ");

/** Numbers every syllabus item across the months in order; the same numbering is used to read the model's answers back. */
export const flattenSyllabus = (syllabus) => {
  const items = [];
  (syllabus || []).forEach(({ month, topics }) => topics.forEach((text) => items.push({ number: items.length + 1, month, text })));
  return items;
};

const QUESTION_RULES = `Rules for every question:
- Test understanding at the level of the class, not memorisation. Mix easy questions with a few that need a little thought.
- A teacher or parent reads each question aloud to the child, so write it in very simple words, under 15 words, about one idea.
- "area" is the development area the question builds, exactly one of: "Language & Communication" (listening, speaking, vocabulary, rhymes), "Literacy" (letters, sounds, words, reading and writing readiness), "Numeracy" (counting, numbers, shapes, size, patterns, measuring), "Cognitive Skills" (thinking, sorting, matching, memory, colours, problem solving), "Social & Emotional Skills" (feelings, manners, sharing, helping, family and friends), "Environmental Awareness" (plants, animals, weather, seasons, people, places, health and safety), or "Movement & Physical Development" (body parts, balance, hopping, clapping, fine-motor tasks). Choose the one that truly fits the question.
- Pictures are emoji. Use emoji ONLY in "picture", in the "options" of a picture question, or as the "left" of a match pair — never inside "question" or any other text. Use common, unmistakable emoji (everyday objects, fruit, animals, vehicles, shapes and colours such as 🍎 🐶 🚗 ⭐ 🔴 🟦). To count, repeat one emoji in "picture" (up to 10 times) and give the numbers as digits in "options".
- Plain text otherwise: no markdown, no LaTeX. Use symbols like × and ÷.
- "explanation" is one short sentence saying why the answer is right.
- picture: the emoji goes in "picture" and the question asks about it ("What is this?", "How many stars?"). Give 3 or 4 distinct "options" and "correctIndex" (counted from 0).
- mcq: 3 or 4 distinct "options", exactly one correct, "correctIndex" counted from 0. Do not write "A." or "B." inside the options. Vary which position holds the right answer; do not always make the first option correct.
- true_false: set "correctIndex" to 0 when the statement is true and 1 when it is false, with a good mix of true and false.
- fill_blank: write the blank as _____ in the question and give 3 or 4 "options" for the missing letter, number or word, with "correctIndex". Only for older classes may you give a typed "answer" (and "acceptedAnswers") instead.
- match: "pairs" of exactly 3 {left, right} items. Every "right" is different; a "left" may be a single emoji and a "right" a short word.
- activity: "question" is a short instruction for the adult to give the child ("Ask the child to clap three times"), and "explanation" says what to look for. No options are needed.
- problem_solving and short_answer: one final value or short phrase in "answer", with other acceptable wordings in "acceptedAnswers".
- Leave out fields that do not apply to a question's type.`;

const JSON_ONLY = "Respond only with the requested JSON structure — no markdown, no extra commentary.";

export const buildAssessmentPrompt = ({ kind, className, subject, academicYear, periodLabel, syllabus, ratings = [], count, history }) => {
  const items = flattenSyllabus(syllabus);
  const multiMonth = new Set(items.map((item) => item.month)).size > 1;

  const syllabusBlock = items.length > 0
    ? [
      `SYLLABUS ITEMS — everything this class has already been taught for ${periodLabel || "this period"}:`,
      ...items.map((item) => `${item.number}. ${multiMonth ? `(${item.month}) ` : ""}${item.text}`),
      'On every question set "topicNumber" to the number of the item it tests, and set "topic" and "skill" to that item\'s text, word for word.'
    ].join("\n")
    : `No syllabus items were supplied, so use the standard ${className} ${subject} syllabus for ${periodLabel || "this period"}.`;

  const observed = items
    .map((item) => ({ item, rating: ratingFor(item.text, ratings) }))
    .filter((entry) => entry.rating);
  const observationBlock = observed.length > 0
    ? [
      "THE TEACHER'S OBSERVATION OF THIS CHILD:",
      ...observed.map((entry) => `- Item ${entry.item.number}: ${entry.rating}`),
      "Cover every item at least once. Ask one or two extra questions on items rated Needs Improvement or Average, and just one easy question on items rated Excellent."
    ].join("\n")
    : null;

  return [
    `Create an assessment paper of exactly ${count} questions for ${describeLearners(className)} studying ${subject}.`,
    academicYear ? `Academic year: ${academicYear}.` : null,
    kind === "end_term"
      ? `This is the END-OF-TERM assessment for ${periodLabel}. It checks ONLY the syllabus items below, spread across the whole term. Never ask about anything outside them.`
      : `This is the ${periodLabel || "monthly"} assessment. It checks ONLY the syllabus items below, which the class has already been taught. Never ask about anything outside them.`,
    syllabusBlock,
    observationBlock,
    history?.weakSkills?.length
      ? `This child previously struggled with: ${history.weakSkills.join(", ")}. Where those overlap with the items above, include a fresh question to see whether they have improved.`
      : null,
    history?.lastPercentage != null
      ? `The child's previous score in this subject was ${history.lastPercentage}%, so keep the difficulty fair for that level while stretching them a little.`
      : null,
    `Use exactly this mix, grouped in this order: ${describeMix(count, className)}.`,
    QUESTION_RULES,
    `${JSON_ONLY} "title" is a short, friendly paper title.`
  ].filter(Boolean).join("\n\n");
};

export const buildPracticePrompt = ({ className, subject, skill, diagnosis, count }) => [
  `Create a practice set of exactly ${count} NEW questions for ${describeLearners(className)} studying ${subject}. Every question must practise this one topic: "${skill}".`,
  diagnosis ? `In the last assessment the child showed this weakness: ${diagnosis} Make the questions probe exactly that, starting gentle and getting a little harder.` : null,
  `Use this mix, grouped in this order: ${describeMix(count, className)}.`,
  `Every question's "skill" and "topic" must be exactly "${skill}".`,
  QUESTION_RULES,
  `${JSON_ONLY} "title" is a short set title.`
].filter(Boolean).join("\n\n");

export const buildAnalysisPrompt = ({ className, subject, percentage, rows, reviewCandidates, mistakeSkills }) => {
  const paper = rows.map((row) => (
    `Q${row.number} [${row.type}] topic: ${row.skill}${row.rating ? ` (teacher's rating: ${row.rating})` : ""} | area: ${row.area}\n  Question: ${row.question}\n  Answer key: ${row.expected}\n  Child's answer: ${row.given}\n  Result: ${row.correct ? "correct" : "WRONG"}`
  )).join("\n");

  const review = reviewCandidates.length
    ? `These typed answers did not match the answer key word for word. Decide which of them are actually correct (right value, equivalent wording, minor spelling slip) and list those question numbers in "acceptedQuestions". Be strict about answers that are genuinely wrong.\n${reviewCandidates.map((c) => `Q${c.number}: ${c.question} | key: ${c.expected}${c.acceptable.length ? ` (also acceptable: ${c.acceptable.join(", ")})` : ""} | child wrote: ${c.given}`).join("\n")}`
    : 'No typed answers need review: return an empty "acceptedQuestions" list.';

  const weakAreas = mistakeSkills.length
    ? `For "weakAreas", give one entry for EACH of these topics (copy the topic text exactly): ${mistakeSkills.map((skill) => `"${skill}"`).join(", ")}. The "diagnosis" is one sentence naming the specific error pattern visible in the child's wrong answers (for example "mixes up the colours red and orange"). If a topic had no wrong answers but the teacher rated it Needs Improvement, say what to keep practising.`
    : 'The child made no mistakes, so return an empty "weakAreas" list.';

  return [
    `A ${className} child has just taken a ${subject} assessment and scored ${percentage}%. Diagnose where they are struggling, based on their actual answers and the teacher's ratings.`,
    `THE PAPER AND THE CHILD'S ANSWERS:\n${paper}`,
    review,
    weakAreas,
    '"summary" is two or three sentences for the teacher on how the child did overall and what stands out. "recommendations" is 3 to 5 short, concrete next steps for the teacher or parents.',
    mistakeSkills.length
      ? `For "improvementPlan", give one entry for EACH of those same topics (copy the topic text exactly): "activities" is 2 or 3 short, hands-on things the child can do at home or in class to improve it (games, drawing, everyday objects, songs), and "resources" is 1 or 2 kinds of free material to use, described generically (for example "a printable number line", "a picture book about animals") — never invent a specific website, book title or link.`
      : 'The child made no mistakes, so return an empty "improvementPlan" list.',
    '"remarks" is the class teacher\'s note to the parents: two or three warm, encouraging sentences in plain language that name one thing the child does well and one thing to practise at home. Do not mention scores or percentages.',
    JSON_ONLY
  ].join("\n\n");
};

export const buildSyllabusDraftPrompt = ({ className, subject, academicYear, months }) => [
  `Draft the monthly syllabus for ${describeLearners(className)} studying ${subject} in academic year ${academicYear}, for these months: ${months.join(", ")}.`,
  'For each month give 5 to 7 short topics or learning outcomes a teacher can tick off (each under 14 words, for example "Recognise and name the colours red, blue and yellow" or "Count objects from 1 to 5"). Do not number them.',
  "Build gradually from month to month, revisit earlier ideas lightly, and follow what a typical Indian preschool or primary curriculum teaches at this age and time of year (festivals and seasons may appear as themes).",
  `${JSON_ONLY} Use exactly the month names given.`
].join("\n\n");

export const buildTutorContext = ({ className, subject, skill, diagnosis, mistakes }) => `THE LESSON
The child is in ${className} and is learning ${subject}. The only skill to teach is: "${skill}".
${diagnosis ? `In their assessment they showed this weakness: ${diagnosis}\n` : ""}${mistakes?.length ? `Questions they got wrong:\n${mistakes.map((m) => `- ${m}`).join("\n")}\n` : ""}
HOW TO TEACH (follow every time)
1. Your first reply (the child's first message just says they are ready): greet them in one short line, explain the idea in very simple words, give one or two worked examples, then ask ONE easy practice question. Put that question in "practiceQuestion" and set "answerStatus" to "none".
2. After that, the child's message is the answer to your last practice question. Judge it: set "answerStatus" to "correct" or "incorrect". In "message", say whether it was right; if it was wrong, kindly show the correct working step by step so they see the mistake; then add a short encouraging line.
3. Then ask the NEXT practice question in "practiceQuestion": a little harder after a correct answer, the same idea shown a different way after a wrong one. Never repeat a question and never include the answer to it.
4. If the child asks you a question instead of answering, ALWAYS answer it: give a short, correct, simple answer in "message" (two or three sentences, in words a ${className} child understands), even when it is not about the skill, as long as it is suitable for a child. Then gently bring them back to the practice question, set "answerStatus" to "none", and put the current practice question again in "practiceQuestion". Only if a question is not suitable for a child, say kindly that a parent or teacher is the right person to ask.
5. Set "understandingDemonstrated" to true only once the child has answered at least 3 practice questions correctly in total and their latest two answers were both correct. In that reply, congratulate them, say they are ready for a short practice test, and set "practiceQuestion" to an empty string. Until then it must be false.
6. Keep "message" under about 120 words, in plain text with no markdown. Put the practice question only in "practiceQuestion", not inside "message".`;
