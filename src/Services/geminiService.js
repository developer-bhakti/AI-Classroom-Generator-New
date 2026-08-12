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

const requestGeminiJSON = async (prompt, schema) => {
  const model = import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL;

  const candidate = await postToGemini({
    model,
    timeoutMs: REQUEST_TIMEOUT_MS,
    body: {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7,
        maxOutputTokens: 4096
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
