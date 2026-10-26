import {
  QUESTION_TYPES,
  OPTION_LABELS,
  deriveStrengths,
  formatCorrectAnswer,
  formatStudentAnswer,
  getPerformanceLevel,
  isChoiceQuestion,
  summarizeAreas,
  usesLetterLabels
} from "./assessmentGrading";
import { emojiToPngDataUrl, isEmojiString, splitGlyphs } from "./emoji";

// Two parts in one file: the paper a child sits (questions only), then the answer and performance
// report for the teacher. Built straight from the saved assessment, so a paper can be re-downloaded
// any time without calling the AI again. (The parent-facing progress report is a separate, printable
// HTML page — see ProgressReport.)

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = PAGE_HEIGHT - 18;
const PT_TO_MM = 0.3528;
const PICTURE_HEIGHT = 12; // mm, the picture in a picture question
const OPTION_PICTURE_HEIGHT = 8; // mm, an option that is itself a picture

const INK = [30, 41, 59];
const MUTED = [100, 116, 139];
const ACCENT = [59, 100, 214];
const GOOD = [22, 134, 74];
const BAD = [200, 40, 40];
const LEVEL_COLORS = {
  "Excellent": [22, 134, 74],
  "Good": [37, 99, 235],
  "Average": [196, 110, 8],
  "Needs Improvement": [200, 40, 40]
};

const KIND_LABELS = {
  end_term: "End-Term Assessment",
  current: "Monthly Assessment",
  practice: "Practice Set"
};

// jsPDF's built-in fonts only cover Latin-1 / WinAnsi. Map the symbols the model likes to use onto
// that range, stand "[picture]" in for emoji (pictures are drawn as images where they matter), and
// drop anything else rather than printing garbage glyphs.
const REPLACEMENTS = [
  [/[→⟶⇒]/g, "->"], [/[←]/g, "<-"], [/≥/g, ">="], [/≤/g, "<="], [/≠/g, "!="], [/≈/g, "~"],
  [/₹/g, "Rs. "], [/[✓✔]/g, "(correct)"], [/[✗✘]/g, "(wrong)"], [/[−–—]/g, "-"],
  [/[‘’]/g, "'"], [/[“”]/g, '"'], [/…/g, "..."], [/\u00a0/g, " "],
  [/(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\p{Emoji_Modifier})+/gu, "[picture]"]
];

const pdfSafe = (value) => {
  let text = String(value ?? "");
  REPLACEMENTS.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\x09\x0a\x20-\x7e\xa0-\xff]/g, "");
};

const formatDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

const fileSafe = (value) => String(value).trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

export const kindLabel = (assessment) =>
  assessment.kind === "practice" && assessment.focusSkill
    ? `Practice Set: ${assessment.focusSkill}`
    : KIND_LABELS[assessment.kind] || "Assessment";

const createWriter = (doc, emojiImage) => {
  let y = MARGIN;
  const lineHeight = (size) => size * PT_TO_MM * 1.45;

  const writer = {
    get y() { return y; },
    set y(value) { y = value; },
    newPage() {
      doc.addPage();
      y = MARGIN;
    },
    // Starts a new page when the next `height` mm would not fit.
    ensure(height) {
      if (y + height > BOTTOM) writer.newPage();
    },
    space(height) {
      y += height;
    },
    text(value, { size = 10.5, style = "normal", color = INK, indent = 0, after = 1.5, width = CONTENT_WIDTH - indent, x = MARGIN + indent } = {}) {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(pdfSafe(value), width);
      lines.forEach((line) => {
        writer.ensure(lineHeight(size));
        doc.text(line, x, y + size * PT_TO_MM);
        y += lineHeight(size);
      });
      y += after;
    },
    rule(color = [226, 232, 240]) {
      doc.setDrawColor(...color);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
      y += 3;
    },
    // Height a block of wrapped text will take, so callers can keep a question on one page.
    measure(value, { size = 10.5, width = CONTENT_WIDTH } = {}) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size);
      return doc.splitTextToSize(pdfSafe(value), width).length * lineHeight(size);
    },
    // Whether an emoji can be drawn as an image here (there is no canvas in Node, e.g. in tests).
    canDrawEmoji(emoji) {
      return Boolean(emojiImage(emoji));
    },
    // Draws a row of emoji as an image at (x, top). Returns the width used, or 0 when it could not.
    emoji(emoji, x, top, height) {
      const url = emojiImage(emoji);
      if (!url) return 0;
      const width = height * Math.max(splitGlyphs(emoji).length, 1);
      try {
        doc.addImage(url, "PNG", x, top, width, height);
        return width;
      } catch {
        return 0;
      }
    },
    // One short label at an exact baseline, without moving the cursor.
    label(value, x, baseline, size = 10.5) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size);
      doc.setTextColor(...INK);
      doc.text(pdfSafe(value), x, baseline);
    },
    textWidth(value, size = 10.5, style = "normal") {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      return doc.getTextWidth(pdfSafe(value));
    },
    lineHeight
  };
  return writer;
};

