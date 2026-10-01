import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, BarChart3, CalendarCheck, ClipboardList, Download, GraduationCap,
  PartyPopper, RefreshCw, RotateCcw
} from "lucide-react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import AssessmentSetup from "../Components/assessment/AssessmentSetup";
import QuestionPlayer from "../Components/assessment/QuestionPlayer";
import AssessmentResults from "../Components/assessment/AssessmentResults";
import TutorSession from "../Components/assessment/TutorSession";
import { useAuth } from "../context/useAuth";
import { describeGeminiError } from "../Services/geminiService";
import { MASTERY_THRESHOLD, blankAnswerFor } from "../Services/assessmentGrading";
import {
  ASSESSMENT_LENGTH,
  PRACTICE_LENGTH,
  createAssessmentPaper,
  createPracticePaper,
  evaluateAssessment
} from "../Services/assessmentService";
import { downloadAssessmentPdf } from "../Services/assessmentPdf";
import {
  getStudentHistory,
  listStudents,
  saveAssessment,
  saveTeachingSession
} from "../Services/studentService";

const KIND_META = {
  end_term: {
    label: "End-Term Assessment",
    blurb: "A 20-question paper covering the whole term's syllabus for a class and subject.",
    icon: CalendarCheck
  },
  current: {
    label: "Current Academic Assessment",
    blurb: "A 20-question paper on only what the class has completed so far this month.",
    icon: ClipboardList
  }
};

// Stages where leaving the page would throw away work the child has already done.
const IN_PROGRESS_STAGES = new Set(["taking", "teaching", "practice-taking"]);

