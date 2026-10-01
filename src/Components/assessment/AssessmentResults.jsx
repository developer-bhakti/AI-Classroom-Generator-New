import React from "react";
import { AlertTriangle, CheckCircle2, Download, Lightbulb, XCircle } from "lucide-react";
import {
  MASTERY_THRESHOLD,
  QUESTION_TYPES,
  formatCorrectAnswer,
  formatStudentAnswer,
  toneForLevelLabel
} from "../../Services/assessmentGrading";

export const LevelPill = ({ level }) => (
  <span className={`assess-level assess-level-${toneForLevelLabel(level)}`}>{level}</span>
);

const AssessmentResults = ({ record, onDownload, downloading = false, children }) => {
  const stats = [
    { label: "Total questions", value: record.total },
    { label: "Correct answers", value: record.correct },
    { label: "Incorrect answers", value: record.total - record.correct },
    { label: "Percentage", value: `${Math.round(record.percentage)}%` }
  ];

  return (
    <div className="assess-results">
      <div className="assess-score-card">
        <div>
          <strong>{record.correct} / {record.total}</strong>
          <span>Score = {record.correct} ÷ {record.total} × 100 = {Math.round(record.percentage)}%</span>
        </div>
        <LevelPill level={record.level} />
      </div>

      <div className="assess-stats">
        {stats.map((stat) => (
          <div className="assess-stat" key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      {record.summary ? <p className="assess-summary">{record.summary}</p> : null}

      <section className="assess-section">
        <h4>Skill breakdown</h4>
        <ul className="assess-skill-list">
          {record.skillResults.map((entry) => (
            <li key={entry.skill}>
              <div className="assess-skill-head">
                <span>{entry.skill}</span>
                <span className="cell-muted">{entry.correct}/{entry.total}</span>
              </div>
              <div className="assess-bar" role="img" aria-label={`${entry.skill}: ${Math.round(entry.percentage)} percent`}>
                <div
                  className={`assess-bar-fill ${entry.percentage >= MASTERY_THRESHOLD ? "good" : "weak"}`}
                  style={{ width: `${Math.max(entry.percentage, 2)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="assess-section">
        <h4>Areas of improvement</h4>
        {record.weakAreas.length === 0 ? (
          <p className="assess-good-news"><CheckCircle2 size={16} /> No weak areas — the child showed a secure understanding of every skill on this paper.</p>
        ) : (
          <ul className="assess-weak-list">
            {record.weakAreas.map((area) => (
              <li key={area.skill}>
                <div className="assess-weak-head">
                  <AlertTriangle size={16} />
                  <strong>{area.skill}</strong>
                  <span className="cell-muted">{area.correct}/{area.total} correct</span>
                </div>
                <p>{area.diagnosis}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="assess-section">
        <h4><Lightbulb size={16} /> AI recommendations</h4>
        <ul className="assess-tips">
          {record.recommendations.map((tip, index) => <li key={index}>{tip}</li>)}
        </ul>
      </section>

      <details className="assess-section assess-review">
        <summary>Review every answer</summary>
        <div className="quiz-review-list">
          {record.questions.map((question, index) => {
            const correct = record.results[index]?.correct;
            return (
              <div key={question.id} className={`quiz-review-item ${correct ? "correct" : "incorrect"}`}>
                <div className="quiz-review-question">
                  {correct ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <span>{index + 1}. {question.question}</span>
                </div>
                <ul className="quiz-review-options">
                  <li className={correct ? "correct" : "incorrect"}>Child's answer: {formatStudentAnswer(question, record.answers[index])}</li>
                  {correct ? null : <li className="correct">Correct answer: {formatCorrectAnswer(question)}</li>}
                  {!correct && question.explanation ? <li>{question.explanation}</li> : null}
                  <li className="cell-muted">{QUESTION_TYPES[question.type]} · {question.skill}</li>
                </ul>
              </div>
            );
          })}
        </div>
      </details>

      {onDownload ? (
        <button type="button" className="secondary-btn" onClick={onDownload} disabled={downloading}>
          <Download size={16} /> {downloading ? "Preparing PDF…" : "Download PDF"}
        </button>
      ) : null}

      {children}
    </div>
  );
};

export default AssessmentResults;
