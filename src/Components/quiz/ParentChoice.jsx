import React from "react";
import { Users, Sparkles, HeartHandshake } from "lucide-react";
import { PARENT_QUESTION, PARENT_QUESTION_PERFECT, OFFLINE_THANK_YOU, PARENT_CHOICES, PARENT_CHOICE_LABELS } from "../../Services/parentChoice";

// What a parent is asked after reading the analysis. Both answers are optional and neither one touches the quiz:
//  - AI Classes opens the subscription plans (the only place a payment is ever offered).
//  - Offline Tuition Classes only shows a thank-you message: no redirect, no form, no payment, no popup.

const ParentChoice = ({ choice, onChoose, perfect = false }) => (
  <section className="quiz-parent-choice" aria-labelledby="quiz-parent-question">
    <h4 id="quiz-parent-question"><HeartHandshake size={16} /> {perfect ? PARENT_QUESTION_PERFECT : PARENT_QUESTION}</h4>

    <div className="quiz-parent-options">
      <button type="button" className={`quiz-parent-btn ${choice === PARENT_CHOICES.offline ? "chosen" : ""}`} aria-pressed={choice === PARENT_CHOICES.offline} onClick={() => onChoose(PARENT_CHOICES.offline)}>
        <Users size={20} />
        <span>{PARENT_CHOICE_LABELS.offline}</span>
      </button>
      <button type="button" className="quiz-parent-btn" onClick={() => onChoose(PARENT_CHOICES.ai)}>
        <Sparkles size={20} />
        <span>{PARENT_CHOICE_LABELS.ai}</span>
      </button>
    </div>

    {choice === PARENT_CHOICES.offline && (
      <p className="quiz-parent-thanks" role="status">{OFFLINE_THANK_YOU}</p>
    )}
  </section>
);

export default ParentChoice;
