const DEFAULT_MODEL = "gemini-flash-latest";
// Image models are not on the Gemini free tier — this needs a billing-enabled key.
// gemini-2.5-flash-image is the cheaper fallback if 3.1 is unavailable.
const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";
const REQUEST_TIMEOUT_MS = 30000;
// Image generation is a lot slower than a JSON completion, so it gets its own budget.
const IMAGE_REQUEST_TIMEOUT_MS = 90000;

export class GeminiConfigError extends Error {}
export class GeminiAuthError extends Error {}
export class GeminiRateLimitError extends Error {}
export class GeminiNetworkError extends Error {}
export class GeminiResponseError extends Error {}

export const describeGeminiError = (err) => {
  if (err instanceof GeminiConfigError) return err.message;
  if (err instanceof GeminiAuthError) return "Your Gemini API key was rejected. Check VITE_GEMINI_API_KEY in your .env file, then restart the dev server.";
  if (err instanceof GeminiRateLimitError) {
    if (err.needsBilling) return "This model isn't included in your Gemini API key's current plan — its free-tier quota is zero. Image generation needs billing enabled on the key's Google Cloud project.";
    return "Gemini's rate limit was reached. Wait a moment and try again.";
  }
  if (err instanceof GeminiNetworkError) return "Couldn't reach Gemini. Check your internet connection and try again.";
  if (err instanceof GeminiResponseError) return err.message || "Gemini returned something unexpected. Try again.";
  return "Something went wrong while generating this. Try again.";
};

const RESULT_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    summary: { type: "STRING" },
    sections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          heading: { type: "STRING" },
          items: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["heading", "items"],
        propertyOrdering: ["heading", "items"]
      }
    }
  },
  required: ["title", "summary", "sections"],
  propertyOrdering: ["title", "summary", "sections"]
};

const QUIZ_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    summary: { type: "STRING" },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" }
        },
        required: ["question", "options", "correctIndex"],
        propertyOrdering: ["question", "options", "correctIndex"]
      }
    }
  },
  required: ["title", "summary", "questions"],
  propertyOrdering: ["title", "summary", "questions"]
};

const ASSESSMENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", format: "enum", enum: ["mcq", "fill_blank", "true_false", "match", "problem_solving", "short_answer"] },
          topic: { type: "STRING" },
          skill: { type: "STRING" },
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" },
          answer: { type: "STRING" },
          acceptedAnswers: { type: "ARRAY", items: { type: "STRING" } },
          pairs: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { left: { type: "STRING" }, right: { type: "STRING" } },
              required: ["left", "right"],
              propertyOrdering: ["left", "right"]
            }
          },
          explanation: { type: "STRING" }
        },
        required: ["type", "topic", "skill", "question", "explanation"],
        propertyOrdering: ["type", "topic", "skill", "question", "options", "correctIndex", "answer", "acceptedAnswers", "pairs", "explanation"]
      }
    }
  },
  required: ["title", "questions"],
  propertyOrdering: ["title", "questions"]
};

const ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    // Question numbers (1-based) whose free-text answer was actually right although it did
    // not match the answer key word for word.
    acceptedQuestions: { type: "ARRAY", items: { type: "INTEGER" } },
    weakAreas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { skill: { type: "STRING" }, diagnosis: { type: "STRING" } },
        required: ["skill", "diagnosis"],
        propertyOrdering: ["skill", "diagnosis"]
      }
    },
    recommendations: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["summary", "acceptedQuestions", "weakAreas", "recommendations"],
  propertyOrdering: ["summary", "acceptedQuestions", "weakAreas", "recommendations"]
};

const TUTOR_SCHEMA = {
  type: "OBJECT",
  properties: {
    message: { type: "STRING" },
    practiceQuestion: { type: "STRING" },
    answerStatus: { type: "STRING", format: "enum", enum: ["correct", "incorrect", "none"] },
    understandingDemonstrated: { type: "BOOLEAN" }
  },
  required: ["message", "practiceQuestion", "answerStatus", "understandingDemonstrated"],
  propertyOrdering: ["message", "practiceQuestion", "answerStatus", "understandingDemonstrated"]
};

const ASSESSMENT_SYSTEM_INSTRUCTION = "You are an experienced primary and secondary school examiner who writes fair, accurate, age-appropriate assessment papers and diagnoses exactly where a student is struggling. Every question must be answerable from the stated syllabus and every answer key must be correct. Always respond with a single JSON object matching the provided response schema exactly. Do not include markdown formatting, code fences, or commentary outside the JSON.";

const TUTOR_SYSTEM_INSTRUCTION = "You are a warm, patient one-to-one AI teacher helping a school child master a single skill they found difficult. Use simple, friendly, age-appropriate language and short sentences. Teach one small step at a time, never reteach other topics, and never reveal a practice answer before the child has tried it. Always respond with a single JSON object matching the provided response schema exactly. Do not include markdown formatting, code fences, or commentary outside the JSON.";

