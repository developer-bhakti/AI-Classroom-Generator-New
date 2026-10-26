import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { RATINGS } from "../../Services/assessmentGrading";

/**
 * "Evaluate the child according to the current syllabus." The teacher rates every syllabus topic
 * from what they have seen in class; those ratings steer the paper and later sit beside the
 * child's answers when the areas of improvement are worked out.
 */
const SkillEvaluation = ({ items, ratings, onRate, onBack, onContinue, continueLabel }) => {
  const rated = items.filter((item) => ratings[item.number]).length;
  const complete = rated === items.length;
  const showMonths = new Set(items.map((item) => item.month)).size > 1;

  return (
    <div className="eval">
      <ol className="eval-list">
        {items.map((item) => (
          <li className="eval-item" key={item.number}>
            <div className="eval-topic">
              <span className="eval-num" aria-hidden="true">{item.number}</span>
              <p>
                {item.text}
                {showMonths ? <span className="eval-month">{item.month}</span> : null}
              </p>
            </div>
            <div className="eval-rates" role="group" aria-label={`How is the child doing on: ${item.text}`}>
              {RATINGS.map((rating) => {
                const selected = ratings[item.number] === rating.value;
                return (
                  <button
                    type="button"
                    key={rating.value}
                    className={`eval-rate eval-rate-${rating.tone} ${selected ? "selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => onRate(item.number, rating.value)}
                  >
                    <span className="eval-rate-emoji" aria-hidden="true">{rating.emoji}</span>
                    {rating.value}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="eval-footer">
        <div className="eval-progress" aria-live="polite">
          <span>{rated} of {items.length} topics rated</span>
          <div className="quiz-progress-track"><div className="quiz-progress-fill" style={{ width: `${items.length ? (rated / items.length) * 100 : 0}%` }} /></div>
        </div>
        <div className="eval-actions">
          <button type="button" className="secondary-btn" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          <button type="button" className="primary-btn" onClick={onContinue} disabled={!complete}>
            {continueLabel} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkillEvaluation;
