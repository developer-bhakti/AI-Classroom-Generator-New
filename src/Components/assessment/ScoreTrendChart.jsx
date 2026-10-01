import React, { useState } from "react";

// A single-series line of a child's full-paper scores over time. One series means no legend (the
// card title names it); the history table beside it is the chart's non-hover, screen-reader view.

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { left: 40, right: 56, top: 18, bottom: 34 };
const TICKS = [0, 25, 50, 75, 100];
const MAX_X_LABELS = 6;

const ScoreTrendChart = ({ points }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const xFor = (index) => (points.length === 1 ? PAD.left + plotWidth / 2 : PAD.left + (plotWidth * index) / (points.length - 1));
  const yFor = (value) => PAD.top + plotHeight * (1 - Math.min(Math.max(value, 0), 100) / 100);

  const coords = points.map((point, index) => ({ ...point, x: xFor(index), y: yFor(point.value) }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const area = coords.length > 1 ? `${line} L${coords[coords.length - 1].x},${yFor(0)} L${coords[0].x},${yFor(0)} Z` : null;

  const labelEvery = Math.ceil(points.length / MAX_X_LABELS);
  const last = coords[coords.length - 1];

  // The crosshair snaps to the nearest score, so the reader aims at a date, not at a 2px line.
  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    coords.forEach((c, i) => {
      if (Math.abs(c.x - x) < Math.abs(coords[nearest].x - x)) nearest = i;
    });
    setActiveIndex(nearest);
  };

  const active = activeIndex == null ? null : coords[activeIndex];
  const summary = `Score trend: ${points.map((p) => `${p.label} ${Math.round(p.value)} percent`).join(", ")}.`;

  return (
    <div
      className="trend-chart"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setActiveIndex(null)}
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={summary}>
        {TICKS.map((tick) => (
          <g key={tick}>
            <line className="trend-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={yFor(tick)} y2={yFor(tick)} />
            <text className="trend-axis" x={PAD.left - 8} y={yFor(tick) + 4} textAnchor="end">{tick}%</text>
          </g>
        ))}

        {coords.map((c, i) => (i % labelEvery === 0 || i === coords.length - 1 ? (
          <text className="trend-axis" key={c.id} x={c.x} y={HEIGHT - 10} textAnchor="middle">{c.label}</text>
        ) : null))}

        {area ? <path className="trend-area" d={area} /> : null}
        {coords.length > 1 ? <path className="trend-line" d={line} /> : null}

        {active ? <line className="trend-cross" x1={active.x} x2={active.x} y1={PAD.top} y2={yFor(0)} /> : null}

        {coords.map((c, i) => (
          <g key={c.id}>
            <circle className="trend-dot" cx={c.x} cy={c.y} r={active && activeIndex === i ? 6.5 : 5} />
            {/* Larger invisible target: an 8px dot is a pinpoint nobody hits reliably. */}
            <circle
              className="trend-hit"
              cx={c.x}
              cy={c.y}
              r={14}
              tabIndex={0}
              role="img"
              aria-label={`${c.label}: ${Math.round(c.value)} percent, ${c.level}`}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
            />
          </g>
        ))}

        {last ? <text className="trend-end-label" x={last.x + 12} y={last.y + 4}>{Math.round(last.value)}%</text> : null}
      </svg>

      {active ? (
        <div
          className="trend-tooltip"
          style={{ left: `${(active.x / WIDTH) * 100}%`, top: `${(active.y / HEIGHT) * 100}%` }}
        >
          <strong>{Math.round(active.value)}%</strong>
          <span><i className="trend-key" /> {active.level}</span>
          <span>{active.label}</span>
        </div>
      ) : null}
    </div>
  );
};

export default ScoreTrendChart;
