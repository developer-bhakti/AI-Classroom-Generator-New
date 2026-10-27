import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, Award, BookOpenCheck, Check, ClipboardList, Download, Eye, FileText, GraduationCap, Pencil,
  Plus, TrendingDown, TrendingUp, Trash2, UserPlus, Users, X
} from "lucide-react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import ScoreTrendChart from "../Components/assessment/ScoreTrendChart";
import AssessmentResults from "../Components/assessment/AssessmentResults";
import ReportView from "../Components/assessment/ReportView";
import { LevelPill } from "../Components/assessment/Badges";
import { useAuth } from "../context/useAuth";
import { classOptions } from "../Services/curriculum";
import { AREA_EMOJI, MASTERY_THRESHOLD, summarizeAreas } from "../Services/assessmentGrading";
import { groupAreasOfImprovement } from "../Services/assessmentReport";
import {
  addStudent,
  deleteStudent,
  listAssessments,
  listStudentTopics,
  listStudents,
  listTeachingSessions,
  updateStudent
} from "../Services/studentService";
import { downloadAssessmentPdf, kindLabel } from "../Services/assessmentPdf";

const TABS = [
  { id: "details", label: "Student details", emoji: "👧" },
  { id: "results", label: "Results", emoji: "📊" },
  { id: "improvement", label: "Areas of improvement", emoji: "🎯" },
  { id: "report", label: "Progress report", emoji: "📄" }
];

