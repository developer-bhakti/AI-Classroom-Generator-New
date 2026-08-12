import { getResourcePalette } from "./resourcePalette";

const JSON_REMINDER = "Respond only with the requested JSON structure — no markdown, no extra commentary.";

export const buildWorksheetPrompt = ({ topic, className, subject, difficultyLevel, numberOfQuestions, worksheetType, learningObjectives, additionalInstructions }) => {
  return `Create a printable ${worksheetType || "practice"} worksheet on "${topic}" for ${subject || "the subject"}, ${className || "the class"}.
Difficulty level: ${difficultyLevel || "Medium"}.
Structure the response as JSON with a "title", a one-sentence "summary", and a "sections" array containing exactly these sections in order:
1. "Warm-Up" — 2-3 short items that ease students into the topic with a relatable example.
2. "Practice" — around ${numberOfQuestions || 10} numbered practice tasks or questions on the topic, appropriately scaled in difficulty.
3. "Reflection" — 1-2 items prompting students to reflect on or explain what they learned.

Learning objective / focus: ${learningObjectives || "help students build a solid understanding of the topic"}.
Additional instructions from the teacher: ${additionalInstructions || "none"}.

${JSON_REMINDER}`;
};

// Image models are told to *draw the page*, not to describe it — hence the layout-first
// wording and the explicit "no photo, no mockup, no 3D" guardrails.
export const buildWorksheetImagePrompt = ({ topic, className, subject, difficultyLevel, numberOfQuestions, worksheetType, learningObjectives, additionalInstructions }) => {
  const palette = getResourcePalette({ className, subject });

  return `Design a single, ready-to-print A4 portrait classroom worksheet page about "${topic}".

The page must look like a real photocopiable worksheet handed out by a teacher — a flat, straight-on, full-bleed scan of the sheet itself. Not a photo of paper on a desk, not a 3D mockup, no shadows, no curled corners, no hands, no background scene.

Audience: ${className || "primary school"} students studying ${subject || "this topic"}. Worksheet style: ${worksheetType || "practice"}. Difficulty: ${difficultyLevel || "Medium"}.
Learning focus: ${learningObjectives || "build a solid understanding of the topic"}.
Extra instructions from the teacher: ${additionalInstructions || "none"}.

Lay the page out top to bottom:
- A bold title banner reading the worksheet topic, filled in the accent colour with the title text reversed out in white, and small "Name: ____________" and "Date: __________" lines underneath.
- A one-line instruction telling students what to do.
- Around ${numberOfQuestions || 8} numbered exercises spread over 2-3 clearly labelled sections, each section introduced by its own coloured header band. Give every exercise generous ruled blank space, answer boxes or write-on lines outlined in the accent colour. Mix the question formats — fill in the blanks, match the pairs, short answers, a small table or grid.
- Two or three simple, friendly illustrations related to the topic, placed in the margins or beside the questions so they never sit on top of the text.

Colour scheme — the page must look colourful, not black and white:
- Build the whole page around exactly this accent colour: ${palette.name}, hex ${palette.hex}. Match that shade closely — it is what distinguishes a ${className || "class"} sheet from every other class's sheet in the same subject.
- Tint the paper background a pale, washed-out version of that same colour rather than leaving it plain white, and use slightly deeper tints of it to shade alternating section blocks, answer boxes and table rows so the sections are easy to tell apart.
- ${palette.tone}.
- Use tints and shades of the one accent colour throughout so the page reads as a single coordinated palette — never a rainbow of unrelated colours.

Typography: crisp, perfectly spelled, correctly formed printed text in a clean sans-serif, large enough to read easily. Keep all body text near-black and strongly contrasted against its tinted background so the sheet still photocopies and reads clearly — colour goes in the backgrounds, headers, borders and illustrations, never in the body text. Every line of text must be real, legible, correctly spelled words — never scribbles, placeholder squiggles or invented letters. Do not add any watermark, logo, page number, signature or website URL.`;
};

export const buildLessonPrompt = ({ topic, className, subject, duration, objective }) => {
  return `Create a complete lesson plan on "${topic}" for ${subject || "the subject"}, ${className || "the class"}, designed to fit a ${duration || "45 mins"} session.
Learning objective: ${objective || "help students understand the topic clearly"}.
Structure the response as JSON with a "title", a one-sentence "summary", and a "sections" array containing exactly these sections in order:
1. "Opening" — a relatable hook and a way to activate prior knowledge.
2. "Guided Practice" — how the teacher models the concept with the class.
3. "Independent Practice" — a task students complete on their own or in small groups.
4. "Closing" — a wrap-up activity or exit ticket that checks understanding.

${JSON_REMINDER}`;
};

export const buildQuizPrompt = ({ topic, className, subject, duration, objective }) => {
  return `Create a short multiple-choice quiz on "${topic}" for ${subject || "the subject"}, ${className || "the class"}, meant to fit a ${duration || "15 mins"} activity.
It should assess: ${objective || "understanding of the topic"}.
Create 8 to 10 multiple-choice questions of varying difficulty, using clear classroom examples.
Structure the response as JSON with a "title", a one-sentence "summary", and a "questions" array. Each item in "questions" must be an object with:
- "question": the question text
- "options": an array of exactly 4 answer choices as strings, in a shuffled (non-obvious) order
- "correctIndex": the 0-based index into "options" of the one correct answer

Exactly one option per question must be correct; the other three should be plausible but clearly wrong distractors.

${JSON_REMINDER}`;
};

export const buildActivityPrompt = ({ topic, className, subject, duration, objective }) => {
  return `Generate creative classroom activity ideas for "${topic}" for ${subject || "the subject"}, ${className || "the class"}, each fitting within a ${duration || "30 mins"} session.
The activities should support: ${objective || "student engagement and understanding"}.
Structure the response as JSON with a "title", a one-sentence "summary", and a "sections" array containing 3 to 4 sections, one per activity idea (e.g. "Activity 1", "Activity 2", ...). Each section's items should include a short setup instruction and the expected learning outcome for that activity. Activities should be hands-on and collaborative where possible.

${JSON_REMINDER}`;
};

export const buildExamPrompt = ({ className, subject, topic, duration, totalMarks, difficulty, instructions }) => {
  return `Create a polished exam paper for ${className || "the class"} on ${subject || "the subject"}: "${topic}".
Total marks: ${totalMarks || "50"}. Time limit: ${duration || "60 mins"}. Difficulty: ${difficulty || "Medium"}.
Structure the response as JSON with a "title", a one-sentence "summary", and a "sections" array containing exactly these sections in order:
1. "Section A" — 5 shorter-answer questions using realistic classroom scenarios.
2. "Section B" — 5 application/longer-answer questions that require more reasoning.
3. "Answer Guide" — brief marking hints or sample answers for the teacher, not full solutions.

Teacher's instructions to include on the paper: ${instructions || "none"}.

${JSON_REMINDER}`;
};