const drawHeader = (w, doc, { title, student, assessment }) => {
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE_WIDTH, 5, "F");
  w.y = MARGIN + 2;

  w.text(title, { size: 18, style: "bold", color: ACCENT, after: 2 });
  w.text(kindLabel(assessment), { size: 11, color: MUTED, after: 3 });
  w.rule();

  const half = CONTENT_WIDTH / 2;
  const row = (left, right) => {
    const top = w.y;
    w.text(left, { width: half, after: 1 });
    const afterLeft = w.y;
    w.y = top;
    if (right) w.text(right, { x: MARGIN + half, width: half, after: 1 });
    w.y = Math.max(afterLeft, w.y);
  };

  row(`Student: ${student.name}`, `Date: ${formatDate(assessment.createdAt)}`);
  row(`Class: ${assessment.className}`, `Subject: ${assessment.subject}`);
  if (assessment.academicYear || assessment.month) {
    row(`Academic year: ${assessment.academicYear || "-"}`, assessment.month ? `${assessment.kind === "end_term" ? "Term" : "Month"}: ${assessment.month}` : "");
  }

  const topics = assessment.kind === "practice"
    ? [assessment.focusSkill].filter(Boolean)
    : assessment.topics;
  const covered = topics?.length ? topics.join("; ") : `Standard ${assessment.className} ${assessment.subject} syllabus`;
  w.text(`Syllabus / topics covered: ${covered}`, { after: 1 });
  if (assessment.progressNote) w.text(`Progress note: ${assessment.progressNote}`, { color: MUTED, after: 1 });
  w.space(1);
  w.rule();
};

// ---- Part 1: the paper ----

const optionLabel = (question, index) => (usesLetterLabels(question) ? OPTION_LABELS[index] : null);

