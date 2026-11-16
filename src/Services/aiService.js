import {
  buildWorksheetPrompt,
  buildWorksheetImagePrompt,
  buildLessonPrompt,
  buildQuizPrompt,
  buildActivityPrompt,
  buildExamPrompt
} from "./promptBuilder";
import { generateStructuredContent, generateQuizContent, generateExamContent, generateImage } from "./geminiService";
import { planQuizLength, planExamLength } from "./questionPlan";
import { buildGroundingBlock, describeSource } from "./bookGrounding";
import { splitExamSections } from "./examPaper";
import { getLanguage } from "./contentStore";

const formatTopic = (value) => value?.split(": ").pop()?.trim() || value || "your topic";

const PROMPT_BUILDERS = {
  worksheet: buildWorksheetPrompt,
  lesson: buildLessonPrompt,
  quiz: buildQuizPrompt,
  activity: buildActivityPrompt,
  exam: buildExamPrompt
};

const IMAGE_PROMPT_BUILDERS = {
  worksheet: buildWorksheetImagePrompt
};

const NOTE_BUILDERS = {
  worksheet: (formData) => `Estimated time: ${formData.duration || "30 mins"} • Difficulty: ${formData.difficultyLevel || "Medium"}`,
  lesson: (formData) => `Estimated time: ${formData.duration || "45 mins"}`,
  quiz: (formData) => `Estimated time: ${formData.duration || "15 mins"} • ${planQuizLength(formData).count} questions`,
  activity: (formData) => `Estimated time: ${formData.duration || "30 mins"}`,
  exam: (formData) => `Duration: ${formData.duration || "60 mins"} • Difficulty: ${formData.difficulty || "Medium"} • ${planExamLength(formData).total} questions`
};

/**
 * `source` (optional) is a textbook to teach from, as built by bookService.resolveSource(): the chosen chapters as a
 * small PDF plus their names. With it the prompt names the pages, the system instruction becomes the textbook-mode
 * rules, and the result says where it came from. Without it nothing changes.
 */
export const generateResource = async ({ type, formData, source = null }) => {
  const buildPrompt = PROMPT_BUILDERS[type];
  if (!buildPrompt) {
    throw new Error(`Unsupported resource type: ${type}`);
  }

  const language = getLanguage();
  let prompt = buildPrompt(formData);
  if (source) prompt += buildGroundingBlock(source);
  if (language !== "English") {
    prompt += `\n\nWrite the entire response in ${language} — the title, summary, and every section heading and item — not just a translation note. Keep numbers, formulas, and proper nouns in their standard form.`;
  }

  const baseNote = NOTE_BUILDERS[type]?.(formData) || "";
  const withLanguage = language !== "English" ? `${baseNote}${baseNote ? " • " : ""}Generated in ${language}` : baseNote;
  const note = source ? `${withLanguage}${withLanguage ? " • " : ""}Source: ${describeSource(source)}` : withLanguage;
  // The pages themselves stay out of the result (they are megabytes); only the names are kept.
  const sourceInfo = source ? { label: describeSource(source), bookId: source.book.id, chapters: source.chapters } : null;

  if (type === "quiz") {
    const { title, summary, questions, topics } = await generateQuizContent(prompt, { count: planQuizLength(formData).count, source });
    const sections = [{
      heading: "Questions",
      items: questions.map((q, index) => `${index + 1}. ${q.question} — Answer: ${q.options[q.correctIndex]}`)
    }];

    return {
      title: title || `${formatTopic(formData.topic)} quiz`,
      summary,
      sections,
      questions,
      topics,
      note,
      source: sourceInfo,
      prompt
    };
  }

  if (type === "exam") {
    const exam = await generateExamContent(prompt, { count: planExamLength(formData).total, source });
    // The paper must hold questions only; anything the model still labelled as answers moves to the key.
    const split = splitExamSections(exam.sections);

    return {
      title: exam.title || `${formatTopic(formData.topic)} exam`,
      summary: exam.summary,
      sections: split.paperSections,
      answerKey: [...exam.answerKey, ...split.answerKey],
      note,
      source: sourceInfo,
      prompt
    };
  }

  const { title, summary, sections } = await generateStructuredContent(prompt, { source });

  return {
    title: title || `${formatTopic(formData.topic)} ${type}`,
    summary,
    sections,
    note,
    source: sourceInfo,
    prompt
  };
};

/**
 * Same inputs as generateResource, but the model draws the finished page instead of
 * returning structured text. Returns a data: URL ready for an <img> or a download link.
 */
export const generateResourceImage = async ({ type, formData }) => {
  const buildPrompt = IMAGE_PROMPT_BUILDERS[type];
  if (!buildPrompt) {
    throw new Error(`Image generation is not supported for resource type: ${type}`);
  }

  const language = getLanguage();
  let prompt = buildPrompt(formData);
  if (language !== "English") {
    prompt += `\n\nEvery word printed on the page — the title, the instructions, the questions and the labels — must be written in ${language}, spelled correctly in that language's own script. Keep numbers, formulas and proper nouns in their standard form.`;
  }

  const { dataUrl, mimeType } = await generateImage(prompt);
  const baseNote = NOTE_BUILDERS[type]?.(formData) || "";

  return {
    dataUrl,
    mimeType,
    title: `${formatTopic(formData.topic)} worksheet`,
    note: language !== "English" ? `${baseNote}${baseNote ? " • " : ""}Generated in ${language}` : baseNote,
    prompt
  };
};
