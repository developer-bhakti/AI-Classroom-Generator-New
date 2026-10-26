import React from "react";
import { canonicalLevel, getPerformanceLevel, toneForLevelLabel } from "../../Services/assessmentGrading";

/**
 * The performance level as a pill. Pass `percentage` and the level is worked out from the current
 * bands (so a score saved under older bands is never mislabelled); `level` is for when only a label exists.
 */
export const LevelPill = ({ percentage, level }) => {
  const label = percentage != null ? getPerformanceLevel(percentage).label : canonicalLevel(level);
  return <span className={`assess-level assess-level-${toneForLevelLabel(label)}`}>{label}</span>;
};

// One value on a 0-100 ring. The colour carries the performance level, and the level's name always
// sits beside it, so the ring is never the only thing telling the reader how the child did.
const RING_SIZE = 132;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export const ScoreRing = ({ percentage }) => {
  const level = getPerformanceLevel(percentage).label;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  return (
    <div className={`score-ring score-ring-${toneForLevelLabel(level)}`} role="img" aria-label={`${Math.round(percentage)} percent, ${level}`}>
      <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden="true">
        <circle className="score-ring-track" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} />
        <circle
          className="score-ring-arc"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - clamped / 100)}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </svg>
      <span>{Math.round(percentage)}%</span>
    </div>
  );
};