const SYSTEM_INSTRUCTION = "You are an expert curriculum designer creating classroom-ready teaching resources for school teachers. Always respond with a single JSON object matching the provided response schema exactly. Do not include markdown formatting, code fences, or commentary outside the JSON.";

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const validateShape = (data) => {
  if (!isPlainObject(data)) return false;
  if (typeof data.title !== "string" || typeof data.summary !== "string") return false;
  if (!Array.isArray(data.sections)) return false;
  return data.sections.every((section) => isPlainObject(section) && typeof section.heading === "string" && Array.isArray(section.items) && section.items.every((item) => typeof item === "string"));
};

const validateQuizShape = (data) => {
  if (!isPlainObject(data)) return false;
  if (typeof data.title !== "string" || typeof data.summary !== "string") return false;
  if (!Array.isArray(data.questions) || data.questions.length === 0) return false;
  return data.questions.every((q) => (
    isPlainObject(q) &&
    typeof q.question === "string" &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((option) => typeof option === "string") &&
    Number.isInteger(q.correctIndex) &&
    q.correctIndex >= 0 &&
    q.correctIndex < 4
  ));
};

const requireApiKey = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError("No Gemini API key found. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.");
  }
  return apiKey;
};

// Shared transport for every Gemini call: timeouts, status codes and prompt blocks
// all map onto the typed errors above so callers only have to handle those.
const postToGemini = async ({ model, body, timeoutMs }) => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${requireApiKey()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body)
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new GeminiNetworkError("The request to Gemini timed out. Try again.");
    }
    throw new GeminiNetworkError("Couldn't reach Gemini. Check your internet connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const error = errorBody?.error;
    const reason = error?.details?.find((detail) => detail.reason)?.reason;

    if (response.status === 400 && reason === "API_KEY_INVALID") {
      throw new GeminiAuthError("Invalid Gemini API key.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new GeminiAuthError(error?.message || "Gemini API key was rejected.");
    }
    if (response.status === 429) {
      const rateLimitError = new GeminiRateLimitError("Gemini rate limit reached.");
      // "limit: 0" means the model isn't in this key's plan at all (image models are not on
      // the free tier), so retrying later never succeeds — say so instead of "wait a moment".
      rateLimitError.needsBilling = /limit:\s*0/.test(error?.message || "");
      throw rateLimitError;
    }
    throw new GeminiResponseError(error?.message || `Gemini request failed (${response.status}).`);
  }

  const data = await response.json();

  if (data?.promptFeedback?.blockReason) {
    throw new GeminiResponseError("Gemini declined to generate this content. Try adjusting your inputs.");
  }

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    throw new GeminiResponseError("Gemini returned an empty response. Try again.");
  }

  return candidate;
};

const requestGeminiJSON = async (prompt, schema, {
  systemInstruction = SYSTEM_INSTRUCTION,
  // Multi-turn callers pass the whole conversation; everyone else just sends one prompt.
  contents = [{ role: "user", parts: [{ text: prompt }] }],
  temperature = 0.7,
  maxOutputTokens = 4096,
  timeoutMs = REQUEST_TIMEOUT_MS
} = {}) => {
  const model = import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL;

  const candidate = await postToGemini({
    model,
    timeoutMs,
    body: {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature,
        maxOutputTokens
      }
    }
  });

  if (candidate.finishReason === "MAX_TOKENS") {
    throw new GeminiResponseError("The response was too long and got cut off. Try reducing the number of questions or simplifying your request.");
  }

  const text = candidate.content?.parts?.map((part) => part.text || "").join("") || "";
  if (!text) {
    throw new GeminiResponseError("Gemini returned an empty response. Try again.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiResponseError("Gemini returned an unexpected format. Try again.");
  }
};

export const generateStructuredContent = async (prompt) => {
  const parsed = await requestGeminiJSON(prompt, RESULT_SCHEMA);

  if (!validateShape(parsed)) {
    throw new GeminiResponseError("Gemini returned an unexpected format. Try again.");
  }

  return {
    title: parsed.title,
    summary: parsed.summary,
    sections: parsed.sections.map((section) => ({ heading: section.heading, items: section.items }))
  };
};

const IMAGE_BLOCK_REASONS = new Set(["IMAGE_SAFETY", "SAFETY", "PROHIBITED_CONTENT", "IMAGE_PROHIBITED_CONTENT", "RECITATION"]);

/**
 * Renders a prompt as a picture using a Gemini image model.
 * Returns a `data:` URL so the caller can put it straight into an <img> or a download link.
 */
