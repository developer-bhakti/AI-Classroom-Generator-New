import React from "react";
import { BarChart3, CheckCircle2, TrendingUp, Target, Lightbulb } from "lucide-react";
import { LevelPill } from "../assessment/Badges";

// The parent's performance analysis after a quiz. Everything here is worked out by quizAnalysis.js from the
// child's first full attempt; this component only lays it out.

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const TopicGroup = ({ tone, icon: Icon, title, hint, topics }) => (
  <div className={`quiz-analysis-group quiz-analysis-${tone}`}>
    <h5><Icon size={15} /> {title}</h5>
    <p className="quiz-analysis-hint">{hint}</p>
    <ul>
      {topics.map((topic) => (
        <li key={topic.name}>
          <span className="quiz-analysis-topic">{topic.name}</span>
          <span className="quiz-analysis-score">{topic.correct} of {topic.total} right · {topic.percentage}%</span>
        </li>
      ))}
    </ul>
  </div>
);

const QuizAnalysis = ({ analysis }) => {
  const { attempted, correct, incorrect, percentage, improvement, strong, improve, practise, focus, activities, hasBreakdown } = analysis;

  return (
    <section className="quiz-analysis" aria-labelledby="quiz-analysis-title">
      <h4 id="quiz-analysis-title"><BarChart3 size={16} /> Performance analysis</h4>
      <p className="quiz-analysis-hint">For parents and teachers. This is based on the first time your child went through the whole quiz.</p>

      <dl className="quiz-analysis-stats">
        <div><dt>Attempted</dt><dd>{attempted}</dd></div>
        <div className="good"><dt>Correct</dt><dd>{correct}</dd></div>
        <div className="bad"><dt>Incorrect</dt><dd>{incorrect}</dd></div>
        <div><dt>Score</dt><dd>{percentage}%</dd></div>
      </dl>
      <p className="quiz-analysis-level"><LevelPill percentage={percentage} /></p>

      <div className={`quiz-analysis-gap ${improvement.target ? "needs" : "done"}`}>
        <h5><TrendingUp size={15} /> How much improvement is needed</h5>
        <p>{improvement.summary}</p>
      </div>

      {hasBreakdown && (
        <div className="quiz-analysis-groups">
          {strong.length > 0 && (
            <TopicGroup tone="good" icon={CheckCircle2} title="Doing well" hint="75% or more of these were right." topics={strong} />
          )}
          {improve.length > 0 && (
            <TopicGroup tone="warn" icon={TrendingUp} title="Needs improvement" hint="Between 50% and 74% right. A little more practice will get these there." topics={improve} />
          )}
          {practise.length > 0 && (
            <TopicGroup tone="bad" icon={Target} title="Needs additional practice" hint="Less than half were right. Start with these." topics={practise} />
          )}
        </div>
      )}

      {focus.length > 0 ? (
        <div className="quiz-analysis-focus">
          <h5><Target size={15} /> Where to focus</h5>
          <ol>
            {focus.map((topic) => (
              <li key={topic.name}>
                <strong>{topic.name}</strong>
                {topic.rightNeeded > 0
                  ? `: ${topic.correct} of ${topic.total} right. Getting ${plural(topic.rightNeeded, "more question")} right would bring this to Good.`
                  : `: ${topic.correct} of ${topic.total} right. Keep practising to make it steady.`}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="quiz-analysis-hint">No topic needs extra practice right now. Keep up a little practice each week.</p>
      )}

      {activities.length > 0 && (
        <div className="quiz-analysis-activities">
          <h5><Lightbulb size={15} /> Recommended learning activities</h5>
          <ul>
            {activities.map((activity) => (
              <li key={activity.topic}>
                <strong>{activity.topic}:</strong> {activity.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default QuizAnalysis;
