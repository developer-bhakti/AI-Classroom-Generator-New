import React, { useState } from "react";
import { AlertTriangle, Check, Info, Save, Sparkles, Trash2 } from "lucide-react";
import {
  MAX_TOPICS_PER_MONTH,
  draftSyllabus,
  parseTopicLines,
  saveSyllabusEntry,
  topicsToText
} from "../../Services/syllabusService";
import { describeGeminiError } from "../../Services/geminiService";

/**
 * Edit one month of the syllabus: one topic or learning outcome per line. Teachers keep their own
 * version; an admin can instead edit the shared school syllabus every teacher sees. Remount it
 * (change `key`) when the year, class, subject or month changes.
 */
const MonthSyllabusEditor = ({ userId, isAdmin, academicYear, className, subject, month, entries, initialDraft, onSaved }) => {
  const personal = entries.find((entry) => entry.month === month && !entry.isShared) || null;
  const shared = entries.find((entry) => entry.month === month && entry.isShared) || null;

  const [scope, setScope] = useState(isAdmin && (shared || !personal) ? "school" : "mine");
  const [copying, setCopying] = useState(false);
  const [text, setText] = useState(() => {
    if (initialDraft) return topicsToText(initialDraft);
    const start = isAdmin && (shared || !personal) ? shared : personal;
    // A teacher with no version of their own sees the school's, to use as it is or to copy.
    return topicsToText(start?.topics ?? (!isAdmin && shared ? shared.topics : []));
  });
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const source = scope === "school" ? shared : personal;
  const readOnly = !isAdmin && !personal && Boolean(shared) && !copying;
  const topicCount = parseTopicLines(text).length;

  const changeScope = (next) => {
    setScope(next);
    setText(topicsToText((next === "school" ? shared : personal)?.topics));
    setMessage(null);
  };

  const suggest = async () => {
    setAiBusy(true);
    setMessage(null);
    try {
      const byMonth = await draftSyllabus({ className, subject, academicYear, months: [month] });
      if (!byMonth[month]?.length) throw new Error("No topics came back.");
      setText(topicsToText(byMonth[month]));
      setMessage({ type: "info", text: "AI draft ready. Read it through, change anything you like, then save." });
    } catch (err) {
      setMessage({ type: "error", text: describeGeminiError(err) });
    } finally {
      setAiBusy(false);
    }
  };

  const save = async (topics) => {
    setBusy(true);
    setMessage(null);
    try {
      const entry = await saveSyllabusEntry({ userId, shared: scope === "school", academicYear, className, subject, month, topics });
      setText(topicsToText(entry?.topics));
      setMessage({ type: "success", text: entry ? `Saved ${entry.topics.length} ${entry.topics.length === 1 ? "topic" : "topics"} for ${month}.` : `Removed the ${month} syllabus.` });
      onSaved?.(entry);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="syl-editor">
      <div className="syl-editor-head">
        <h4>{month} syllabus</h4>
        {source ? <span className={`syl-source ${source.isShared ? "school" : "mine"}`}>{source.isShared ? "School syllabus" : "My syllabus"}</span> : <span className="syl-source empty">Not added yet</span>}
      </div>

      {isAdmin ? (
        <div className="syl-scope" role="radiogroup" aria-label="Who is this syllabus for?">
          <label className={scope === "school" ? "on" : ""}>
            <input type="radio" name={`scope-${month}`} checked={scope === "school"} onChange={() => changeScope("school")} />
            <span><strong>School syllabus</strong><small>every teacher sees it</small></span>
          </label>
          <label className={scope === "mine" ? "on" : ""}>
            <input type="radio" name={`scope-${month}`} checked={scope === "mine"} onChange={() => changeScope("mine")} />
            <span><strong>Only me</strong><small>my own version</small></span>
          </label>
        </div>
      ) : null}

      {readOnly ? (
        <p className="syl-note">
          <Info size={15} /> This is the school syllabus. Use it as it is, or{" "}
          <button type="button" className="assess-link" onClick={() => setCopying(true)}>make your own version</button>.
        </p>
      ) : null}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        disabled={readOnly || busy}
        aria-label={`Topics and learning outcomes for ${month}`}
        placeholder={"One topic or learning outcome per line, for example:\nRecognise and name the colours red, blue and yellow\nCount objects from 1 to 5\nSing the rhyme “Twinkle Twinkle Little Star”"}
      />

      <div className="syl-editor-foot">
        <span className="cell-muted">{topicCount} of {MAX_TOPICS_PER_MONTH} topics</span>
        {readOnly ? null : (
          <div className="syl-editor-actions">
            <button type="button" className="secondary-btn" onClick={suggest} disabled={aiBusy || busy}>
              <Sparkles size={15} /> {aiBusy ? "Thinking…" : "Suggest with AI"}
            </button>
            {source ? (
              <button type="button" className="secondary-btn danger-btn" onClick={() => save("")} disabled={busy || aiBusy} aria-label={`Remove the ${month} syllabus`}>
                <Trash2 size={15} /> Remove
              </button>
            ) : null}
            <button type="button" className="primary-btn" onClick={() => save(text)} disabled={busy || aiBusy || topicCount === 0}>
              <Save size={15} /> {busy ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {message ? (
        <p className={message.type === "error" ? "inline-error" : message.type === "success" ? "inline-success" : "syl-note"}>
          {message.type === "error" ? <AlertTriangle size={14} /> : message.type === "success" ? <Check size={14} /> : <Info size={14} />} {message.text}
        </p>
      ) : null}
    </div>
  );
};

export default MonthSyllabusEditor;
