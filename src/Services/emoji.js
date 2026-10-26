// Pictures in a preschool paper are emoji: they cost nothing to generate, need no image hosting, and
// a child recognises a 🍎 at once. These helpers keep the model honest about what counts as a
// picture and turn one into an image for the PDF (jsPDF's fonts cannot draw emoji).

const JOINERS = /\uFE0F|\u200D|\p{Emoji_Modifier}/gu;
// Non-global twin of JOINERS: a /g regex keeps state between .test() calls.
const JOINER_ONLY = /^(?:\uFE0F|\u200D|\p{Emoji_Modifier})$/u;
const MAX_GLYPHS = 12;

/**
 * True only for a short string made purely of pictographic emoji — "🍎", "⭐⭐⭐". Letters and
 * digits are rejected, so a model can't smuggle the answer in as text ("apple") and call it a picture.
 */
export const isEmojiString = (value) => {
  if (typeof value !== "string") return false;
  const stripped = value.replace(/\s+/gu, "").replace(JOINERS, "");
  const glyphs = [...stripped];
  return glyphs.length > 0 && glyphs.length <= MAX_GLYPHS && glyphs.every((glyph) => /\p{Extended_Pictographic}/u.test(glyph));
};

/** One entry per visible emoji, keeping ZWJ sequences (👨‍👩‍👧) and skin tones in one piece. */
export const splitGlyphs = (value) => {
  const text = String(value ?? "");
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment).filter((glyph) => glyph.trim() !== "");
  }
  return [...text].filter((glyph) => glyph.trim() !== "" && !JOINER_ONLY.test(glyph));
};

const cache = new Map();

/**
 * Draws an emoji (or a row of them) onto a canvas and returns a PNG data URL, or null where there is
 * no canvas (Node, tests). Callers must treat null as "leave a gap", never as an error.
 */
export const emojiToPngDataUrl = (value, size = 96) => {
  if (typeof document === "undefined") return null;
  const key = `${value}|${size}`;
  if (cache.has(key)) return cache.get(key);

  let url = null;
  try {
    const glyphs = splitGlyphs(value);
    const canvas = document.createElement("canvas");
    canvas.width = size * Math.max(glyphs.length, 1);
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context) {
      context.font = `${Math.round(size * 0.78)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      glyphs.forEach((glyph, index) => context.fillText(glyph, size * index + size / 2, size / 2 + size * 0.04));
      url = canvas.toDataURL("image/png");
    }
  } catch {
    url = null;
  }

  cache.set(key, url);
  return url;
};
