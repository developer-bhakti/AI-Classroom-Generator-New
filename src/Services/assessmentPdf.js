import {
  QUESTION_TYPES,
  OPTION_LABELS,
  formatCorrectAnswer,
  formatStudentAnswer
} from "./assessmentGrading";

// Two parts in one file: the paper a child sits (questions only), then the answer and
// performance report for the teacher. Built straight from the saved assessment, so a paper can be
// re-downloaded any time without calling the AI again.

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = PAGE_HEIGHT - 18;
const PT_TO_MM = 0.3528;

const INK = [30, 41, 59];
const MUTED = [100, 116, 139];
const ACCENT = [59, 100, 214];
const GOOD = [22, 134, 74];
const BAD = [200, 40, 40];
const LEVEL_COLORS = {
  Excellent: [22, 134, 74],
  Good: [37, 99, 235],
  Average: [196, 110, 8],
  "Improvement Required": [200, 40, 40]
};

const KIND_LABELS = {
  end_term: "End-Term Assessment",
  current: "Current Academic Assessment",
  practice: "Practice Set"
};

// jsPDF's built-in fonts only cover Latin-1 / WinAnsi. Map the symbols the model likes to use onto
// that range and drop the rest rather than printing garbage glyphs.
const REPLACEMENTS = [
  [/[→⟶⇒]/g, "->"], [/[←]/g, "<-"], [/≥/g, ">="], [/≤/g, "<="], [/≠/g, "!="], [/≈/g, "~"],
  [/₹/g, "Rs. "], [/[✓✔]/g, "(correct)"], [/[✗✘]/g, "(wrong)"], [/[−–—]/g, "-"],
  [/[‘’]/g, "'"], [/[“”]/g, '"'], [/…/g, "..."], [/ /g, " "]
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

const createWriter = (doc) => {
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
  const rowTop = w.y;
  w.text(`Student: ${student.name}`, { width: half, after: 1 });
  const afterLeft = w.y;
  w.y = rowTop;
  w.text(`Date: ${formatDate(assessment.createdAt)}`, { x: MARGIN + half, width: half, after: 1 });
  w.y = Math.max(afterLeft, w.y);

  const rowTop2 = w.y;
  w.text(`Class: ${assessment.className}`, { width: half, after: 1 });
  const afterLeft2 = w.y;
  w.y = rowTop2;
  w.text(`Subject: ${assessment.subject}`, { x: MARGIN + half, width: half, after: 1 });
  w.y = Math.max(afterLeft2, w.y);

  const topics = assessment.kind === "practice"
    ? [assessment.focusSkill].filter(Boolean)
    : assessment.topics;
  const covered = topics?.length ? topics.join("; ") : `Standard ${assessment.className} ${assessment.subject} syllabus${assessment.kind === "end_term" ? " (whole term)" : ""}`;
  w.text(`Syllabus / topics covered: ${covered}`, { after: 1 });
  if (assessment.progressNote) w.text(`Progress note: ${assessment.progressNote}`, { color: MUTED, after: 1 });
  w.space(1);
  w.rule();
};

// ---- Part 1: the paper ----

const drawQuestion = (w, doc, question, number) => {
  const stem = `${number}. ${question.question}`;
  let bodyHeight = 8; // answer space for typed answers

  if (question.type === "mcq" || question.type === "true_false") {
    bodyHeight = question.options.reduce((sum, option) => sum + w.measure(`(${OPTION_LABELS[0]}) ${option}`, { width: CONTENT_WIDTH - 10 }), 0);
  } else if (question.type === "match") {
    bodyHeight = question.lefts.length * (w.lineHeight(10.5) + 1) + w.lineHeight(9.5);
  } else if (question.type === "short_answer" || question.type === "problem_solving") {
    bodyHeight = 16;
  }

  // Keep the stem with its options/answer space instead of stranding it at the foot of a page.
  w.ensure(w.measure(stem) + Math.min(bodyHeight, 30) + 3);
  w.text(stem, { after: 1.2 });

  if (question.type === "mcq") {
    question.options.forEach((option, i) => w.text(`(${OPTION_LABELS[i]}) ${option}`, { indent: 6, after: 0.4 }));
  } else if (question.type === "true_false") {
    w.text("(   ) True        (   ) False", { indent: 6, after: 0.4 });
  } else if (question.type === "match") {
    w.text("Write the letter of the matching item on the line.", { size: 9.5, color: MUTED, indent: 6, after: 1 });
    const colWidth = CONTENT_WIDTH / 2 - 10;
    question.lefts.forEach((left, i) => {
      const rowTop = w.y;
      w.text(`${i + 1}. ${left}   ____`, { indent: 6, width: colWidth, after: 0.6 });
      const afterLeft = w.y;
      w.y = rowTop;
      w.text(`${OPTION_LABELS[i] || String.fromCharCode(65 + i)}. ${question.rights[i]}`, { x: MARGIN + CONTENT_WIDTH / 2 + 6, width: colWidth, after: 0.6 });
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
  w.text(`Answer all ${assessment.questions.length} questions. Total marks: ${assessment.questions.length} (1 mark each).`, { size: 10, color: MUTED, after: 3 });

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

const drawReport = (w, doc, { student, assessment }) => {
  w.newPage();
  drawHeader(w, doc, { title: "Answer & Performance Report", student, assessment });

  const incorrect = assessment.total - assessment.correct;
  w.text(`Score: ${assessment.correct} / ${assessment.total}   |   Percentage: ${Math.round(assessment.percentage)}%`, { size: 14, style: "bold", after: 2.5 });
  drawPill(doc, w, `Performance level: ${assessment.level}`, LEVEL_COLORS[assessment.level] || ACCENT);
  w.text(`Total questions: ${assessment.total}     Correct: ${assessment.correct}     Incorrect: ${incorrect}`, { after: 3 });

  if (assessment.summary) w.text(assessment.summary, { color: MUTED, after: 4 });

  w.text("Skill breakdown", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
  assessment.skillResults.forEach((entry) => {
    w.text(`${entry.skill}: ${entry.correct}/${entry.total} (${Math.round(entry.percentage)}%)`, { indent: 4, color: entry.correct === entry.total ? GOOD : INK, after: 0.6 });
  });
  w.space(3);

  w.text("Areas of improvement", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
  if (assessment.weakAreas.length === 0) {
    w.text("None - the child showed a secure understanding of every skill on this paper.", { indent: 4, after: 3 });
  } else {
    assessment.weakAreas.forEach((area) => {
      w.text(area.skill, { indent: 4, style: "bold", color: BAD, after: 0.4 });
      w.text(area.diagnosis, { indent: 8, color: MUTED, after: 1.5 });
    });
    w.space(1.5);
  }

  w.text("AI recommendations", { size: 12, style: "bold", color: ACCENT, after: 1.5 });
  assessment.recommendations.forEach((tip) => w.text(`- ${tip}`, { indent: 4, after: 0.8 }));
  w.space(4);

  w.ensure(20);
  w.text("Question-by-question review", { size: 12, style: "bold", color: ACCENT, after: 2 });
  assessment.questions.forEach((question, index) => {
    const result = assessment.results[index] || { correct: false };
    const given = formatStudentAnswer(question, assessment.answers[index]);
    const expected = formatCorrectAnswer(question);
    const need = w.measure(`${index + 1}. ${question.question}`) + w.measure(`Student's answer: ${given}`, { width: CONTENT_WIDTH - 6 }) + w.measure(`Correct answer: ${expected}`, { width: CONTENT_WIDTH - 6 }) + 8;

    w.ensure(Math.min(need, 45));
    w.text(`${index + 1}. ${question.question}`, { style: "bold", after: 0.6 });
    w.text(`Student's answer: ${given}   [${result.correct ? "Correct" : "Incorrect"}]`, { indent: 6, color: result.correct ? GOOD : BAD, after: 0.4 });
    if (!result.correct) {
      w.text(`Correct answer: ${expected}`, { indent: 6, after: 0.4 });
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

export const buildAssessmentPdf = async ({ assessment, student }) => {
  // Loaded on demand: jsPDF is large and only the Download button needs it.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = createWriter(doc);

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
