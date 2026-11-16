import { MASTERY_THRESHOLD } from "./assessmentGrading";

// Turns a finished quiz into the "performance analysis" a parent reads: the plain numbers, which topics went
// well, which need work, how much better the child has to get, and what to do about it. Pure (no network): the
// topic names and the practice activities come from the quiz itself, written when it was generated.

const EXTRA_PRACTICE_BELOW = 50; // under this a topic needs extra practice; MASTERY_THRESHOLD and above is "doing well"
const EXCELLENT = 90;

const key = (text) => String(text || "").trim().toLowerCase().replace(/\s+/g, " ");

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const topicStatus = (percentage) => (percentage >= MASTERY_THRESHOLD ? "strong" : percentage >= EXTRA_PRACTICE_BELOW ? "improve" : "practise");

/**
 * @param scored         the result of scoreRound() for the child's first full attempt
 * @param topics         [{ name, activity }] from the quiz: one hands-on activity for each topic
 * @param fallbackTopic  the name used for a question that came back without a topic
 */
export const analyseQuiz = ({ scored, topics = [], fallbackTopic = "This topic" }) => {
  const items = [...scored.right, ...scored.wrong].sort((a, b) => a.sourceIndex - b.sourceIndex);
  const total = scored.total;
  const activityFor = new Map(topics.filter((t) => t?.name).map((t) => [key(t.name), String(t.activity || "").trim()]));

  // ---- by topic
  const groups = new Map();
  items.forEach((item) => {
    const name = String(item.topic || "").trim() || fallbackTopic;
    const entry = groups.get(key(name)) || { name, correct: 0, total: 0, savedActivity: "" };
    // A quiz opened from History has no topic list, but each question carries its topic's activity.
    if (!entry.savedActivity && item.activity) entry.savedActivity = String(item.activity).trim();
    entry.total += 1;
    if (item.isCorrect) entry.correct += 1;
    groups.set(key(name), entry);
  });

  const byTopic = [...groups.values()]
    .map(({ savedActivity, ...entry }) => {
      const percentage = Math.round((entry.correct / entry.total) * 100);
      const status = topicStatus(percentage);
      const rightNeeded = Math.max(0, Math.ceil((MASTERY_THRESHOLD / 100) * entry.total) - entry.correct);
      return {
        ...entry,
        percentage,
        status,
        rightNeeded,
        activity: status === "strong" ? "" : activityFor.get(key(entry.name)) || savedActivity || `Practise "${entry.name}" with a few more questions, using real objects or pictures to show each answer.`
      };
    })
    .sort((a, b) => a.percentage - b.percentage || b.total - a.total || a.name.localeCompare(b.name));

  const strong = byTopic.filter((t) => t.status === "strong");
  const improve = byTopic.filter((t) => t.status === "improve");
  const practise = byTopic.filter((t) => t.status === "practise");

  // ---- how much better the child needs to get: the next level up
  const target = total === 0 ? null : scored.percentage < MASTERY_THRESHOLD ? { label: "Good", percent: MASTERY_THRESHOLD } : scored.percentage < EXCELLENT ? { label: "Excellent", percent: EXCELLENT } : null;
  const rightNeeded = target ? Math.max(1, Math.ceil((target.percent / 100) * total) - scored.correct) : 0;
  const points = target ? Math.max(1, Math.round(target.percent - scored.percentage)) : 0;

  const summary = !target
    ? total === 0
      ? "There are no answers to analyse yet."
      : `Your child is already at Excellent (${scored.percentage}%). Keep practising a little each week to stay there.`
    : `Your child scored ${scored.percentage}% (${scored.correct} of ${total}). To reach ${target.label} (${target.percent}%) they need ${plural(rightNeeded, "more right answer")} out of ${total}, an improvement of about ${plural(points, "percentage point")}.`;

  const focus = [...practise, ...improve];

  return {
    attempted: total,
    correct: scored.correct,
    incorrect: total - scored.correct,
    percentage: scored.percentage,
    level: scored.level,
    improvement: { target, rightNeeded, points, summary },
    topics: byTopic,
    strong,
    improve,
    practise,
    focus,
    activities: focus.map((t) => ({ topic: t.name, text: t.activity })),
    // With one topic the breakdown says nothing a parent could not read from the score.
    hasBreakdown: byTopic.length > 1
  };
};
