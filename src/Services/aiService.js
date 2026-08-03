import {
  buildWorksheetPrompt,
  buildLessonPrompt,
  buildQuizPrompt,
  buildActivityPrompt,
  buildExamPrompt
} from "./promptBuilder";
import { generateStructuredContent } from "./geminiService";

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

  const prompt = buildPrompt(formData);
  const { title, summary, sections } = await generateStructuredContent(prompt);
  const note = NOTE_BUILDERS[type]?.(formData) || "";

  return {
    title: title || `${formatTopic(formData.topic)} ${type}`,
    summary,
    sections,
    note,
    prompt
  };
};
