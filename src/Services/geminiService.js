const DEFAULT_MODEL = "gemini-flash-latest";
const REQUEST_TIMEOUT_MS = 30000;

export class GeminiConfigError extends Error {}
export class GeminiAuthError extends Error {}
export class GeminiRateLimitError extends Error {}
export class GeminiNetworkError extends Error {}
export class GeminiResponseError extends Error {}

export const describeGeminiError = (err) => {
  if (err instanceof GeminiConfigError) return err.message;
  if (err instanceof GeminiAuthError) return "Your Gemini API key was rejected. Check VITE_GEMINI_API_KEY in your .env file, then restart the dev server.";
  if (err instanceof GeminiRateLimitError) return "Gemini's rate limit was reached. Wait a moment and try again.";
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

const SYSTEM_INSTRUCTION = "You are an expert curriculum designer creating classroom-ready teaching resources for school teachers. Always respond with a single JSON object matching the provided response schema exactly. Do not include markdown formatting, code fences, or commentary outside the JSON.";

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const validateShape = (data) => {
  if (!isPlainObject(data)) return false;
  if (typeof data.title !== "string" || typeof data.summary !== "string") return false;
  if (!Array.isArray(data.sections)) return false;
  return data.sections.every((section) => isPlainObject(section) && typeof section.heading === "string" && Array.isArray(section.items) && section.items.every((item) => typeof item === "string"));
};

export const generateStructuredContent = async (prompt) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError("No Gemini API key found. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.");
  }

  const model = import.meta.env.VITE_GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESULT_SCHEMA,
          temperature: 0.7,
          maxOutputTokens: 4096
        }
      })
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
      throw new GeminiRateLimitError("Gemini rate limit reached.");
    }
    throw new GeminiResponseError(error?.message || `Gemini request failed (${response.status}).`);
  }

  const data = await response.json();

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new GeminiResponseError("Gemini declined to generate this content. Try adjusting your inputs.");
  }

  const candidate = data?.candidates?.[0];
  if (!candidate) {
    throw new GeminiResponseError("Gemini returned an empty response. Try again.");
  }

  if (candidate.finishReason === "MAX_TOKENS") {
    throw new GeminiResponseError("The response was too long and got cut off. Try reducing the number of questions or simplifying your request.");
  }

  const text = candidate.content?.parts?.map((part) => part.text || "").join("") || "";
  if (!text) {
    throw new GeminiResponseError("Gemini returned an empty response. Try again.");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiResponseError("Gemini returned an unexpected format. Try again.");
  }

  if (!validateShape(parsed)) {
    throw new GeminiResponseError("Gemini returned an unexpected format. Try again.");
  }

  return {
    title: parsed.title,
    summary: parsed.summary,
    sections: parsed.sections.map((section) => ({ heading: section.heading, items: section.items }))
  };
};
