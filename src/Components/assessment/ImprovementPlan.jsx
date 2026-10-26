import React from "react";
import { BookOpen, Gamepad2 } from "lucide-react";

// The "No" branch: things the child can do without an online teacher, one card per weak topic.
const ImprovementPlan = ({ plan }) => {
  if (plan.length === 0) {
    return <p className="assess-good-news">No weak topics to work on — keep up the regular practice.</p>;
  }

  return (
    <div className="improve-plan">
      <h4>Recommended improvement activities and resources</h4>
      <div className="improve-plan-grid">
        {plan.map((item) => (
          <article className="improve-card" key={item.skill}>
            <h5>{item.skill}</h5>
            <div>
              <p className="improve-label"><Gamepad2 size={14} /> Activities</p>
              <ul>{item.activities.map((activity, index) => <li key={index}>{activity}</li>)}</ul>
            </div>
            <div>
              <p className="improve-label"><BookOpen size={14} /> Resources</p>
              <ul>{item.resources.map((resource, index) => <li key={index}>{resource}</li>)}</ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default ImprovementPlan;
