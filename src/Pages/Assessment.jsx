import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, BarChart3, Download, GraduationCap, PartyPopper, RefreshCw, RotateCcw
} from "lucide-react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import AssessmentSetup from "../Components/assessment/AssessmentSetup";
import SkillEvaluation from "../Components/assessment/SkillEvaluation";
import QuestionPlayer from "../Components/assessment/QuestionPlayer";
import AssessmentResults from "../Components/assessment/AssessmentResults";
import ReportView from "../Components/assessment/ReportView";
import TutorSession from "../Components/assessment/TutorSession";
import TeacherSupport from "../Components/assessment/TeacherSupport";
import ImprovementPlan from "../Components/assessment/ImprovementPlan";
import { useAuth } from "../context/useAuth";
import { describeGeminiError } from "../Services/geminiService";
import { MASTERY_THRESHOLD, blankAnswerFor } from "../Services/assessmentGrading";
import { flattenSyllabus } from "../Services/assessmentPrompts";
import { classOptions, parsePeriod, subjectMap } from "../Services/curriculum";
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

// Stages where leaving the page would throw away work already done.
const IN_PROGRESS_STAGES = new Set(["evaluate", "taking", "teaching", "practice-taking"]);

// The dashboard hands over its selections in the URL; anything that does not check out is ignored.
const readInitialSelection = (params) => {
  const className = classOptions.includes(params.get("class")) ? params.get("class") : undefined;
  const subject = className && subjectMap[className].includes(params.get("subject")) ? params.get("subject") : undefined;
  const year = /^\d{4}-\d{2}$/.test(params.get("year") || "") ? params.get("year") : undefined;
  const periodKey = parsePeriod(params.get("month")) ? params.get("month") : undefined;
  return { className, subject, academicYear: year, periodKey, studentId: params.get("student") || "" };
};