const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const StudentProgress = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((item) => item.id === params.get("view")) ? params.get("view") : "details";

  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(params.get("student") || null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [error, setError] = useState(null);

  const [detail, setDetail] = useState({ assessments: [], topics: [], sessions: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState(null);
  const [openResultId, setOpenResultId] = useState(null);
  const [reportId, setReportId] = useState(null);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState("UKG");
  const [addBusy, setAddBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editClass, setEditClass] = useState("UKG");

  const [downloadingId, setDownloadingId] = useState(null);
  const [pdfError, setPdfError] = useState(null);

  const setTab = (id) => setParams((prev) => {
    const copy = new URLSearchParams(prev);
    copy.set("view", id);
    return copy;
  }, { replace: true });

  useEffect(() => {
    let active = true;
    listStudents(user?.id)
      .then((rows) => {
        if (!active) return;
        setStudents(rows);
        setSelectedId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id || null));
      })
      .catch((err) => { if (active) setError(`${err.message}. Run the latest supabase/schema.sql so the student tables exist.`); })
      .finally(() => { if (active) setLoadingStudents(false); });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;
    setDetailLoading(true);
    setSubjectFilter(null);
    setOpenResultId(null);
    setReportId(null);
    setEditing(false);
    Promise.all([listAssessments(selectedId), listStudentTopics(selectedId), listTeachingSessions(selectedId)])
      .then(([assessments, topics, sessions]) => {
        if (active) setDetail({ assessments, topics, sessions });
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  const student = students.find((item) => item.id === selectedId) || null;

  const view = useMemo(() => {
    const { assessments, topics, sessions } = detail;
    // Oldest first from the query; subjects are listed newest-first so the one just assessed leads.
    const subjects = [...new Set([...assessments].reverse().map((item) => item.subject))];
    const subject = subjectFilter && subjects.includes(subjectFilter) ? subjectFilter : subjects[0] || null;

    const inSubject = assessments.filter((item) => item.subject === subject);
    // Practice sets are 10 questions on one topic, so they'd distort a trend of full papers.
    const papers = inSubject.filter((item) => item.kind !== "practice");
    const latest = papers[papers.length - 1] || null;
    const previous = papers[papers.length - 2] || null;

    const subjectTopics = topics.filter((topic) => topic.subject === subject);
    return {
      subjects,
      subject,
      history: [...inSubject].reverse(),
      papers,
      latest,
      improvement: latest && previous ? Math.round((latest.percentage - previous.percentage) * 10) / 10 : null,
      mastered: subjectTopics.filter((topic) => topic.status === "mastered"),
      needsPractice: subjectTopics.filter((topic) => topic.status === "needs_practice"),
      sessions: sessions.filter((session) => session.subject === subject)
    };
  }, [detail, subjectFilter]);

  // Which development area each topic belongs to, learned from the papers themselves.
  const areaByTopic = useMemo(() => {
    const map = new Map();
    detail.assessments.forEach((assessment) => assessment.skillResults.forEach((entry) => {
      if (entry.area) map.set(entry.skill.trim().toLowerCase(), entry.area);
    }));
    return map;
  }, [detail.assessments]);

  const reportAssessment = view.papers.find((item) => item.id === reportId) || view.latest;

  const submitStudent = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddBusy(true);
    setError(null);
    try {
      const created = await addStudent({ teacherId: user.id, name: newName, className: newClass });
      setStudents((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(created.id);
      setNewName("");
      setAdding(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddBusy(false);
    }
  };

  const startEditing = () => {
    setEditName(student.name);
    setEditClass(classOptions.includes(student.className) ? student.className : "UKG");
    setEditing(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    try {
      const updated = await updateStudent(student.id, { name: editName, className: editClass });
      setStudents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)).sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeStudent = async () => {
    if (!student) return;
    if (!window.confirm(`Remove ${student.name}? Their assessments, topic progress and teaching sessions will be deleted too.`)) return;
    try {
      await deleteStudent(student.id);
      const rest = students.filter((item) => item.id !== student.id);
      setStudents(rest);
      setSelectedId(rest[0]?.id || null);
      setDetail({ assessments: [], topics: [], sessions: [] });
    } catch (err) {
      setError(err.message);
    }
  };

  const download = async (assessment) => {
    setDownloadingId(assessment.id);
    setPdfError(null);
    try {
      await downloadAssessmentPdf({ assessment, student });
    } catch (err) {
      console.error(err);
      setPdfError("Couldn't build the PDF. Try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const openReport = (assessment) => {
    setReportId(assessment.id);
    setTab("report");
  };

  const updateRemarksLocally = (id, remarks) =>
    setDetail((prev) => ({ ...prev, assessments: prev.assessments.map((item) => (item.id === id ? { ...item, teacherRemarks: remarks } : item)) }));

  const improvementTone = view.improvement == null ? "" : view.improvement > 0 ? "up" : view.improvement < 0 ? "down" : "";
  const ImprovementIcon = view.improvement != null && view.improvement < 0 ? TrendingDown : TrendingUp;

  const stats = [
    {
      icon: <Award size={18} />,
      label: "Current score",
      value: view.latest ? `${Math.round(view.latest.percentage)}%` : "—",
      sub: view.latest ? <LevelPill percentage={view.latest.percentage} /> : "No full paper yet"
    },
    {
      icon: <ImprovementIcon size={18} />,
      label: "Improvement",
      value: view.improvement == null ? "—" : `${view.improvement > 0 ? "+" : ""}${view.improvement} pts`,
      sub: view.improvement == null ? "Needs two full papers" : "vs the previous full paper",
      tone: improvementTone
    },
    { icon: <BookOpenCheck size={18} />, label: "Topics mastered", value: view.mastered.length, sub: `Topics at ${MASTERY_THRESHOLD}% or better` },
    { icon: <AlertTriangle size={18} />, label: "Need improvement", value: view.needsPractice.length, sub: `Topics below ${MASTERY_THRESHOLD}%` },
    { icon: <GraduationCap size={18} />, label: "AI teaching sessions", value: view.sessions.length, sub: view.subject || "—" }
  ];

  const renderEmpty = () => (
    <div className="panel-card students-empty">
      <ClipboardList size={28} />
      <h3>No assessments yet</h3>
      <p className="cell-muted">Check {student.name}&apos;s knowledge and their results, areas of improvement and progress report will appear here.</p>
      <Link to="/assessment" className="primary-btn">Start an assessment</Link>
    </div>
  );

  const renderDetails = () => (
    <>
      <div className="assess-dash-stats">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <span className="stat-card-icon">{stat.icon}</span>
            <strong className={stat.tone ? `delta-${stat.tone}` : ""}>{stat.value}</strong>
            <span>{stat.label}</span>
            <span className="cell-muted assess-stat-sub">{stat.sub}</span>
          </div>
        ))}
      </div>

      <div className="panel-card">
        <h3>Score over time{view.subject ? ` — ${view.subject}` : ""}</h3>
        <p className="cell-muted">Full papers only; short practice sets are listed under Results.</p>
        {view.papers.length === 0 ? (
          <p className="cell-muted">No full paper in this subject yet.</p>
        ) : (
          <>
            <ScoreTrendChart
              points={view.papers.map((paper) => ({
                id: paper.id,
                value: paper.percentage,
                level: paper.level,
                label: formatDate(paper.createdAt)
              }))}
            />
            {view.papers.length === 1 ? <p className="cell-muted">Take another assessment to see a trend.</p> : null}
          </>
        )}
      </div>

      <div className="assess-topics-grid">
        <div className="panel-card">
          <h3>Topics mastered</h3>
          {view.mastered.length === 0 ? <p className="cell-muted">None yet.</p> : (
            <div className="assess-chip-row">
              {view.mastered.map((topic) => <span key={topic.id} className="assess-chip good static">{topic.skill} · {Math.round(topic.lastScore)}%</span>)}
            </div>
          )}
        </div>
        <div className="panel-card">
          <h3>Topics requiring improvement</h3>
          {view.needsPractice.length === 0 ? <p className="cell-muted">None — nicely done.</p> : (
            <div className="assess-chip-row">
              {view.needsPractice.map((topic) => <span key={topic.id} className="assess-chip weak static">{topic.skill} · {Math.round(topic.lastScore)}%</span>)}
            </div>
          )}
        </div>
      </div>

      <div className="panel-card">
        <h3>AI teaching sessions</h3>
        {view.sessions.length === 0 ? <p className="cell-muted">No teaching sessions in this subject yet.</p> : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Topic taught</th><th>Practice answers right</th></tr></thead>
              <tbody>
                {view.sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{formatDate(session.createdAt)}</td>
                    <td>{session.skill}</td>
                    <td>{session.practiceCorrect} of {session.practiceTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  const renderResults = () => (
    <div className="panel-card">
      <h3>Assessment history{view.subject ? ` — ${view.subject}` : ""}</h3>
      {pdfError ? <p className="inline-error"><AlertTriangle size={14} /> {pdfError}</p> : null}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Date</th><th>Assessment</th><th>Class</th><th>Score</th><th>Level</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {view.history.map((item) => (
              <tr key={item.id} className={openResultId === item.id ? "row-open" : ""}>
                <td>{formatDate(item.createdAt)}</td>
                <td>{kindLabel(item)}{item.month && item.kind !== "practice" ? <span className="cell-muted"> · {item.month}</span> : null}</td>
                <td className="cell-muted">{item.className}</td>
                <td>{item.correct}/{item.total} ({Math.round(item.percentage)}%)</td>
                <td><LevelPill percentage={item.percentage} /></td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="secondary-btn" onClick={() => setOpenResultId(openResultId === item.id ? null : item.id)} aria-expanded={openResultId === item.id}>
                      <Eye size={15} /> {openResultId === item.id ? "Hide" : "View"}
                    </button>
                    {item.kind !== "practice" ? (
                      <button type="button" className="secondary-btn" onClick={() => openReport(item)}><FileText size={15} /> Report</button>
                    ) : null}
                    <button type="button" className="secondary-btn" onClick={() => download(item)} disabled={downloadingId === item.id}>
                      <Download size={15} /> {downloadingId === item.id ? "Preparing…" : "PDF"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openResultId ? (
        <div className="results-open">
          <AssessmentResults record={view.history.find((item) => item.id === openResultId) || view.history[0]} onOpenReport={() => openReport(view.history.find((item) => item.id === openResultId))} />
        </div>
      ) : null}
    </div>
  );

  const renderImprovement = () => {
    const latest = view.latest;
    const groups = latest ? groupAreasOfImprovement(latest.weakAreas, latest.areaResults || summarizeAreas(latest.questions, latest.results)) : [];
    const plans = new Map((latest?.improvementPlan || []).map((item) => [item.skill.trim().toLowerCase(), item]));
    const stillOpen = view.needsPractice.filter((topic) => !groups.some((group) => group.topics.some((weak) => weak.skill.trim().toLowerCase() === topic.skill.trim().toLowerCase())));

    return (
      <>
        <div className="panel-card">
          <h3>🎯 Areas of improvement{view.subject ? ` — ${view.subject}` : ""}</h3>
          {latest ? <p className="cell-muted">From the latest paper: {latest.month || kindLabel(latest)} · {formatDate(latest.createdAt)}</p> : null}
          {groups.length > 0 ? (
            <p className="cell-muted">
              A topic is listed when the child scored under {MASTERY_THRESHOLD}% on it, or the teacher rated it Needs Improvement. The tag is the rating the teacher chose before the paper; the score comes from the child&apos;s answers, so a topic rated Excellent can still appear if the child struggled with it.
            </p>
          ) : null}
          {!latest ? (
            <p className="cell-muted">No full paper in this subject yet.</p>
          ) : groups.length === 0 ? (
            <p className="assess-good-news"><Check size={16} /> No areas of improvement on the latest paper — wonderful work!</p>
          ) : (
            <div className="assess-area-groups">
              {groups.map((group) => (
                <div className="assess-area-group" key={group.area}>
                  <div className="assess-area-group-head">
                    <span aria-hidden="true">{group.emoji}</span>
                    <strong>{group.area}</strong>
                    {group.percentage != null ? <span className="cell-muted">{Math.round(group.percentage)}% in this area</span> : null}
                  </div>
                  <ul className="assess-weak-list">
                    {group.topics.map((weak) => {
                      const tips = plans.get(weak.skill.trim().toLowerCase())?.activities || [];
                      return (
                        <li key={weak.skill}>
                          <div className="assess-weak-head">
                            <strong>{weak.skill}</strong>
                            {weak.rating ? <span className="assess-tag">{`Teacher's rating: ${weak.rating}`}</span> : null}
                            <span className="cell-muted">{weak.total > 0 ? `${weak.correct}/${weak.total} correct` : "from the teacher's observation"}</span>
                          </div>
                          <p>{weak.diagnosis}</p>
                          {tips.length > 0 ? <p className="assess-try"><strong>Try at home:</strong> {tips.join(" · ")}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {stillOpen.length > 0 ? (
          <div className="panel-card">
            <h3>Still to practise from earlier papers</h3>
            <div className="assess-chip-row">
              {stillOpen.map((topic) => (
                <span key={topic.id} className="assess-chip weak static">
                  {AREA_EMOJI[areaByTopic.get(topic.skill.trim().toLowerCase())] || "🎯"} {topic.skill} · {Math.round(topic.lastScore)}%
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </>
    );
  };

  const renderReport = () => (
    <>
      {view.papers.length > 1 ? (
        <div className="panel-card report-picker">
          <label htmlFor="report-assessment">Which assessment?</label>
          <select id="report-assessment" value={reportAssessment?.id || ""} onChange={(e) => setReportId(e.target.value)}>
            {[...view.papers].reverse().map((paper) => (
              <option key={paper.id} value={paper.id}>{formatDate(paper.createdAt)} — {paper.month || kindLabel(paper)} — {Math.round(paper.percentage)}%</option>
            ))}
          </select>
        </div>
      ) : null}
      {reportAssessment ? (
        <ReportView
          key={reportAssessment.id}
          assessment={reportAssessment}
          student={student}
          onRemarksSaved={(text) => updateRemarksLocally(reportAssessment.id, text)}
        />
      ) : (
        <div className="panel-card students-empty">
          <FileText size={28} />
          <h3>No report yet</h3>
          <p className="cell-muted">A progress report is made from a full assessment{view.subject ? ` in ${view.subject}` : ""}.</p>
          <Link to="/assessment" className="primary-btn">Start an assessment</Link>
        </div>
      )}
    </>
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Students & Reports" />
        <div className="content-area students-layout">
          <aside className="panel-card students-list-card">
            <div className="students-list-head">
              <h3><Users size={18} /> Students</h3>
              <button type="button" className="secondary-btn" onClick={() => setAdding((on) => !on)} aria-expanded={adding}>
                <UserPlus size={16} /> Add
              </button>
            </div>

            {adding ? (
              <form className="students-add" onSubmit={submitStudent}>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Student's name" aria-label="Student's name" autoFocus />
                <select value={newClass} onChange={(e) => setNewClass(e.target.value)} aria-label="Class">
                  {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <button type="submit" className="primary-btn full" disabled={addBusy || !newName.trim()}>
                  <Plus size={16} /> {addBusy ? "Adding…" : "Add student"}
                </button>
              </form>
            ) : null}

            {loadingStudents ? (
              <p className="cell-muted">Loading students…</p>
            ) : students.length === 0 ? (
              <p className="cell-muted">No students yet. Add one here, or while setting up an assessment.</p>
            ) : (
              <ul className="students-list">
                {students.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={`students-item ${item.id === selectedId ? "active" : ""}`} onClick={() => setSelectedId(item.id)}>
                      <span>{item.name}</span>
                      <span className="cell-muted">{item.className}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className="students-detail">
            {error ? <p className="inline-error"><AlertTriangle size={14} /> {error}</p> : null}

            {!student ? (
              <div className="panel-card students-empty">
                <ClipboardList size={28} />
                <h3>Pick a student to see their progress</h3>
                <p className="cell-muted">Details, results, areas of improvement and the parent progress report appear here.</p>
                <Link to="/assessment" className="primary-btn">Start an assessment</Link>
              </div>
            ) : (
              <>
                <div className="panel-card students-head">
                  {editing ? (
                    <form className="students-edit" onSubmit={saveEdit}>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Student's name" autoFocus />
                      <select value={editClass} onChange={(e) => setEditClass(e.target.value)} aria-label="Class">
                        {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <button type="submit" className="primary-btn" disabled={!editName.trim()}><Check size={16} /> Save</button>
                      <button type="button" className="secondary-btn" onClick={() => setEditing(false)}><X size={16} /> Cancel</button>
                    </form>
                  ) : (
                    <div>
                      <h3>{student.name}</h3>
                      <p className="cell-muted">{student.className || "No class set"} · added {formatDate(student.createdAt)}</p>
                    </div>
                  )}
                  <div className="students-head-actions">
                    {view.subjects.length > 1 ? (
                      <select value={view.subject || ""} onChange={(e) => setSubjectFilter(e.target.value)} aria-label="Subject">
                        {view.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                      </select>
                    ) : null}
                    <Link to={`/assessment?student=${student.id}`} className="primary-btn"><ClipboardList size={16} /> New assessment</Link>
                    {!editing ? <button type="button" className="secondary-btn" onClick={startEditing} aria-label={`Edit ${student.name}`}><Pencil size={16} /></button> : null}
                    <button type="button" className="secondary-btn danger-btn" onClick={removeStudent} aria-label={`Remove ${student.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="feature-tabs students-tabs" role="tablist" aria-label="Student sections">
                  {TABS.map((item) => (
                    <button type="button" role="tab" key={item.id} aria-selected={tab === item.id} className={`tab-btn ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
                      <span aria-hidden="true">{item.emoji}</span> {item.label}
                    </button>
                  ))}
                </div>

                {detailLoading ? (
                  <div className="loading-state"><div className="spinner" /><p>Loading progress…</p></div>
                ) : detail.assessments.length === 0 && tab !== "details" ? (
                  renderEmpty()
                ) : tab === "details" ? (
                  detail.assessments.length === 0 ? renderEmpty() : renderDetails()
                ) : tab === "results" ? (
                  renderResults()
                ) : tab === "improvement" ? (
                  renderImprovement()
                ) : (
                  renderReport()
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default StudentProgress;