const Assessment = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialKind = KIND_META[searchParams.get("type")] ? searchParams.get("type") : null;

  const [stage, setStage] = useState(initialKind ? "setup" : "choose");
  const [kind, setKind] = useState(initialKind);
  const [students, setStudents] = useState([]);
  const [studentsError, setStudentsError] = useState(null);

  const [config, setConfig] = useState(null);
  const [paper, setPaper] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [record, setRecord] = useState(null);

  const [needsTeacher, setNeedsTeacher] = useState(null); // null = not asked yet
  const [practice, setPractice] = useState(null); // { weakArea, paper, answers, record }
  const [masteredSkills, setMasteredSkills] = useState([]);

  const [error, setError] = useState(null);
  const [saveWarning, setSaveWarning] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // Bumped whenever the flow is abandoned or restarted, so a slow Gemini reply for the old run
  // can't land on top of the new one.
  const runRef = useRef(0);

  useEffect(() => {
    let active = true;
    listStudents()
      .then((rows) => { if (active) setStudents(rows); })
      .catch((err) => { if (active) setStudentsError(err.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!IN_PROGRESS_STAGES.has(stage)) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);

  const resetAll = useCallback(() => {
    runRef.current += 1;
    setStage("choose");
    setKind(null);
    setConfig(null);
    setPaper(null);
    setAnswers([]);
    setRecord(null);
    setNeedsTeacher(null);
    setPractice(null);
    setMasteredSkills([]);
    setError(null);
    setSaveWarning(null);
    setPdfError(null);
  }, []);

  const chooseKind = (nextKind) => {
    setKind(nextKind);
    setStage("setup");
  };

  // ---- Full assessment ----

  const startAssessment = async (nextConfig) => {
    const run = ++runRef.current;
    setConfig(nextConfig);
    setError(null);
    setStage("generating");
    try {
      const history = await getStudentHistory(nextConfig.student.id, nextConfig.subject);
      const generated = await createAssessmentPaper({ ...nextConfig, history });
      if (run !== runRef.current) return;
      setPaper(generated);
      setAnswers(generated.questions.map(blankAnswerFor));
      setStage("taking");
    } catch (err) {
      if (run !== runRef.current) return;
      setError(describeGeminiError(err));
    }
  };

  const setAnswer = (index, value) => setAnswers((prev) => prev.map((existing, i) => (i === index ? value : existing)));

  const finishPaper = async ({ questions, givenAnswers, base }) => {
    setSaveWarning(null);
    const evaluation = await evaluateAssessment({ questions, answers: givenAnswers, className: config.className, subject: config.subject });
    const finished = {
      id: crypto.randomUUID(),
      ...base,
      className: config.className,
      subject: config.subject,
      questions,
      answers: givenAnswers,
      ...evaluation,
      createdAt: new Date().toISOString(),
      persisted: false
    };

    // The result is already on screen worth keeping, so a failed save is a warning, not a dead end.
    try {
      await saveAssessment({ teacherId: user.id, studentId: config.student.id, assessment: finished });
      finished.persisted = true;
    } catch (err) {
      setSaveWarning(`${err.message}. You can still download the PDF, but this result won't appear in the student's progress.`);
    }
    return finished;
  };

  const submitAssessment = async () => {
    const run = ++runRef.current;
    setError(null);
    setStage("evaluating");
    try {
      const finished = await finishPaper({
        questions: paper.questions,
        givenAnswers: answers,
        base: { kind, topics: config.topics, progressNote: config.progressNote, focusSkill: null }
      });
      if (run !== runRef.current) return;
      setRecord(finished);
      setStage("results");
    } catch (err) {
      if (run !== runRef.current) return;
      setError(describeGeminiError(err));
    }
  };

  // ---- AI teaching and reassessment ----

  const startTeaching = (weakArea) => {
    runRef.current += 1;
    setPractice({ weakArea, paper: null, answers: [], record: null });
    setError(null);
    setStage("teaching");
  };

  const answerNeedsTeacher = (yes) => {
    setNeedsTeacher(yes);
    if (yes && record.weakAreas.length === 1) startTeaching(record.weakAreas[0]);
  };

  const generatePractice = async (weakArea) => {
    const run = ++runRef.current;
    setError(null);
    setStage("practice-generating");
    try {
      const generated = await createPracticePaper({
        className: config.className,
        subject: config.subject,
        skill: weakArea.skill,
        diagnosis: weakArea.diagnosis
      });
      if (run !== runRef.current) return;
      setPractice({ weakArea, paper: generated, answers: generated.questions.map(blankAnswerFor), record: null });
      setStage("practice-taking");
    } catch (err) {
      if (run !== runRef.current) return;
      setError(describeGeminiError(err));
    }
  };

  const finishTeaching = ({ messages, counts }) => {
    const { weakArea } = practice;
    // Stored in the background: the teaching record matters, but not enough to make the child wait for it.
    saveTeachingSession({
      teacherId: user.id,
      studentId: config.student.id,
      assessmentId: record.persisted ? record.id : null,
      subject: config.subject,
      skill: weakArea.skill,
      transcript: messages.map((message) => ({
        role: message.role,
        text: message.text,
        practiceQuestion: message.turn?.practiceQuestion || "",
        answerStatus: message.turn?.answerStatus || ""
      })),
      practiceCorrect: counts.correct,
      practiceTotal: counts.total
    }).catch((err) => console.warn(err.message));

    generatePractice(weakArea);
  };

  const leaveTeaching = () => {
    runRef.current += 1;
    setPractice(null);
    setStage("results");
  };

  const setPracticeAnswer = (index, value) =>
    setPractice((prev) => ({ ...prev, answers: prev.answers.map((existing, i) => (i === index ? value : existing)) }));

  const submitPractice = async () => {
    const run = ++runRef.current;
    const { weakArea, paper: practicePaper, answers: practiceAnswers } = practice;
    setError(null);
    setStage("practice-evaluating");
    try {
      const finished = await finishPaper({
        questions: practicePaper.questions,
        givenAnswers: practiceAnswers,
        base: { kind: "practice", topics: [weakArea.skill], progressNote: "", focusSkill: weakArea.skill }
      });
      if (run !== runRef.current) return;
      setPractice((prev) => ({ ...prev, record: finished }));
      if (finished.percentage >= MASTERY_THRESHOLD) {
        setMasteredSkills((prev) => (prev.includes(weakArea.skill) ? prev : [...prev, weakArea.skill]));
      }
      setStage("practice-results");
    } catch (err) {
      if (run !== runRef.current) return;
      setError(describeGeminiError(err));
    }
  };

  // ---- PDF ----

  const download = async (target) => {
    setDownloading(true);
    setPdfError(null);
    try {
      await downloadAssessmentPdf({ assessment: target, student: config.student });
    } catch (err) {
      console.error(err);
      setPdfError("Couldn't build the PDF. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  // ---- Rendering ----

  const loadingCard = (message, hint) => (
    <div className="loading-state">
      <div className="spinner" />
      <p>{message}</p>
      {hint ? <p className="cell-muted">{hint}</p> : null}
    </div>
  );

  const errorCard = (retry, back) => (
    <div className="error-state">
      <p><AlertTriangle size={16} /> {error}</p>
      <div className="assess-error-actions">
        <button type="button" className="secondary-btn" onClick={retry}><RefreshCw size={15} /> Try again</button>
        {back ? <button type="button" className="secondary-btn" onClick={back.action}>{back.label}</button> : null}
      </div>
    </div>
  );

  const studentLine = config ? `${config.student.name} · ${config.className} ${config.subject}` : "";

  const renderResultsNextStep = () => {
    if (record.weakAreas.length === 0) {
      return (
        <div className="assess-next assess-next-done">
          <h4><PartyPopper size={18} /> No online teaching needed</h4>
          <p>The child has a secure grasp of every skill on this paper.</p>
        </div>
      );
    }

    return (
      <div className="assess-next">
        <h4><GraduationCap size={18} /> Does the child need an online teacher in this area?</h4>
        <p className="cell-muted">Weak areas: {record.weakAreas.map((area) => area.skill).join(", ")}</p>

        {needsTeacher === null ? (
          <div className="assess-yesno">
            <button type="button" className="primary-btn" onClick={() => answerNeedsTeacher(true)}>YES</button>
            <button type="button" className="secondary-btn" onClick={() => answerNeedsTeacher(false)}>NO</button>
          </div>
        ) : null}

        {needsTeacher === true && record.weakAreas.length > 1 ? (
          <>
            <p>Which area should the AI teacher start with? It teaches only the area you pick.</p>
            <div className="assess-pick">
              {record.weakAreas.map((area) => (
                <button type="button" key={area.skill} className="secondary-btn" onClick={() => startTeaching(area)}>
                  {area.skill} <span className="cell-muted">({Math.round(area.percentage)}%)</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {needsTeacher === true && record.weakAreas.length === 1 ? (
          <button type="button" className="primary-btn" onClick={() => startTeaching(record.weakAreas[0])}>
            <GraduationCap size={16} /> Start teaching: {record.weakAreas[0].skill}
          </button>
        ) : null}

        {needsTeacher === false ? (
          <p>
            No problem — this result is saved to the student's progress.{" "}
            <button type="button" className="assess-link" onClick={() => setNeedsTeacher(null)}>Changed your mind?</button>
          </p>
        ) : null}
      </div>
    );
  };

  const renderPracticeResults = () => {
    const result = practice.record;
    const mastered = result.percentage >= MASTERY_THRESHOLD;
    const { weakArea } = practice;
    const remaining = record.weakAreas.filter((area) => area.skill !== weakArea.skill && !masteredSkills.includes(area.skill));
    // After a miss, teach again from the mistakes the child just made, not the original paper's.
    const retryArea = result.weakAreas[0] ? { ...weakArea, ...result.weakAreas[0] } : weakArea;

    return (
      <AssessmentResults record={result} onDownload={() => download(result)} downloading={downloading}>
        <div className={`assess-verdict ${mastered ? "mastered" : "more"}`}>
          <h4>{mastered ? "Topic Mastered" : "Needs More Practice"}</h4>
          <p>
            {mastered
              ? `"${weakArea.skill}" is now secure — ${Math.round(result.percentage)}% on the practice set.`
              : `"${weakArea.skill}" is not secure yet — ${Math.round(result.percentage)}% on the practice set (${MASTERY_THRESHOLD}% is needed).`}
          </p>
          <div className="assess-pick">
            {!mastered ? (
              <button type="button" className="primary-btn" onClick={() => startTeaching(retryArea)}>
                <GraduationCap size={16} /> Continue personalized teaching
              </button>
            ) : null}
            {mastered && remaining.map((area) => (
              <button type="button" key={area.skill} className="primary-btn" onClick={() => startTeaching(area)}>
                <GraduationCap size={16} /> Teach next: {area.skill}
              </button>
            ))}
            <button type="button" className="secondary-btn" onClick={() => setStage("results")}>
              <ArrowLeft size={16} /> Back to full results
            </button>
            <Link to="/students" className="secondary-btn"><BarChart3 size={16} /> View progress</Link>
          </div>
        </div>
      </AssessmentResults>
    );
  };

  const renderStage = () => {
    switch (stage) {
      case "choose":
        return (
          <>
            <div className="assess-choose">
              {Object.entries(KIND_META).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <button type="button" key={key} className="resource-card assess-kind" onClick={() => chooseKind(key)}>
                    <div className="resource-icon"><Icon size={22} /></div>
                    <h3>{meta.label}</h3>
                    <p>{meta.blurb}</p>
                  </button>
                );
              })}
            </div>
            <p className="assess-flow-hint cell-muted">
              Pick a type, choose the class, subject and student, and the AI writes the paper, marks it, finds the weak skills,
              and can teach and re-test just those. <Link to="/students">See student progress</Link>
            </p>
          </>
        );

      case "setup":
        return (
          <>
            <button type="button" className="assess-link assess-back" onClick={resetAll}><ArrowLeft size={14} /> Change assessment type</button>
            <h3>{KIND_META[kind].label}</h3>
            {studentsError ? <p className="inline-error"><AlertTriangle size={14} /> {studentsError}. Run the latest supabase/schema.sql so the student tables exist.</p> : null}
            <AssessmentSetup
              kind={kind}
              teacherId={user.id}
              students={students}
              busy={false}
              onStudentAdded={(student) => setStudents((prev) => [...prev, student].sort((a, b) => a.name.localeCompare(b.name)))}
              onStart={startAssessment}
            />
          </>
        );

      case "generating":
        return error
          ? errorCard(() => startAssessment(config), { label: "Back", action: () => setStage("setup") })
          : loadingCard(`Writing a ${ASSESSMENT_LENGTH}-question paper for ${config.className} ${config.subject}…`, "This usually takes 20–40 seconds.");

      case "taking":
        return (
          <>
            <h3>{kind === "end_term" ? "Evaluate the child on the end-term syllabus." : "Evaluate the child according to the current syllabus."}</h3>
            <p className="cell-muted assess-student-line">{studentLine} · {paper.title}</p>
            <QuestionPlayer questions={paper.questions} answers={answers} onAnswer={setAnswer} onSubmit={submitAssessment} />
          </>
        );

      case "evaluating":
        return error
          ? errorCard(submitAssessment, { label: "Back to the paper", action: () => { setError(null); setStage("taking"); } })
          : loadingCard("Marking the paper and finding where the child needs help…");

      case "results":
        return (
          <>
            <h3>{paper?.title || "Results"}</h3>
            <p className="cell-muted assess-student-line">{studentLine}</p>
            {saveWarning ? <p className="inline-error"><AlertTriangle size={14} /> {saveWarning}</p> : null}
            {record.analysisFailed ? <p className="cell-muted">The AI diagnosis was unavailable, so the notes below are basic. The score and weak skills are unaffected.</p> : null}
            <AssessmentResults record={record} onDownload={() => download(record)} downloading={downloading}>
              {renderResultsNextStep()}
            </AssessmentResults>
            <div className="assess-footer-actions">
              <button type="button" className="secondary-btn" onClick={resetAll}><RotateCcw size={16} /> New assessment</button>
              <Link to="/students" className="secondary-btn"><BarChart3 size={16} /> Student progress</Link>
            </div>
          </>
        );

      case "teaching":
        return (
          <TutorSession
            className={config.className}
            subject={config.subject}
            weakArea={practice.weakArea}
            onFinish={finishTeaching}
            onLeave={leaveTeaching}
          />
        );

      case "practice-generating":
        return error
          ? errorCard(() => generatePractice(practice.weakArea), { label: "Back to results", action: () => setStage("results") })
          : loadingCard(`Preparing ${PRACTICE_LENGTH} new practice questions on “${practice.weakArea.skill}”…`);

      case "practice-taking":
        return (
          <>
            <h3>Practice test: {practice.weakArea.skill}</h3>
            <p className="cell-muted assess-student-line">{studentLine} · {PRACTICE_LENGTH} new questions</p>
            <QuestionPlayer
              questions={practice.paper.questions}
              answers={practice.answers}
              onAnswer={setPracticeAnswer}
              onSubmit={submitPractice}
              submitLabel="Submit practice test"
            />
          </>
        );

      case "practice-evaluating":
        return error
          ? errorCard(submitPractice, { label: "Back to the test", action: () => { setError(null); setStage("practice-taking"); } })
          : loadingCard("Checking the practice test…");

      case "practice-results":
        return (
          <>
            <h3>Practice result: {practice.weakArea.skill}</h3>
            <p className="cell-muted assess-student-line">{studentLine}</p>
            {saveWarning ? <p className="inline-error"><AlertTriangle size={14} /> {saveWarning}</p> : null}
            {renderPracticeResults()}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Skill Assessment" />
        <div className="content-area">
          <section className="assess-hero">
            <p className="eyebrow">Student assessment</p>
            <h1>Assess &amp; Manage Current Academic Skills of the Child</h1>
          </section>
          <div className="panel-card assess-card">
            {pdfError ? <p className="inline-error"><AlertTriangle size={14} /> {pdfError}</p> : null}
            {downloading ? <p className="cell-muted"><Download size={14} /> Preparing the PDF…</p> : null}
            {renderStage()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Assessment;