const drawQuestion = (w, doc, question, number) => {
  const stem = `${number}. ${question.question}`;
  const choice = isChoiceQuestion(question);
  const pictureHeight = question.picture ? PICTURE_HEIGHT + 2 : 0;

  let bodyHeight = 8; // answer space for typed answers
  if (choice) {
    bodyHeight = question.type === "true_false" || question.type === "activity"
      ? w.lineHeight(10.5)
      : question.options.reduce((sum, option) => sum + (isEmojiString(option) ? OPTION_PICTURE_HEIGHT + 1 : w.measure(`(A) ${option}`, { width: CONTENT_WIDTH - 10 })), 0);
  } else if (question.type === "match") {
    bodyHeight = question.lefts.length * (w.lineHeight(10.5) + 2) + w.lineHeight(9.5);
  } else if (question.type === "short_answer" || question.type === "problem_solving") {
    bodyHeight = 16;
  }

  // Keep the stem with its picture, options or answer space instead of stranding it at the foot of a page.
  w.ensure(w.measure(stem) + pictureHeight + Math.min(bodyHeight, 30) + 3);
  w.text(stem, { after: 1.2 });

  if (question.picture) {
    if (w.canDrawEmoji(question.picture)) {
      w.emoji(question.picture, MARGIN + 6, w.y, PICTURE_HEIGHT);
      w.space(PICTURE_HEIGHT + 2);
    } else {
      w.text("[picture]", { indent: 6, color: MUTED, after: 0.6 });
    }
  }

  if (question.type === "activity") {
    w.text(`Teacher's note - mark one:     (   ) ${question.options[0]}        (   ) ${question.options[1]}`, { indent: 6, size: 10, after: 0.4 });
  } else if (question.type === "true_false") {
    w.text("(   ) True        (   ) False", { indent: 6, after: 0.4 });
  } else if (choice) {
    question.options.forEach((option, i) => {
      const label = `(${optionLabel(question, i) || i + 1}) `;
      if (isEmojiString(option) && w.canDrawEmoji(option)) {
        w.ensure(OPTION_PICTURE_HEIGHT + 1);
        const top = w.y;
        w.label(label, MARGIN + 6, top + OPTION_PICTURE_HEIGHT / 2 + 1.4);
        w.emoji(option, MARGIN + 6 + w.textWidth(label), top, OPTION_PICTURE_HEIGHT);
        w.y = top + OPTION_PICTURE_HEIGHT + 1;
      } else {
        // pdfSafe turns an emoji that cannot be drawn into "[picture]".
        w.text(`${label}${option}`, { indent: 6, after: 0.4 });
      }
    });
  } else if (question.type === "match") {
    w.text("Write the letter of the matching item on the line.", { size: 9.5, color: MUTED, indent: 6, after: 1 });
    const colWidth = CONTENT_WIDTH / 2 - 10;
    question.lefts.forEach((left, i) => {
      w.ensure(isEmojiString(left) ? OPTION_PICTURE_HEIGHT + 2 : w.lineHeight(10.5) + 1);
      const rowTop = w.y;
      const rightText = `${matchLetter(i)}. ${question.rights[i]}`;
      const rightX = MARGIN + CONTENT_WIDTH / 2 + 6;
      let afterLeft;
      if (isEmojiString(left) && w.canDrawEmoji(left)) {
        const numberLabel = `${i + 1}.`;
        const baseline = rowTop + OPTION_PICTURE_HEIGHT / 2 + 1.4;
        w.label(numberLabel, MARGIN + 6, baseline);
        const pictureX = MARGIN + 6 + w.textWidth(numberLabel) + 2;
        const used = w.emoji(left, pictureX, rowTop, OPTION_PICTURE_HEIGHT);
        w.label("____", pictureX + used + 3, baseline);
        // the lettered item sits on the same line as the picture's middle
        w.label(rightText, rightX, baseline);
        afterLeft = rowTop + OPTION_PICTURE_HEIGHT + 1;
        w.y = afterLeft;
      } else {
        w.text(`${i + 1}. ${left}   ____`, { indent: 6, width: colWidth, after: 0.6 });
        afterLeft = w.y;
        w.y = rowTop;
        w.text(rightText, { x: rightX, width: colWidth, after: 0.6 });
      }
      w.y = Math.max(afterLeft, w.y);
    });
  } else {
    const lines = question.type === "fill_blank" ? 0 : 2;
    for (let i = 0; i < lines; i += 1) {
      w.ensure(7);
      doc.setDrawColor(190, 198, 210);
      doc.setLineWidth(0.2);
      doc.line(MARGIN + 6, w.y + 6, PAGE_WIDTH - MARGIN, w.y + 6);
      w.space(7);
    }
  }
  w.space(3.5);
};