export const generateImage = async (prompt, { aspectRatio = "3:4" } = {}) => {
  const model = import.meta.env.VITE_GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;

  const buildBody = (withImageConfig) => ({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      ...(withImageConfig ? { imageConfig: { aspectRatio } } : {})
    }
  });

  let candidate;
  try {
    candidate = await postToGemini({ model, timeoutMs: IMAGE_REQUEST_TIMEOUT_MS, body: buildBody(true) });
  } catch (err) {
    // Not every image model accepts `imageConfig`; a rejected config shouldn't cost the user the whole generation.
    if (!(err instanceof GeminiResponseError)) throw err;
    candidate = await postToGemini({ model, timeoutMs: IMAGE_REQUEST_TIMEOUT_MS, body: buildBody(false) });
  }

  if (IMAGE_BLOCK_REASONS.has(candidate.finishReason)) {
    throw new GeminiResponseError("Gemini wouldn't draw this worksheet. Try rewording the topic.");
  }

  const parts = candidate.content?.parts || [];
  const inline = parts.find((part) => part.inlineData?.data)?.inlineData;
  if (!inline) {
    throw new GeminiResponseError("Gemini didn't return an image. Try again, or simplify the topic.");
  }

  const mimeType = inline.mimeType || "image/png";
  return { dataUrl: `data:${mimeType};base64,${inline.data}`, mimeType };
};

export const generateQuizContent = async (prompt) => {
  const parsed = await requestGeminiJSON(prompt, QUIZ_SCHEMA);

  if (!validateQuizShape(parsed)) {
    throw new GeminiResponseError("Gemini returned an unexpected format. Try again.");
  }

  return {
    title: parsed.title,
    summary: parsed.summary,
    questions: parsed.questions.map((q) => ({ question: q.question, options: q.options, correctIndex: q.correctIndex }))
  };
};

// ---- Student assessment ----

const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * Returns the model's raw question list. Per-type checks (an MCQ needs four options, a match
 * question needs pairs, ...) live in assessmentGrading.normalizeQuestions, which can drop a
 * single bad question instead of failing the whole paper.
 */
export const generateAssessmentContent = async (prompt) => {
  const parsed = await requestGeminiJSON(prompt, ASSESSMENT_SCHEMA, {
    systemInstruction: ASSESSMENT_SYSTEM_INSTRUCTION,
    // A 20-question paper with answer keys and explanations is far longer than a worksheet.
    maxOutputTokens: 16384,
    timeoutMs: 90000,
    temperature: 0.8
  });

  if (!isPlainObject(parsed) || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new GeminiResponseError("Gemini returned an unexpected format. Try again.");
  }

  return { title: typeof parsed.title === "string" ? parsed.title : "", questions: parsed.questions.filter(isPlainObject) };
};

export const analyzeAssessmentContent = async (prompt) => {
  const parsed = await requestGeminiJSON(prompt, ANALYSIS_SCHEMA, {
    systemInstruction: ASSESSMENT_SYSTEM_INSTRUCTION,
    maxOutputTokens: 8192,
    timeoutMs: 60000,
    temperature: 0.3
  });

  const valid = isPlainObject(parsed)
    && typeof parsed.summary === "string"
    && Array.isArray(parsed.acceptedQuestions) && parsed.acceptedQuestions.every(Number.isInteger)
    && Array.isArray(parsed.weakAreas) && parsed.weakAreas.every((area) => isPlainObject(area) && typeof area.skill === "string" && typeof area.diagnosis === "string")
    && isStringArray(parsed.recommendations);

  if (!valid) {
    throw new GeminiResponseError("Gemini returned an unexpected format. Try again.");
  }

  return {
    summary: parsed.summary,
    acceptedQuestions: parsed.acceptedQuestions,
    weakAreas: parsed.weakAreas.map((area) => ({ skill: area.skill, diagnosis: area.diagnosis })),
    recommendations: parsed.recommendations
  };
};

/**
 * One turn of the AI teacher. `systemContext` describes the skill being taught; `history` is
 * the conversation so far as [{ role: "user" | "model", text }], oldest first.
 */
export const generateTutorTurn = async ({ systemContext, history }) => {
  const parsed = await requestGeminiJSON("", TUTOR_SCHEMA, {
    systemInstruction: `${TUTOR_SYSTEM_INSTRUCTION}\n\n${systemContext}`,
    contents: history.map(({ role, text }) => ({ role, parts: [{ text }] })),
    maxOutputTokens: 4096,
    timeoutMs: 45000,
    temperature: 0.7
  });

  const valid = isPlainObject(parsed)
    && typeof parsed.message === "string" && parsed.message.trim() !== ""
    && typeof parsed.practiceQuestion === "string"
    && ["correct", "incorrect", "none"].includes(parsed.answerStatus)
    && typeof parsed.understandingDemonstrated === "boolean";

  if (!valid) {
    throw new GeminiResponseError("Gemini returned an unexpected format. Try again.");
  }

  return {
    message: parsed.message,
    practiceQuestion: parsed.practiceQuestion,
    answerStatus: parsed.answerStatus,
    understandingDemonstrated: parsed.understandingDemonstrated
  };
};
