import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { OPTION_LABELS, QUESTION_TYPES, isAnswered } from "../../Services/assessmentGrading";

// Walks a child through a paper one question at a time. It owns only "which question is on
// screen"; the answers live in the parent so a page can read them when the paper is submitted.
const QuestionPlayer = ({ questions, answers, onAnswer, onSubmit, submitLabel = "Submit assessment", submitting = false }) => {
  const [index, setIndex] = useState(0);

  const total = questions.length;
  const question = questions[index];
  const answeredCount = questions.filter((q, i) => isAnswered(q, answers[i])).length;
  const unanswered = total - answeredCount;
  const isLast = index === total - 1;

  const renderInput = () => {
    const value = answers[index];

    if (question.type === "mcq" || question.type === "true_false") {
      return (
        <div className="quiz-options">
          {question.options.map((option, optionIndex) => (
            <button
              type="button"
              key={optionIndex}
              className={`quiz-option-btn ${value === optionIndex ? "selected" : ""}`}
              onClick={() => onAnswer(index, optionIndex)}
            >
              <span className="quiz-option-label">{question.type === "mcq" ? OPTION_LABELS[optionIndex] : optionIndex === 0 ? "T" : "F"}</span>
              {option}
            </button>
          ))}
        </div>
      );
    }

    if (question.type === "match") {
      return (
        <div className="assess-match">
          <ol className="assess-match-rights">
            {question.rights.map((right, rightIndex) => (
              <li key={rightIndex}><span className="quiz-option-label">{OPTION_LABELS[rightIndex] || String.fromCharCode(65 + rightIndex)}</span>{right}</li>
            ))}
          </ol>
          {question.lefts.map((left, leftIndex) => (
            <div className="assess-match-row" key={leftIndex}>
              <span className="assess-match-left">{leftIndex + 1}. {left}</span>
              <select
                aria-label={`Match for ${left}`}
                value={Number.isInteger(value?.[leftIndex]) ? value[leftIndex] : ""}
                onChange={(e) => {
                  const next = [...(value || new Array(question.lefts.length).fill(null))];
                  next[leftIndex] = e.target.value === "" ? null : Number(e.target.value);
                  onAnswer(index, next);
                }}
              >
                <option value="">Choose…</option>
                {question.rights.map((_, rightIndex) => (
                  <option key={rightIndex} value={rightIndex}>{OPTION_LABELS[rightIndex] || String.fromCharCode(65 + rightIndex)}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    if (question.type === "fill_blank") {
      return (
        <input
          className="assess-text-input"
          value={value || ""}
          placeholder="Type the missing word or number"
          onChange={(e) => onAnswer(index, e.target.value)}
          autoComplete="off"
        />
      );
    }

    return (
      <textarea
        className="assess-text-input"
        rows={question.type === "problem_solving" ? 4 : 3}
        value={value || ""}
        placeholder={question.type === "problem_solving" ? "Write your working and answer" : "Write your answer"}
        onChange={(e) => onAnswer(index, e.target.value)}
      />
    );
  };

  return (
    <div className="quiz-active">
      <div className="quiz-progress-row">
        <span>Question {index + 1} of {total}</span>
        <div className="quiz-progress-track">
          <div className="quiz-progress-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="assess-dots" role="group" aria-label="Jump to a question">
        {questions.map((q, i) => (
          <button
            type="button"
            key={q.id}
            className={`assess-dot ${i === index ? "current" : ""} ${isAnswered(q, answers[i]) ? "done" : ""}`}
            onClick={() => setIndex(i)}
            aria-label={`Question ${i + 1}${isAnswered(q, answers[i]) ? ", answered" : ""}`}
            aria-current={i === index ? "step" : undefined}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <span className="preview-chip">{QUESTION_TYPES[question.type]}</span>
      <h4 className="quiz-question-text">{question.question}</h4>
      {renderInput()}

      <div className="quiz-nav-row">
        <button type="button" className="secondary-btn" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          <ChevronLeft size={16} /> Previous
        </button>
        {isLast ? (
          <button type="button" className="primary-btn" onClick={onSubmit} disabled={submitting}>
            <Send size={16} /> {submitLabel}{unanswered > 0 ? ` (${unanswered} unanswered)` : ""}
          </button>
        ) : (
          <button type="button" className="primary-btn" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
            Next <ChevronRight size={16} />
          </button>
        )}
      </div>

      {!isLast && answeredCount === total ? (
        <button type="button" className="secondary-btn full" onClick={onSubmit} disabled={submitting}>
          <Send size={16} /> {submitLabel}
        </button>
      ) : null}
    </div>
  );
};

export default QuestionPlayer;