const drawPaper = (w, doc, { student, assessment }) => {
  drawHeader(w, doc, { title: "Assessment Paper", student, assessment });
  w.text(`Answer all ${assessment.questions.length} questions. Total marks: ${assessment.questions.length} (1 mark each). A grown-up reads each question aloud to young children.`, { size: 10, color: MUTED, after: 3 });

  let lastType = null;
  let section = 0;
  assessment.questions.forEach((question, index) => {
    if (question.type !== lastType) {
      lastType = question.type;
      // Room for the heading plus the first question, so a heading is never left alone at a page foot.
      w.ensure(42);
      w.space(1.5);
      w.text(`Section ${String.fromCharCode(65 + section)} - ${QUESTION_TYPES[question.type]}`, { size: 12, style: "bold", color: ACCENT, after: 2 });
      section += 1;
    }
    drawQuestion(w, doc, question, index + 1);
  });
};

// ---- Part 2: answers and performance ----

const drawPill = (doc, w, label, color) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const width = doc.getTextWidth(pdfSafe(label)) + 8;
  w.ensure(9);
  doc.setFillColor(...color);
  doc.roundedRect(MARGIN, w.y, width, 7.5, 3.5, 3.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(pdfSafe(label), MARGIN + 4, w.y + 5.2);
  w.space(10.5);
};

const matchLetter = (index) => OPTION_LABELS[index] || String.fromCharCode(65 + index);

// "1-B  2-A  3-C": how the paper labels a match question (rows numbered, items lettered), and it
// still reads sensibly when a row is a picture, which cannot be spelled out in text.
const describeMatch = (question, answer) =>
  question.lefts.map((_, i) => `${i + 1}-${Number.isInteger(answer?.[i]) ? matchLetter(answer[i]) : "?"}`).join("   ");

