import {
  buildWorksheetPrompt,
  buildLessonPrompt,
  buildQuizPrompt,
  buildActivityPrompt,
  buildExamPrompt
} from "./promptBuilder";
import { generateStructuredContent, generateQuizContent } from "./geminiService";
import { getLanguage } from "./contentStore";

const formatTopic = (value) => value?.split(": ").pop()?.trim() || value || "your topic";

const PROMPT_BUILDERS = {
  worksheet: buildWorksheetPrompt,
  lesson: buildLessonPrompt,
  quiz: buildQuizPrompt,
  activity: buildActivityPrompt,
  exam: buildExamPrompt
};

const NOTE_BUILDERS = {
  worksheet: (formData) => `Estimated time: ${formData.duration || "30 mins"} • Difficulty: ${formData.difficultyLevel || "Medium"}`,
  lesson: (formData) => `Estimated time: ${formData.duration || "45 mins"}`,
  quiz: (formData) => `Estimated time: ${formData.duration || "15 mins"}`,
  activity: (formData) => `Estimated time: ${formData.duration || "30 mins"}`,
  exam: (formData) => `Duration: ${formData.duration || "60 mins"} • Difficulty: ${formData.difficulty || "Medium"}`
};

export const generateResource = async ({ type, formData }) => {
  const buildPrompt = PROMPT_BUILDERS[type];
  if (!buildPrompt) {
    throw new Error(`Unsupported resource type: ${type}`);
  }

  const language = getLanguage();
  let prompt = buildPrompt(formData);
  if (language !== "English") {
    prompt += `\n\nWrite the entire response in ${language} — the title, summary, and every section heading and item — not just a translation note. Keep numbers, formulas, and proper nouns in their standard form.`;
  }

  const baseNote = NOTE_BUILDERS[type]?.(formData) || "";
  const note = language !== "English" ? `${baseNote}${baseNote ? " • " : ""}Generated in ${language}` : baseNote;

  if (type === "quiz") {
    const { title, summary, questions } = await generateQuizContent(prompt);
    const sections = [{
      heading: "Questions",
      items: questions.map((q, index) => `${index + 1}. ${q.question} — Answer: ${q.options[q.correctIndex]}`)
    }];

    return {
      title: title || `${formatTopic(formData.topic)} quiz`,
      summary,
      sections,
      questions,
      note,
      prompt
    };
  }

  const { title, summary, sections } = await generateStructuredContent(prompt);

  return {
    title: title || `${formatTopic(formData.topic)} ${type}`,
    summary,
    sections,
    note,
    prompt
  };
};
