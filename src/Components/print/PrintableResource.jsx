import React, { useMemo } from "react";
import { buildRound } from "../../Services/quizRounds";
import { answerLines, cleanPrintedItem, isNumberedItem, isStudentSheet, kindLabel, metaLine } from "../../Services/printLayout";

const LETTERS = ["A", "B", "C", "D", "E"];

const Lines = ({ count }) => (
  count > 0 ? <span className="print-lines" aria-hidden="true">{Array.from({ length: count }, (_, i) => <span key={i} className="print-line" />)}</span> : null
);

const Sections = ({ kind, sections }) => sections.map((section, sectionIndex) => (
  <section className="print-section" key={sectionIndex}>
    <h2>{section.heading}</h2>
    {section.items.map((raw, itemIndex) => {
      const item = cleanPrintedItem(raw);
      return (
        <div key={itemIndex} className={`print-item ${isNumberedItem(item) ? "numbered" : "plain"}`}>
          <p>{item}</p>
          <Lines count={answerLines(kind, section.heading, item)} />
        </div>
      );
    })}
  </section>
));

// A quiz sheet: the questions and their options, never the answers. Options are shuffled here too, because
// a model tends to put the right answer first and a printed sheet would give it away.
const QuizBody = ({ questions }) => {
  const sheet = useMemo(() => buildRound(questions || []), [questions]);
  return (
    <ol className="print-quiz">
      {sheet.map((item, index) => (
        <li key={index} className="print-question">
          <p>{item.question}</p>
          <div className="print-options">
            {item.options.map((option, optionIndex) => (
              <span key={optionIndex} className="print-option"><span className="print-bubble" aria-hidden="true" />{LETTERS[optionIndex]}. {option}</span>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
};

/**
 * What comes out of the printer. Hidden on screen (it lives inside a print-root); the print stylesheet shows
 * it on its own. `kind` is worksheet | lesson | quiz | activity | exam | answer-key.
 */
const PrintableResource = ({ kind, resource, meta = {}, image = null }) => {
  // A worksheet drawn by the image model is already a finished page: print it full-page, nothing around it.
  if (image) {
    return (
      <div className="print-doc print-doc-image-page">
        <img className="print-doc-image" src={image} alt={resource?.title || "Worksheet"} />
      </div>
    );
  }

  const sections = (kind === "answer-key" ? resource.answerKey : resource.sections) || [];
  const marksBox = kind === "quiz" ? `Score: ____ / ${resource.questions?.length || ""}` : kind === "exam" && meta.totalMarks ? `Marks: ____ / ${meta.totalMarks}` : null;
  const line = metaLine(kind, meta);

  return (
    <div className={`print-doc print-doc-${kind}`}>
      <header className="print-head">
        <p className="print-brand">Adiuvaret AI Classroom Generator · {kindLabel(kind)}</p>
        <h1>{resource.title}</h1>
        {line ? <p className="print-meta">{line}</p> : null}
        {kind === "answer-key" ? <p className="print-banner">Teacher copy: answer key. Not for students.</p> : null}
        {isStudentSheet(kind) ? (
          <div className="print-fields">
            <span>Name: <i /></span>
            <span>Class: <i /></span>
            <span>Date: <i /></span>
            {marksBox ? <strong>{marksBox}</strong> : null}
          </div>
        ) : null}
        {kind === "quiz" ? <p className="print-instruction">Read each question. Colour the circle next to the right answer.</p> : null}
        {kind === "exam" && meta.instructions ? <p className="print-instruction"><strong>Instructions:</strong> {meta.instructions}</p> : null}
        {kind !== "answer-key" && kind !== "quiz" && resource.summary ? <p className="print-summary">{resource.summary}</p> : null}
      </header>

      {kind === "quiz" ? <QuizBody questions={resource.questions} /> : <Sections kind={kind} sections={sections} />}

      <footer className="print-foot">{kind === "lesson" || kind === "activity" ? "Teacher resource · " : ""}Made with Adiuvaret AI Classroom Generator</footer>
    </div>
  );
};

export default PrintableResource;
