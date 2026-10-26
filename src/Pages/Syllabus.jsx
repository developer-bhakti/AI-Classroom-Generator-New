import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, Info, Pencil, Plus, Sparkles, X } from "lucide-react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import MonthSyllabusEditor from "../Components/assessment/MonthSyllabusEditor";
import { useAuth } from "../context/useAuth";
import {
  ACADEMIC_MONTHS,
  TERMS,
  academicYearOptions,
  classOptions,
  currentAcademicYear,
  currentMonthName,
  subjectMap,
  termForMonth
} from "../Services/curriculum";
import { describeGeminiError } from "../Services/geminiService";
import { draftSyllabus, listSyllabus, pickMonthEntry, saveSyllabusEntry } from "../Services/syllabusService";

const PREVIEW_TOPICS = 3;

const validOr = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

const Syllabus = () => {
  const { user, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const years = useMemo(() => academicYearOptions(), []);

  const initialClass = validOr(params.get("class"), classOptions, "UKG");
  const [className, setClassName] = useState(initialClass);
  const [subject, setSubject] = useState(validOr(params.get("subject"), subjectMap[initialClass], subjectMap[initialClass][0]));
  const [academicYear, setAcademicYear] = useState(/^\d{4}-\d{2}$/.test(params.get("year") || "") ? params.get("year") : currentAcademicYear());
  const [month, setMonth] = useState(validOr(params.get("month"), ACADEMIC_MONTHS, currentMonthName()));
  const view = params.get("view") === "monthly" ? "monthly" : "annual";

  const [entries, setEntries] = useState(null); // null while loading
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState({}); // unsaved AI drafts: { month: topics[] }
  const [draftScope, setDraftScope] = useState(isAdmin ? "school" : "mine");
  const [drafting, setDrafting] = useState(false);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [message, setMessage] = useState(null);

  const subjects = subjectMap[className] || [];

  const setView = (next) => setParams((prev) => {
    const copy = new URLSearchParams(prev);
    copy.set("view", next);
    return copy;
  }, { replace: true });

  const load = useCallback(async (isCurrent = () => true) => {
    try {
      const rows = await listSyllabus({ userId: user.id, academicYear, className, subject });
      if (isCurrent()) {
        setEntries(rows);
        setError(null);
      }
    } catch (err) {
      if (isCurrent()) {
        setError(`${err.message}. Run the latest supabase/schema.sql so the syllabus table exists.`);
        setEntries([]);
      }
    }
  }, [user.id, academicYear, className, subject]);

  useEffect(() => {
    let current = true;
    setEntries(null);
    setDrafts({});
    setMessage(null);
    load(() => current);
    return () => { current = false; };
  }, [load]);

  const changeClass = (value) => {
    setClassName(value);
    setSubject((current) => (subjectMap[value].includes(current) ? current : subjectMap[value][0]));
  };

  const openMonth = (target) => {
    setMonth(target);
    setView("monthly");
  };

  const monthState = (target) => {
    const entry = entries ? pickMonthEntry(entries, target) : null;
    return { entry, draft: drafts[target] || null };
  };

  const readyMonths = entries ? ACADEMIC_MONTHS.filter((target) => pickMonthEntry(entries, target)).length : 0;
  const draftMonths = Object.keys(drafts);

  const draftYear = async () => {
    const empty = ACADEMIC_MONTHS.filter((target) => !pickMonthEntry(entries, target) && !drafts[target]);
    if (empty.length === 0) {
      setMessage({ type: "info", text: "Every month already has a syllabus or a draft." });
      return;
    }
    setDrafting(true);
    setMessage(null);
    try {
      const byMonth = await draftSyllabus({ className, subject, academicYear, months: empty });
      setDrafts((prev) => ({ ...byMonth, ...prev }));
      setMessage({ type: "info", text: `Drafted ${Object.keys(byMonth).length} months. Read them through, then save — nothing is stored until you do.` });
    } catch (err) {
      setMessage({ type: "error", text: describeGeminiError(err) });
    } finally {
      setDrafting(false);
    }
  };

  const saveDrafts = async () => {
    setSavingDrafts(true);
    setMessage(null);
    try {
      for (const target of draftMonths) {
        // One at a time: a failure part-way leaves the rest as drafts instead of losing them.
        await saveSyllabusEntry({ userId: user.id, shared: draftScope === "school", academicYear, className, subject, month: target, topics: drafts[target] });
        setDrafts((prev) => {
          const { [target]: _saved, ...rest } = prev;
          return rest;
        });
      }
      await load();
      setMessage({ type: "success", text: `Saved ${draftMonths.length} months.` });
    } catch (err) {
      await load();
      setMessage({ type: "error", text: err.message });
    } finally {
      setSavingDrafts(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Syllabus" />
        <div className="content-area">
          <section className="assess-hero">
            <p className="eyebrow">Annual → Term → Monthly</p>
            <h1>The syllabus your assessments follow</h1>
            <p className="cell-muted syl-intro">
              Add what is taught each month, for each class and subject. When you check a child, only the chosen month&apos;s
              topics are used, so they are tested on nothing that has not been taught.
              {isAdmin ? " As an admin, the School syllabus you save is shared with every teacher." : ""}
            </p>
          </section>

          <div className="panel-card syl-filters">
            <div className="syl-filter">
              <label htmlFor="syl-year">Academic year</label>
              <select id="syl-year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                {years.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="syl-filter">
              <label htmlFor="syl-class">Class</label>
              <select id="syl-class" value={className} onChange={(e) => changeClass(e.target.value)}>
                {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="syl-filter">
              <label htmlFor="syl-subject">Subject</label>
              <select id="syl-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                {subjects.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="syl-progress" aria-live="polite">
              <strong>{entries ? readyMonths : "…"}/12</strong>
              <span>months ready</span>
            </div>
          </div>

          <div className="feature-tabs syl-tabs" role="tablist" aria-label="Syllabus view">
            <button type="button" role="tab" aria-selected={view === "annual"} className={`tab-btn ${view === "annual" ? "active" : ""}`} onClick={() => setView("annual")}>📚 Annual syllabus</button>
            <button type="button" role="tab" aria-selected={view === "monthly"} className={`tab-btn ${view === "monthly" ? "active" : ""}`} onClick={() => setView("monthly")}>📅 Monthly syllabus</button>
          </div>

          {error ? <p className="inline-error"><AlertTriangle size={14} /> {error}</p> : null}
          {message ? (
            <p className={message.type === "error" ? "inline-error" : message.type === "success" ? "inline-success" : "syl-note"}>
              {message.type === "error" ? <AlertTriangle size={14} /> : message.type === "success" ? <Check size={14} /> : <Info size={14} />} {message.text}
            </p>
          ) : null}

          {entries === null ? (
            <div className="panel-card"><div className="loading-state"><div className="spinner" /><p>Loading the syllabus…</p></div></div>
          ) : view === "annual" ? (
            <>
              <div className="syl-annual-toolbar">
                <button type="button" className="secondary-btn" onClick={draftYear} disabled={drafting || savingDrafts}>
                  <Sparkles size={16} /> {drafting ? "Drafting the year…" : "Draft empty months with AI"}
                </button>
                {draftMonths.length > 0 ? (
                  <div className="syl-draft-actions">
                    {isAdmin ? (
                      <select value={draftScope} onChange={(e) => setDraftScope(e.target.value)} aria-label="Save drafts as">
                        <option value="school">Save as School syllabus</option>
                        <option value="mine">Save as only mine</option>
                      </select>
                    ) : null}
                    <button type="button" className="primary-btn" onClick={saveDrafts} disabled={savingDrafts}>
                      <Check size={16} /> {savingDrafts ? "Saving…" : `Save ${draftMonths.length} drafted ${draftMonths.length === 1 ? "month" : "months"}`}
                    </button>
                    <button type="button" className="secondary-btn" onClick={() => setDrafts({})} disabled={savingDrafts}><X size={16} /> Discard</button>
                  </div>
                ) : null}
              </div>

              <div className="syl-terms">
                {TERMS.map((term) => (
                  <section className="panel-card syl-term" key={term.id}>
                    <header className="syl-term-head">
                      <h3>{term.name}</h3>
                      <span className="cell-muted">{term.months[0]} – {term.months[term.months.length - 1]}</span>
                    </header>
                    <ul className="syl-months">
                      {term.months.map((target) => {
                        const { entry, draft } = monthState(target);
                        const topics = draft || entry?.topics || [];
                        return (
                          <li key={target} className={topics.length === 0 ? "empty" : ""}>
                            <div className="syl-month-top">
                              <strong>{target}</strong>
                              {draft ? <span className="syl-source draft">AI draft — not saved</span> : entry ? <span className={`syl-source ${entry.source}`}>{entry.source === "school" ? "School syllabus" : "My syllabus"}</span> : null}
                              <button type="button" className="secondary-btn syl-month-btn" onClick={() => openMonth(target)} aria-label={`${topics.length ? "Edit" : "Add"} ${target}`}>
                                {topics.length ? <><Pencil size={14} /> Edit</> : <><Plus size={14} /> Add</>}
                              </button>
                            </div>
                            {topics.length > 0 ? (
                              <ul className="syl-topic-preview">
                                {topics.slice(0, PREVIEW_TOPICS).map((topic, index) => <li key={index}>{topic}</li>)}
                                {topics.length > PREVIEW_TOPICS ? <li className="cell-muted">+ {topics.length - PREVIEW_TOPICS} more</li> : null}
                              </ul>
                            ) : <p className="cell-muted">No topics yet.</p>}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="panel-card syl-monthly">
              <div className="syl-month-picker" role="tablist" aria-label="Month">
                {TERMS.map((term) => (
                  <div className="syl-month-group" key={term.id}>
                    <span className="syl-month-group-label">{term.name}</span>
                    <div>
                      {term.months.map((target) => {
                        const { entry, draft } = monthState(target);
                        return (
                          <button
                            type="button"
                            role="tab"
                            key={target}
                            aria-selected={month === target}
                            className={`syl-month-pill ${month === target ? "active" : ""} ${entry || draft ? "has-topics" : ""}`}
                            onClick={() => setMonth(target)}
                          >
                            {target.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <p className="cell-muted syl-month-term">{month} belongs to {termForMonth(month)?.name}.</p>

              <MonthSyllabusEditor
                key={`${academicYear}|${className}|${subject}|${month}`}
                userId={user.id}
                isAdmin={isAdmin}
                academicYear={academicYear}
                className={className}
                subject={subject}
                month={month}
                entries={entries}
                initialDraft={drafts[month]}
                onSaved={() => {
                  setDrafts((prev) => {
                    const { [month]: _saved, ...rest } = prev;
                    return rest;
                  });
                  load();
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Syllabus;
