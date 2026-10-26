import React from "react";
import { LEVEL_BANDS, describeBand } from "../../Services/assessmentGrading";
import { LevelPill, ScoreRing } from "./Badges";

const formatDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

/**
 * The parent-friendly "Child Progress Report". It is a light "paper" in every theme, so what is on
 * screen is what prints. `editable` swaps the teacher's remarks for a text box (on screen only);
 * the printed copy always shows the remarks as plain text.
 */
const ProgressReport = ({ report, remarks, onRemarksChange, editable = false }) => (
  <article className="report">
    <header className="report-head">
      <div className="report-brand">
        <span className="report-logo" aria-hidden="true">A</span>
        <div>
          <strong>Adiuvaret</strong>
          <span>AI Classroom Generator</span>
        </div>
      </div>
      <div className="report-title">
        <h2>Child Progress Report</h2>
        <p>{[report.subject, report.month, report.academicYear].filter(Boolean).join(" · ")}</p>
      </div>
    </header>

    <dl className="report-facts">
      <div><dt>Student</dt><dd>{report.studentName}</dd></div>
      <div><dt>Class</dt><dd>{report.className}</dd></div>
      <div><dt>Subject</dt><dd>{report.subject}</dd></div>
      <div><dt>Month</dt><dd>{report.month || "—"}</dd></div>
      <div><dt>Academic year</dt><dd>{report.academicYear || "—"}</dd></div>
      <div><dt>Date</dt><dd>{formatDate(report.date)}</dd></div>
    </dl>

    <section className="report-score">
      <ScoreRing percentage={report.percentage} />
      <div className="report-score-copy">
        <h3>Assessment score</h3>
        <p className="report-score-line">
          <strong>{report.correct}</strong> of <strong>{report.total}</strong> questions right · <strong>{Math.round(report.percentage)}%</strong>
        </p>
        <LevelPill percentage={report.percentage} />
        {report.summary ? <p className="report-summary">{report.summary}</p> : null}
        <p className="report-legend">{LEVEL_BANDS.map(describeBand).join("  ·  ")}</p>
      </div>
    </section>

    <section className="report-block">
      <h3><span aria-hidden="true">⭐</span> Strengths</h3>
      {report.strengths.length > 0 ? (
        <ul className="report-chips">
          {report.strengths.map((strength) => <li key={strength.topic} className="report-chip good">{strength.topic}</li>)}
        </ul>
      ) : (
        <p className="report-empty">Every child grows at their own pace — keep encouraging them and celebrating the small wins.</p>
      )}
    </section>

    <section className="report-block">
      <h3><span aria-hidden="true">🎯</span> Areas of improvement</h3>
      {report.areasOfImprovement.length > 0 ? (
        <div className="report-areas">
          {report.areasOfImprovement.map((group) => (
            <div className="report-area" key={group.area}>
              <p className="report-area-name"><span aria-hidden="true">{group.emoji}</span> {group.area}</p>
              {group.percentage != null ? <p className="report-area-score">{Math.round(group.percentage)}% in this area</p> : null}
              <ul>{group.topics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="report-empty">🎉 Nothing needs extra attention this time. Wonderful work!</p>
      )}
    </section>

    <section className="report-block">
      <h3><span aria-hidden="true">📝</span> Topics to practise</h3>
      {report.topicsToPractise.length > 0 ? (
        <ul className="report-practice">
          {report.topicsToPractise.map((item) => (
            <li key={item.topic}>
              <p className="report-practice-topic">{item.topic}</p>
              {item.diagnosis ? <p className="report-practice-note">{item.diagnosis}</p> : null}
              {item.tips.length > 0 ? (
                <div className="report-tips">
                  <p>Try at home</p>
                  <ul>{item.tips.map((tip, index) => <li key={index}>{tip}</li>)}</ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="report-empty">No extra practice is needed right now.</p>
      )}
    </section>

    <section className="report-block report-remarks">
      <h3><span aria-hidden="true">💬</span> Teacher&apos;s remarks</h3>
      {editable ? (
        <textarea
          value={remarks}
          onChange={(e) => onRemarksChange(e.target.value)}
          rows={4}
          maxLength={800}
          placeholder="Write a few kind words for the parents…"
          aria-label="Teacher's remarks"
        />
      ) : remarks ? (
        <p className="report-remarks-text">{remarks}</p>
      ) : (
        <div className="report-remarks-blank" aria-hidden="true"><span /><span /><span /></div>
      )}
    </section>

    <footer className="report-foot">
      <div><span /> Teacher&apos;s signature</div>
      <div><span /> Parent&apos;s signature</div>
    </footer>
    <p className="report-credit">Prepared with the Adiuvaret AI Classroom Generator</p>
  </article>
);

export default ProgressReport;