const Assessment = () => {
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const initial = useMemo(() => readInitialSelection(searchParams), [searchParams]);

  const [stage, setStage] = useState("setup");
  const [students, setStudents] = useState([]);
  const [studentsError, setStudentsError] = useState(null);

  const [config, setConfig] = useState(null);
  const [ratings, setRatings] = useState({});
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

  // Coming back from the evaluation step must not wipe what the teacher just chose.
  const setupInitial = useMemo(() => (config
    ? { studentId: config.student.id, className: config.className, subject: config.subject, academicYear: config.academicYear, periodKey: config.period.key }
    : initial), [config, initial]);

  const items = useMemo(() => (config ? flattenSyllabus(config.syllabus) : []), [config]);
  const ratingList = useCallback(() => items.map((item) => ({ topic: item.text, rating: ratings[item.number] })), [items, ratings]);

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
    setStage("setup");
    setConfig(null);
    setRatings({});
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

  // ---- Choosing the student and the syllabus, then rating each topic ----

  const startEvaluation = (nextConfig) => {
    setConfig(nextConfig);
    setRatings({});
    setStage("evaluate");
  };

  const rate = (number, rating) => setRatings((prev) => ({ ...prev, [number]: rating }));

  // ---- The 20-question paper ----

  const generatePaper = async () => {
    const run = ++runRef.current;
    setError(null);
    setStage("generating");
    try {
      const history = await getStudentHistory(config.student.id, config.subject);
      const generated = await createAssessmentPaper({
        kind: config.period.kind,
        className: config.className,
        subject: config.subject,
        academicYear: config.academicYear,
        period: config.period,
        syllabus: config.syllabus,
        ratings: ratingList(),
        history
      });
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

  const finishPaper = async ({ questions, givenAnswers, skillRatings, base }) => {
    setSaveWarning(null);
    const evaluation = await evaluateAssessment({
      questions,
      answers: givenAnswers,
      className: config.className,
      subject: config.subject,
      ratings: skillRatings
    });
    const finished = {
      id: crypto.randomUUID(),
      ...base,
      className: config.className,
      subject: config.subject,
      academicYear: config.academicYear,
      questions,
      answers: givenAnswers,
      skillRatings,
      ...evaluation,
      // The teacher's remarks start as the AI's draft and are theirs to edit on the report.
      teacherRemarks: evaluation.remarksDraft,
      createdAt: new Date().toISOString(),
      persisted: false
    };

    // The result is already on screen worth keeping, so a failed save is a warning, not a dead end.
    try {
      await saveAssessment({ teacherId: user.id, studentId: config.student.id, assessment: finished });
      finished.persisted = true;
    } catch (err) {
      setSaveWarning(`${err.message}. You can still print the report or download the PDF, but this result won't appear in the student's progress.`);
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
        skillRatings: ratingList(),
        base: {
          kind: config.period.kind,
          topics: items.map((item) => item.text),
          month: config.period.label,
          progressNote: "",
          focusSkill: null
        }
      });
      if (run !== runRef.current) return;
      setRecord(finished);
      setStage("results");
    } catch (err) {
      if (run !== runRef.current) return;
      setError(describeGeminiError(err));
    }
  };

  // ---- Optional extras: AI teaching and reassessment ----

  const startTeaching = (weakArea) => {
    runRef.current += 1;
    setPractice({ weakArea, paper: null, answers: [], record: null });
    setError(null);
    setStage("teaching");
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
        skillRatings: [],
        base: { kind: "practice", topics: [weakArea.skill], month: config.period.label, progressNote: "", focusSkill: weakArea.skill }
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

  // ---- PDF of the paper and its answers ----

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

  const studentLine = config
    ? `${config.student.name} · ${config.className} ${config.subject} · ${config.period.label}${config.academicYear ? ` · ${config.academicYear}` : ""}`
    : "";

  const renderResultsNextStep = () => {
    if (record.weakAreas.length === 0) {
      return (
        <div className="assess-next assess-next-done">
          <h4><PartyPopper size={18} /> No online teacher needed</h4>
          <p>The child has a secure grasp of every topic on this paper.</p>
        </div>
      );
    }

    return (
      <div className="assess-next">
        <h4><GraduationCap size={18} /> Do you need an online teacher in your area of improvement?</h4>
        <p className="cell-muted">Areas of improvement: {record.weakAreas.map((area) => area.skill).join(", ")}</p>

        <div className="assess-yesno" role="group" aria-label="Online teacher">
          <button type="button" className={needsTeacher === true ? "primary-btn" : "secondary-btn"} aria-pressed={needsTeacher === true} onClick={() => setNeedsTeacher(true)}>Yes</button>
          <button type="button" className={needsTeacher === false ? "primary-btn" : "secondary-btn"} aria-pressed={needsTeacher === false} onClick={() => setNeedsTeacher(false)}>No</button>
        </div>

        {needsTeacher === true ? (
          <TeacherSupport
            teacherId={user.id}
            defaultContact={user.email || ""}
            student={config.student}
            record={record}
            className={config.className}
            subject={config.subject}
            onStartPractice={startTeaching}
          />
        ) : null}

        {needsTeacher === false ? <ImprovementPlan plan={record.improvementPlan || []} /> : null}
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
      case "setup":
        return (
          <>
            <div>
              <h3>Select student details</h3>
              <p className="cell-muted">Pick the child, class, year, subject and month. The syllabus for that month loads automatically, so the child is checked only on what has been taught.</p>
            </div>
            {studentsError ? <p className="inline-error"><AlertTriangle size={14} /> {studentsError}. Run the latest supabase/schema.sql so the student tables exist.</p> : null}
            <AssessmentSetup
              userId={user.id}
              isAdmin={isAdmin}
              students={students}
              initial={setupInitial}
              onStudentAdded={(student) => setStudents((prev) => [...prev, student].sort((a, b) => a.name.localeCompare(b.name)))}
              onContinue={startEvaluation}
            />
          </>
        );

      case "evaluate":
        return (
          <>
            <div>
              <h3>Evaluate the child according to the current syllabus.</h3>
              <p className="cell-muted assess-student-line">{studentLine}</p>
              <p className="cell-muted">For each topic, choose how the child is doing from what you have seen in class. This shapes the paper and the areas of improvement.</p>
            </div>
            <SkillEvaluation
              items={items}
              ratings={ratings}
              onRate={rate}
              onBack={() => setStage("setup")}
              onContinue={generatePaper}
              continueLabel={`Create the ${ASSESSMENT_LENGTH}-question assessment`}
            />
          </>
        );

      case "generating":
        return error
          ? errorCard(generatePaper, { label: "Back", action: () => setStage("evaluate") })
          : loadingCard(`Writing a ${ASSESSMENT_LENGTH}-question paper on ${config.period.label} ${config.subject}…`, "This usually takes 20–40 seconds.");

      case "taking":
        return (
          <>
            <div>
              <h3>Assessment paper</h3>
              <p className="cell-muted assess-student-line">{studentLine} · {paper.title}</p>
            </div>
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
            <div>
              <h3>{paper?.title || "Results"}</h3>
              <p className="cell-muted assess-student-line">{studentLine}</p>
            </div>
            {saveWarning ? <p className="inline-error"><AlertTriangle size={14} /> {saveWarning}</p> : null}
            {record.analysisFailed ? <p className="cell-muted">The AI diagnosis was unavailable, so the notes below are basic. The score and the topics to practise are unaffected.</p> : null}
            <AssessmentResults
              record={record}
              onOpenReport={() => setStage("report")}
              onDownload={() => download(record)}
              downloading={downloading}
            >
              {renderResultsNextStep()}
            </AssessmentResults>
            <div className="assess-footer-actions">
              <button type="button" className="secondary-btn" onClick={resetAll}><RotateCcw size={16} /> New assessment</button>
              <Link to="/students" className="secondary-btn"><BarChart3 size={16} /> Student details</Link>
            </div>
          </>
        );

      case "report":
        return (
          <>
            {saveWarning ? <p className="inline-error"><AlertTriangle size={14} /> {saveWarning}</p> : null}
            <ReportView
              assessment={record}
              student={config.student}
              onBack={() => setStage("results")}
              onRemarksSaved={(text) => setRecord((prev) => ({ ...prev, teacherRemarks: text }))}
            />
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
            <div>
              <h3>Practice test: {practice.weakArea.skill}</h3>
              <p className="cell-muted assess-student-line">{studentLine} · {PRACTICE_LENGTH} new questions</p>
            </div>
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
            <div>
              <h3>Practice result: {practice.weakArea.skill}</h3>
              <p className="cell-muted assess-student-line">{studentLine}</p>
            </div>
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
        <Navbar title="Child Assessment" />
        <div className="content-area">
          <section className="assess-hero">
            <p className="eyebrow">Child assessment</p>
            <h1>Is my child&apos;s knowledge as expected?</h1>
          </section>
          <div className={`panel-card assess-card ${stage === "report" ? "assess-card-wide" : ""}`}>
            {pdfError ? <p className="inline-error"><AlertTriangle size={14} /> {pdfError}</p> : null}
            {downloading ? <p className="cell-muted"><Download size={14} /> Preparing the PDF…</p> : null}
            <div key={stage} className="assess-stage">{renderStage()}</div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Assessment;
