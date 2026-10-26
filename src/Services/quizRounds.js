import { getPerformanceLevel, shuffleChoices, toPercentage } from "./assessmentGrading";

// The quiz player works in rounds. Round 1 is the whole quiz; after it the student is shown what they
// got wrong and can take just those questions again, round after round, until every one is right.
// This file is the pure logic for that (no React, no network) so it can be checked on its own.

/**
 * One round: the chosen questions (all of them by default), each remembering which original question it
 * came from. Options are shuffled every time, so a retake can't be won by remembering "it was C", and a
 * model that always puts the right answer first can't be gamed by always tapping A.
 */
export const buildRound = (questions, sourceIndexes = questions.map((_, index) => index)) =>
  sourceIndexes.map((sourceIndex) => {
    const { question, options, correctIndex, explanation } = questions[sourceIndex];
    return { sourceIndex, question, explanation: explanation || "", ...shuffleChoices(options, correctIndex) };
  });

/**
 * Marks a round. `answers[i]` is the option index chosen for `round[i]`. `level` comes from the
 * percentage with the same bands as the child assessments (90 / 75 / 60).
 */
export const scoreRound = (round, answers) => {
  const results = round.map((item, index) => ({ ...item, chosenIndex: answers[index], isCorrect: answers[index] === item.correctIndex }));
  const right = results.filter((item) => item.isCorrect);
  const percentage = toPercentage(right.length, round.length);
  return {
    total: round.length,
    correct: right.length,
    percentage,
    level: getPerformanceLevel(percentage),
    wrong: results.filter((item) => !item.isCorrect),
    right
  };
};

/** The original question numbers (0-based) to ask in the next round. */
export const wrongSourceIndexes = (scored) => scored.wrong.map((item) => item.sourceIndex);

const plural = (count) => `${count} question${count === 1 ? "" : "s"}`;

/** What the student is told when a round ends, written to the student, not the teacher. */
export const studentMessage = ({ scored, round }) => {
  const { percentage, level, wrong } = scored;
  if (wrong.length === 0) {
    return round === 1
      ? "Perfect score! You answered every question correctly."
      : "Well done! You have now answered every question correctly.";
  }
  const missed = plural(wrong.length);
  if (level.label === "Excellent") return `Excellent work! You scored ${percentage}%. Look at the ${missed} you missed, then try again.`;
  if (level.label === "Good") return `Good job! You scored ${percentage}%. You are close - practise the ${missed} you missed.`;
  if (level.label === "Average") return `You scored ${percentage}% - an average result. You need to work on the ${missed} below, then try them again.`;
  return `You scored ${percentage}%. You need to work on this part. Read the right answers below, then try the ${missed} you missed again.`;
};
