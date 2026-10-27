import React from "react";
import { KeyRound } from "lucide-react";

/**
 * The exam's answer key, kept apart from the paper. Collapsed until the teacher opens it, and labelled so it
 * is never mistaken for part of what the students are given. Renders nothing when there is no key.
 */
const TeacherAnswerKey = ({ answerKey }) => {
  if (!Array.isArray(answerKey) || answerKey.length === 0) return null;

  return (
    <details className="answer-key">
      <summary>
        <KeyRound size={15} /> Teacher answer key <small>teacher only, not part of the student paper</small>
      </summary>
      {answerKey.map((section, sectionIndex) => (
        <div key={sectionIndex} className="output-section">
          <h4>{section.heading}</h4>
          <ul>
            {section.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
          </ul>
        </div>
      ))}
    </details>
  );
};

export default TeacherAnswerKey;
