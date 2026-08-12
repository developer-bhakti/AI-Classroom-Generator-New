// Colour scheme shared by every generator page. One source of truth, so the image prompt and
// the on-screen output card always agree.
//
// Three dimensions combine into one shade:
//   subject (the category) -> the hue family   e.g. Math always lands in the blues
//   class                  -> the shade of it  e.g. PG is a bright pastel, Class 12 a deep tone
//   resource type          -> a hue nudge      so a lesson plan and a quiz for the same class
//                                              are visibly different pages
// Every combination resolves to its own colour, while sheets from one subject still read as a family.

const SUBJECT_HUES = {
  English: { name: "coral red", hue: 6, sat: 70 },
  Math: { name: "royal blue", hue: 222, sat: 62 },
  EVS: { name: "leaf green", hue: 132, sat: 46 },
  Science: { name: "teal", hue: 180, sat: 62 },
  "Social Science": { name: "amber", hue: 36, sat: 72 },
  "Social Studies": { name: "amber", hue: 40, sat: 72 },
  History: { name: "bronze", hue: 26, sat: 46 },
  Physics: { name: "indigo", hue: 244, sat: 56 },
  Chemistry: { name: "magenta", hue: 320, sat: 56 },
  Biology: { name: "emerald", hue: 156, sat: 54 },
  "Computer Science": { name: "cyan", hue: 196, sat: 58 }
};

// Kept small enough that the subject's hue family still reads through.
const TYPE_HUE_OFFSETS = {
  worksheet: 0,
  lesson: 12,
  quiz: -12,
  activity: 24,
  exam: -24
};

const DEFAULT_HUE = { name: "royal blue", hue: 222, sat: 62 };

// Ordered youngest to oldest — position in this list drives how deep the shade goes.
const CLASS_ORDER = ["PG", "Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`)];

const LIGHTEST = 66;
const DARKEST = 29;
// A small hue drift on top of the lightness ramp so neighbouring classes stay tellable apart.
const HUE_DRIFT = 18;

const SHADE_LABELS = [
  { min: 56, label: "bright pastel" },
  { min: 50, label: "light" },
  { min: 44, label: "soft mid-tone" },
  { min: 38, label: "rich mid-tone" },
  { min: 0, label: "deep" }
];

const CLASS_BANDS = [
  {
    id: "early",
    max: 3,
    label: "Early years",
    // Little kids get the loudest treatment; seniors get colour used sparingly.
    tone: "Bold, playful and cheerful — thick rounded borders, chunky colour-filled header bands, plenty of colour in the illustrations, and a strongly tinted paper background"
  },
  {
    id: "primary",
    max: 8,
    label: "Primary",
    tone: "Bright and friendly — rounded coloured section bands, coloured outlines around every answer box, colourful illustrations, and a clearly tinted paper background"
  },
  {
    id: "middle",
    max: 11,
    label: "Middle school",
    tone: "Clean and balanced — solid coloured section headers, coloured rules and box outlines, lightly coloured illustrations, and a gently tinted paper background"
  },
  {
    id: "senior",
    max: Infinity,
    label: "Senior",
    tone: "Restrained and grown-up — colour reserved for section headers, thin rules and table borders, over a lightly tinted paper background"
  }
];

const hslToHex = (hue, s, l) => {
  const h = ((hue % 360) + 360) % 360;
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const secondary = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = lightness - chroma / 2;

  const [r, g, b] = (() => {
    if (h < 60) return [chroma, secondary, 0];
    if (h < 120) return [secondary, chroma, 0];
    if (h < 180) return [0, chroma, secondary];
    if (h < 240) return [0, secondary, chroma];
    if (h < 300) return [secondary, 0, chroma];
    return [chroma, 0, secondary];
  })();

  const toHex = (value) => Math.round((value + match) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

/**
 * Resolves the colour scheme for a generated resource.
 * Returns the accent as a hex (the UI tints the output card with it) and as a human
 * colour name — image models steer far better on "deep royal blue" than on a hex code.
 */
export const getResourcePalette = ({ className, subject, type = "worksheet" } = {}) => {
  const base = SUBJECT_HUES[subject] || DEFAULT_HUE;

  const index = CLASS_ORDER.indexOf(className);
  const position = index === -1 ? 0.5 : index / (CLASS_ORDER.length - 1);

  // Younger classes get a lighter, more saturated shade; older classes a deeper, calmer one.
  const lightness = LIGHTEST - position * (LIGHTEST - DARKEST);
  const saturation = base.sat - position * 12;
  const hue = base.hue + (position - 0.5) * HUE_DRIFT + (TYPE_HUE_OFFSETS[type] || 0);

  const band = CLASS_BANDS.find((candidate) => (index === -1 ? 5 : index) <= candidate.max);
  const shade = SHADE_LABELS.find((candidate) => lightness >= candidate.min).label;

  return {
    hex: hslToHex(hue, saturation, lightness),
    // Fixed-lightness variants so text stays readable whatever shade the ramp produced:
    // `ink` for text on the light-theme tint, `glow` for text on the dark-theme tint.
    ink: hslToHex(hue, Math.min(saturation + 8, 80), 24),
    glow: hslToHex(hue, Math.min(saturation + 8, 80), 78),
    hue: base.name,
    shade,
    name: `${shade} ${base.name}`,
    tone: band.tone,
    band: band.id,
    bandLabel: band.label
  };
};