const drawReport = (w, doc, { student, assessment }) => {
  w.newPage();
  drawHeader(w, doc, { title: "Answer & Performance Report", student, assessment });

  const incorrect = assessment.total - assessment.correct;
  w.text(`Score: ${assessment.correct} / ${assessment.total}   |   Percentage: ${Math.round(assessment.percentage)}%`, { size: 14, style: "bold", after: 2.5 });
  // Worked out from the score, so a paper saved under older level bands is still labelled by the current ones.
  const level = getPerformanceLevel(assessment.percentage).label;
  drawPill(doc, w, `Performance level: ${level}`, LEVEL_COLORS[level] || ACCENT);
  w.text(`Total questions: ${assessment.total}     Correct: ${assessment.correct}     Incorrect: ${incorrect}`, { after: 3 });

  if (assessment.summary) w.text(assessment.summary, { color: MUTED, after: 4 });

  const ratings = assessment.skillRatings || [];
  if (ratings.length > 0) {
    w.text("Teacher's observation (before the paper)", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
    ratings.forEach((entry) => w.text(`${entry.topic}: ${entry.rating}`, { indent: 4, after: 0.6 }));
    w.space(3);
  }

  const strengths = deriveStrengths(assessment.skillResults || [], ratings);
  w.text("Strengths", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
  w.text(strengths.length > 0 ? strengths.map((entry) => entry.skill).join("; ") : "No topic reached the mastery bar on this paper yet.", { indent: 4, after: 3 });

  w.text("Development areas", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
  (assessment.areaResults || summarizeAreas(assessment.questions, assessment.results)).forEach((entry) => {
    w.text(`${entry.area}: ${entry.correct}/${entry.total} (${Math.round(entry.percentage)}%)`, { indent: 4, color: entry.percentage >= 75 ? GOOD : INK, after: 0.6 });
  });
  w.space(3);

  w.text("Topic-wise performance", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
  assessment.skillResults.forEach((entry) => {
    w.text(`${entry.skill}: ${entry.correct}/${entry.total} (${Math.round(entry.percentage)}%)`, { indent: 4, color: entry.correct === entry.total ? GOOD : INK, after: 0.6 });
  });
  w.space(3);

  w.text("Areas of improvement", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
  if (assessment.weakAreas.length === 0) {
    w.text("None - the child showed a secure understanding of every topic on this paper.", { indent: 4, after: 3 });
  } else {
    assessment.weakAreas.forEach((area) => {
      w.text(area.area ? `${area.skill} (${area.area})` : area.skill, { indent: 4, style: "bold", color: BAD, after: 0.4 });
      w.text(area.diagnosis, { indent: 8, color: MUTED, after: 1.5 });
    });
    w.space(1.5);
  }

  w.text("AI recommendations", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
  assessment.recommendations.forEach((tip) => w.text(`- ${tip}`, { indent: 4, after: 0.8 }));
  w.space(4);

  if (assessment.improvementPlan?.length) {
    w.ensure(24);
    w.text("Recommended improvement activities and resources", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
    assessment.improvementPlan.forEach((item) => {
      w.ensure(20);
      w.text(item.skill, { indent: 4, style: "bold", after: 0.4 });
      item.activities.forEach((activity) => w.text(`- ${activity}`, { indent: 8, after: 0.4 }));
      if (item.resources.length) w.text(`Resources: ${item.resources.join("; ")}`, { indent: 8, size: 9.5, color: MUTED, after: 1.5 });
    });
    w.space(4);
  }

  if (assessment.teacherRemarks) {
    w.ensure(20);
    w.text("Teacher's remarks", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
    w.text(assessment.teacherRemarks, { indent: 4, after: 4 });
  }

  w.ensure(20);
  w.text("Question-by-question review", { size: 12, style: "bold", color: ACCENT, after: 2 });
  assessment.questions.forEach((question, index) => {
    const result = assessment.results[index] || { correct: false };
    const isMatch = question.type === "match";
    const given = isMatch ? describeMatch(question, assessment.answers[index]) : formatStudentAnswer(question, assessment.answers[index]);
    const expected = isMatch ? describeMatch(question, question.correctMatches) : formatCorrectAnswer(question);
    const need = w.measure(`${index + 1}. ${question.question}`) + w.measure(`Student's answer: ${given}`, { width: CONTENT_WIDTH - 6 }) + w.measure(`Correct answer: ${expected}`, { width: CONTENT_WIDTH - 6 }) + 8;

    w.ensure(Math.min(need, 45));
    w.text(`${index + 1}. ${question.question}`, { style: "bold", after: 0.6 });
    w.text(`Student's answer: ${given}   [${result.correct ? "Correct" : "Incorrect"}]`, { indent: 6, color: result.correct ? GOOD : BAD, after: 0.4 });
    if (!result.correct) {
      w.text(`Correct answer: ${expected}`, { indent: 6, after: 0.4 });
      if (isMatch) w.text(`Items: ${question.rights.map((right, i) => `${matchLetter(i)}. ${right}`).join("; ")}`, { indent: 6, size: 9.5, color: MUTED, after: 0.4 });
      if (question.explanation) w.text(`Why: ${question.explanation}`, { indent: 6, size: 9.5, color: MUTED, after: 0.4 });
    }
    w.space(2.5);
  });
};

const addFooters = (doc) => {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("Adiuvaret AI Classroom Generator", MARGIN, PAGE_HEIGHT - 9);
    doc.text(`Page ${page} of ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 9, { align: "right" });
  }
};

/**
 * `emojiImage` turns an emoji into a PNG data URL (null when it can't); the default draws it on a
 * canvas, which only exists in a browser.
 */
export const buildAssessmentPdf = async ({ assessment, student, emojiImage = emojiToPngDataUrl }) => {
  // Loaded on demand: jsPDF is large and only the Download button needs it.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = createWriter(doc, emojiImage);

  drawPaper(w, doc, { student, assessment });
  drawReport(w, doc, { student, assessment });
  addFooters(doc);

  return doc;
};

export const downloadAssessmentPdf = async ({ assessment, student }) => {
  const doc = await buildAssessmentPdf({ assessment, student });
  const stamp = new Date(assessment.createdAt).toISOString().slice(0, 10);
  doc.save(`${fileSafe(student.name) || "student"}-${fileSafe(assessment.subject)}-${assessment.kind}-${stamp}.pdf`);
};
