import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Award, BookOpenCheck, ClipboardList, Download, GraduationCap, Plus,
  TrendingDown, TrendingUp, Trash2, UserPlus, Users
} from "lucide-react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import ScoreTrendChart from "../Components/assessment/ScoreTrendChart";
import { LevelPill } from "../Components/assessment/AssessmentResults";
import { useAuth } from "../context/useAuth";
import { classOptions } from "../Services/curriculum";
import {
  addStudent,
  deleteStudent,
  listAssessments,
  listStudentTopics,
  listStudents,
  listTeachingSessions
} from "../Services/studentService";
import { downloadAssessmentPdf, kindLabel } from "../Services/assessmentPdf";

const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const StudentProgress = () => {
  const { user } = useAuth();

  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [error, setError] = useState(null);

  const [detail, setDetail] = useState({ assessments: [], topics: [], sessions: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState(null);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState("Class 3");
  const [addBusy, setAddBusy] = useState(false);

  const [downloadingId, setDownloadingId] = useState(null);
  const [pdfError, setPdfError] = useState(null);

  useEffect(() => {
    let active = true;
    listStudents()
      .then((rows) => {
        if (!active) return;
        setStudents(rows);
        setSelectedId((current) => current || rows[0]?.id || null);
      })
      .catch((err) => { if (active) setError(`${err.message}. Run the latest supabase/schema.sql so the student tables exist.`); })
      .finally(() => { if (active) setLoadingStudents(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    let active = true;
    setDetailLoading(true);
    setSubjectFilter(null);
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
    // Practice sets are 10 questions on one skill, so they'd distort a trend of full papers.
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

  const improvementTone = view.improvement == null ? "" : view.improvement > 0 ? "up" : view.improvement < 0 ? "down" : "";
  const ImprovementIcon = view.improvement != null && view.improvement < 0 ? TrendingDown : TrendingUp;

  const stats = [
    {
      icon: <Award size={18} />,
      label: "Current score",
      value: view.latest ? `${Math.round(view.latest.percentage)}%` : "—",
      sub: view.latest ? <LevelPill level={view.latest.level} /> : "No full paper yet"
    },
    {
      icon: <ImprovementIcon size={18} />,
      label: "Improvement",
      value: view.improvement == null ? "—" : `${view.improvement > 0 ? "+" : ""}${view.improvement} pts`,
      sub: view.improvement == null ? "Needs two full papers" : "vs the previous full paper",
      tone: improvementTone
    },
    { icon: <BookOpenCheck size={18} />, label: "Topics mastered", value: view.mastered.length, sub: "Skills at 75% or better" },
    { icon: <AlertTriangle size={18} />, label: "Need improvement", value: view.needsPractice.length, sub: "Skills below 75%" },
    { icon: <GraduationCap size={18} />, label: "AI teaching sessions", value: view.sessions.length, sub: view.subject || "—" }
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Student Progress" />
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
                <p className="cell-muted">Scores, improvement, mastered topics and the PDF of every assessment appear here.</p>
                <Link to="/assessment" className="primary-btn">Start an assessment</Link>
              </div>
            ) : (
              <>
                <div className="panel-card students-head">
                  <div>
                    <h3>{student.name}</h3>
                    <p className="cell-muted">{student.className || "No class set"}</p>
                  </div>
                  <div className="students-head-actions">
                    {view.subjects.length > 1 ? (
                      <select value={view.subject || ""} onChange={(e) => setSubjectFilter(e.target.value)} aria-label="Subject">
                        {view.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                      </select>
                    ) : null}
                    <Link to="/assessment" className="primary-btn"><ClipboardList size={16} /> New assessment</Link>
                    <button type="button" className="secondary-btn danger-btn" onClick={removeStudent} aria-label={`Remove ${student.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {detailLoading ? (
                  <div className="loading-state"><div className="spinner" /><p>Loading progress…</p></div>
                ) : detail.assessments.length === 0 ? (
                  <div className="panel-card students-empty">
                    <ClipboardList size={28} />
                    <h3>No assessments yet</h3>
                    <p className="cell-muted">Run an assessment for {student.name} and their progress will build up here.</p>
                    <Link to="/assessment" className="primary-btn">Start an assessment</Link>
                  </div>
                ) : (
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
                      <p className="cell-muted">Full papers only; short practice sets are listed in the history below.</p>
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
                      <h3>Assessment history</h3>
                      {pdfError ? <p className="inline-error"><AlertTriangle size={14} /> {pdfError}</p> : null}
                      <div className="data-table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr><th>Date</th><th>Assessment</th><th>Class</th><th>Score</th><th>Level</th><th><span className="sr-only">Download</span></th></tr>
                          </thead>
                          <tbody>
                            {view.history.map((item) => (
                              <tr key={item.id}>
                                <td>{formatDate(item.createdAt)}</td>
                                <td>{kindLabel(item)}</td>
                                <td className="cell-muted">{item.className}</td>
                                <td>{item.correct}/{item.total} ({Math.round(item.percentage)}%)</td>
                                <td><LevelPill level={item.level} /></td>
                                <td>
                                  <button type="button" className="secondary-btn" onClick={() => download(item)} disabled={downloadingId === item.id}>
                                    <Download size={15} /> {downloadingId === item.id ? "Preparing…" : "PDF"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="panel-card">
                      <h3>AI teaching sessions</h3>
                      {view.sessions.length === 0 ? <p className="cell-muted">No teaching sessions in this subject yet.</p> : (
                        <div className="data-table-wrap">
                          <table className="data-table">
                            <thead><tr><th>Date</th><th>Skill taught</th><th>Practice answers right</th></tr></thead>
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
