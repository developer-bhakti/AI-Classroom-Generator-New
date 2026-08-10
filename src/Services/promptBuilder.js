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
