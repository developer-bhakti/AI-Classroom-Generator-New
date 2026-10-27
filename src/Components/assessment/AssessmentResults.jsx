import React, { useMemo } from "react";
import { CheckCircle2, Download, FileText, Lightbulb, Star, XCircle } from "lucide-react";
import {
  MASTERY_THRESHOLD,
  QUESTION_TYPES,
  deriveStrengths,
  formatCorrectAnswer,
  formatStudentAnswer,
  summarizeAreas
} from "../../Services/assessmentGrading";
import { groupAreasOfImprovement } from "../../Services/assessmentReport";
import { LevelPill, ScoreRing } from "./Badges";

const Bar = ({ label, percentage }) => (
  <div className="assess-bar" role="img" aria-label={`${label}: ${Math.round(percentage)} percent`}>
    <div className={`assess-bar-fill ${percentage >= MASTERY_THRESHOLD ? "good" : "weak"}`} style={{ width: `${Math.max(percentage, 2)}%` }} />
  </div>
);

const AssessmentResults = ({ record, onOpenReport, onDownload, downloading = false, children }) => {
  // Older saved rows predate area tagging; deriving it here keeps them readable too.
  const areaResults = useMemo(() => record.areaResults || summarizeAreas(record.questions, record.results), [record]);
  const groups = useMemo(() => groupAreasOfImprovement(record.weakAreas, areaResults), [record, areaResults]);
  const strengths = useMemo(() => deriveStrengths(record.skillResults, record.skillRatings || []), [record]);

  const stats = [
    { label: "Total questions", value: record.total },
    { label: "Correct answers", value: record.correct },
    { label: "Incorrect answers", value: record.total - record.correct },
    { label: "Percentage", value: `${Math.round(record.percentage)}%` }
  ];

  return (
    <div className="assess-results">
      <div className="assess-score-card">
        <ScoreRing percentage={record.percentage} />
        <div className="assess-score-copy">
          <strong>{record.correct} / {record.total}</strong>
          <span>Score = {record.correct} ÷ {record.total} × 100 = {Math.round(record.percentage)}%</span>
          <LevelPill percentage={record.percentage} />
        </div>
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
        <h4><Star size={16} /> Strengths</h4>
        {strengths.length > 0 ? (
          <div className="assess-chip-row">
            {strengths.map((strength) => <span key={strength.skill} className="assess-chip good static">{strength.skill}</span>)}
          </div>
        ) : (
          <p className="cell-muted">No topic reached {MASTERY_THRESHOLD}% on this paper yet — every small step counts.</p>
        )}
      </section>

      <section className="assess-section">
        <h4>Development areas</h4>
        <ul className="assess-skill-list">
          {areaResults.map((entry) => (
            <li key={entry.area}>
              <div className="assess-skill-head">
                <span>{entry.area}</span>
                <span className="cell-muted">{entry.correct}/{entry.total} · {Math.round(entry.percentage)}%</span>
              </div>
              <Bar label={entry.area} percentage={entry.percentage} />
            </li>
          ))}
        </ul>
      </section>

      <section className="assess-section">
        <h4>Topic-wise performance</h4>
        <ul className="assess-skill-list">
          {record.skillResults.map((entry) => (
            <li key={entry.skill}>
              <div className="assess-skill-head">
                <span>{entry.skill}</span>
                <span className="cell-muted">{entry.correct}/{entry.total} · {Math.round(entry.percentage)}%</span>
              </div>
              <Bar label={entry.skill} percentage={entry.percentage} />
            </li>
          ))}
        </ul>
      </section>

      <section className="assess-section">
        <h4>Areas of improvement</h4>
        {groups.length === 0 ? (
          <p className="assess-good-news"><CheckCircle2 size={16} /> No weak areas — the child showed a secure understanding of every topic on this paper.</p>
        ) : (
          <div className="assess-area-groups">
            {groups.map((group) => (
              <div className="assess-area-group" key={group.area}>
                <div className="assess-area-group-head">
                  <span aria-hidden="true">{group.emoji}</span>
                  <strong>{group.area}</strong>
                  {group.percentage != null ? <span className="cell-muted">{Math.round(group.percentage)}% in this area</span> : null}
                </div>
                <ul className="assess-weak-list">
                  {group.topics.map((weak) => (
                    <li key={weak.skill}>
                      <div className="assess-weak-head">
                        <strong>{weak.skill}</strong>
                        {weak.rating ? <span className="assess-tag">{`Teacher's rating: ${weak.rating}`}</span> : null}
                        <span className="cell-muted">{weak.total > 0 ? `${weak.correct}/${weak.total} correct` : "from your observation"}</span>
                      </div>
                      <p>{weak.diagnosis}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
                  <span>{index + 1}. {question.picture ? <span className="review-picture">{question.picture} </span> : null}{question.question}</span>
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

      <div className="assess-result-actions">
        {onOpenReport ? (
          <button type="button" className="primary-btn" onClick={onOpenReport}>
            <FileText size={16} /> Progress report for parents
          </button>
        ) : null}
        {onDownload ? (
          <button type="button" className="secondary-btn" onClick={onDownload} disabled={downloading}>
            <Download size={16} /> {downloading ? "Preparing PDF…" : "Download paper & answers (PDF)"}
          </button>
        ) : null}
      </div>

      {children}
    </div>
  );
};

export default AssessmentResults;
