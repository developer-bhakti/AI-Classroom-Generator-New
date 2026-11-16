import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { Bookmark, BookmarkCheck, AlertTriangle, PlayCircle, CheckCircle2, XCircle, RotateCcw, ListChecks, Target } from "lucide-react";
import { generateResource } from "../Services/aiService";
import { describeGeminiError } from "../Services/geminiService";
import { recordHistory, saveContent, removeSavedContent } from "../Services/contentStore";
import { getResourcePalette } from "../Services/resourcePalette";
import { classOptions, subjectMap } from "../Services/curriculum";
import ResourcePrint from "../Components/print/ResourcePrint";
import { LEVEL_BANDS, describeBand, toneForLevelLabel } from "../Services/assessmentGrading";
import { buildRound, scoreRound, studentMessage, wrongSourceIndexes } from "../Services/quizRounds";
import { LevelPill, ScoreRing } from "../Components/assessment/Badges";
import { useAuth } from "../context/useAuth";
import { logActivity } from "../Services/activityLog";
import { analyseQuiz } from "../Services/quizAnalysis";
import { PARENT_CHOICES, PARENT_CHOICE_ACTIONS } from "../Services/parentChoice";
import QuizAnalysis from "../Components/quiz/QuizAnalysis";
import ParentChoice from "../Components/quiz/ParentChoice";
import BookSource from "../Components/books/BookSource";
import { useBookSelection } from "../Components/books/useBookSelection";

const OPTION_LABELS = ["A", "B", "C", "D"];

const QuizGenerator = () => {
  const [formData, setFormData] = useState({ topic: "Plants Around Us", className: "Class 3", subject: "Science", duration: "15 mins", objective: "Check recall and comprehension" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [outputPalette, setOutputPalette] = useState(null);

  const [stage, setStage] = useState("preview"); // preview | active | results
  const [round, setRound] = useState(1); // round 1 is the whole quiz; later rounds are only the questions missed
  const [roundItems, setRoundItems] = useState([]); // this round's questions, options freshly shuffled
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [history, setHistory] = useState([]); // one summary per finished round
  const [firstAttempt, setFirstAttempt] = useState(null); // round 1, marked: the parent's performance analysis is read from it
  const [parentChoice, setParentChoice] = useState(null); // null | "offline" | "ai"
  const [quizContext, setQuizContext] = useState(null); // class / subject / topic this quiz was generated for
  const { user } = useAuth();
  const navigate = useNavigate();

  const subjects = useMemo(() => subjectMap[formData.className] || [], [formData.className]);
  const bookState = useBookSelection(formData.className, formData.subject);
  // The form previews the colour live; once generated the card keeps the palette it was
  // generated with, so editing the dropdowns cannot re-tint output already on screen.
  const formPalette = useMemo(() => getResourcePalette({ ...formData, type: "quiz" }), [formData]);
  const palette = outputPalette || formPalette;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "className") {
      setFormData({ ...formData, className: value, subject: subjectMap[value][0] || "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const runGeneration = async () => {
    setLoading(true);
    setError(null);
    try {
      const source = await bookState.buildSource(formData.topic); // the textbook pages, or null when the textbook is off
      const resource = await generateResource({ type: "quiz", formData: { ...formData, topic: `${formData.subject}: ${formData.topic}` }, source });
      setResult(resource);
      setEntry(await recordHistory({ type: "quiz", formData, result: resource }));
      setSaved(false);
      setOutputPalette(formPalette);
      setStage("preview");
      setRound(1);
      setRoundItems([]);
      setCurrentIndex(0);
      setAnswers([]);
      setHistory([]);
      setFirstAttempt(null);
      setParentChoice(null);
      setQuizContext({ className: formData.className, subject: formData.subject, topic: formData.topic });
    } catch (err) {
      setError(describeGeminiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runGeneration();
  };

  const toggleSave = async () => {
    if (!entry) return;
    setSaved((prev) => !prev);
    if (saved) {
      await removeSavedContent(entry.id);
    } else {
      await saveContent(entry);
    }
  };

  const questions = useMemo(() => result?.questions || [], [result]);
  const total = questions.length;

  const roundTotal = roundItems.length;
  const scored = useMemo(() => (stage === "results" ? scoreRound(roundItems, answers) : null), [stage, roundItems, answers]);
  const analysis = useMemo(
    () => (firstAttempt ? analyseQuiz({ scored: firstAttempt, topics: result?.topics || [], fallbackTopic: quizContext?.topic || "This topic" }) : null),
    [firstAttempt, result, quizContext]
  );

  const beginRound = (nextRound, sourceIndexes) => {
    const items = buildRound(questions, sourceIndexes);
    setRound(nextRound);
    setRoundItems(items);
    setAnswers(new Array(items.length).fill(null));
    setCurrentIndex(0);
    setStage("active");
  };

  const startQuiz = () => {
    setHistory([]);
    beginRound(1);
  };

  // Round 2, 3, ...: only the questions that were answered wrongly in the round just finished.
  const practiseMissed = () => beginRound(round + 1, wrongSourceIndexes(scored));

  const selectOption = (optionIndex) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
  };

  const goPrevious = () => setCurrentIndex((index) => Math.max(0, index - 1));

  const goNext = () => {
    if (currentIndex === roundTotal - 1) {
      const finished = scoreRound(roundItems, answers);
      setHistory((prev) => [...prev, { round, correct: finished.correct, total: finished.total, percentage: finished.percentage, label: finished.level.label }]);
      // A fresh run through the whole quiz is a new first attempt: it gets its own analysis and its own parent answer.
      if (round === 1) {
        setFirstAttempt(finished);
        setParentChoice(null);
      }
      setStage("results");
    } else {
      setCurrentIndex((index) => Math.min(roundTotal - 1, index + 1));
    }
  };

  const backToOverview = () => setStage("preview");

  // The parent's answer after the analysis. Neither answer touches the quiz; AI Classes is the only one that
  // leaves this page (to the plans), and Offline Tuition just records the answer and shows a thank-you.
  const handleParentChoice = (choice) => {
    if (choice === PARENT_CHOICES.offline && parentChoice === PARENT_CHOICES.offline) return;
    logActivity(user?.id, PARENT_CHOICE_ACTIONS[choice], {
      title: result?.title,
      className: quizContext?.className,
      subject: quizContext?.subject,
      topic: quizContext?.topic,
      correct: analysis.correct,
      total: analysis.attempted,
      percentage: analysis.percentage,
      level: analysis.level.label
    });
    if (choice === PARENT_CHOICES.ai) {
      navigate("/subscription?from=quiz");
      return;
    }
    setParentChoice(choice);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Quiz Generator" />
        <div className="content-area grid-layout">
          <form className="panel-card" onSubmit={handleSubmit}>
            <h3>Create a quiz</h3>
            <label>Class</label>
            <select name="className" value={formData.className} onChange={handleChange}>
              {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <label>Subject</label>
            <select name="subject" value={formData.subject} onChange={handleChange}>
              {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <label>Topic</label>
            <input name="topic" value={formData.topic} onChange={handleChange} />
            <BookSource state={bookState} className={formData.className} />
            <label>Duration</label>
            <input name="duration" value={formData.duration} onChange={handleChange} />
            <label>Learning objective</label>
            <input name="objective" value={formData.objective} onChange={handleChange} />
            <button className="primary-btn full" type="submit">Generate quiz</button>
          </form>

          <div className="panel-card output-card themed-output" style={{ "--resource-accent": palette.hex, "--resource-ink": palette.ink, "--resource-glow": palette.glow }}>
            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>Generating your quiz...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p><AlertTriangle size={16} /> {error}</p>
                <button type="button" className="secondary-btn" onClick={runGeneration}>Try again</button>
              </div>
            ) : result ? (
              <>
                <div className="output-card-header">
                  <h3>{result.title}</h3>
                  <button type="button" className={`save-toggle-btn ${saved ? "active" : ""}`} onClick={toggleSave}>
                    {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {saved ? "Saved" : "Save"}
                  </button>
                </div>

                {stage === "preview" && (
                  <div className="quiz-overview">
                    <p>{result.summary}</p>
                    <div className="quiz-meta-row">
                      <span className="preview-chip"><ListChecks size={15} /> {total} questions</span>
                      {result.note ? <span className="note">{result.note}</span> : null}
                    </div>
                    <button type="button" className="primary-btn full" onClick={startQuiz} disabled={total === 0}>
                      <PlayCircle size={16} /> Start Quiz
                    </button>
                    <ResourcePrint kind="quiz" resource={result} meta={formData} disabled={total === 0} hint />
                  </div>
                )}

                {stage === "active" && roundTotal > 0 && (
                  <div className="quiz-active">
                    <div className="quiz-progress-row">
                      <span>{round > 1 ? `Practice round ${round} · ` : ""}Question {currentIndex + 1} of {roundTotal}</span>
                      <div className="quiz-progress-track">
                        <div className="quiz-progress-fill" style={{ width: `${((currentIndex + 1) / roundTotal) * 100}%` }} />
                      </div>
                    </div>
                    <h4 className="quiz-question-text">{roundItems[currentIndex].question}</h4>
                    <div className="quiz-options">
                      {roundItems[currentIndex].options.map((option, optionIndex) => (
                        <button
                          type="button"
                          key={optionIndex}
                          className={`quiz-option-btn ${answers[currentIndex] === optionIndex ? "selected" : ""}`}
                          onClick={() => selectOption(optionIndex)}
                        >
                          <span className="quiz-option-label">{OPTION_LABELS[optionIndex]}</span>
                          {option}
                        </button>
                      ))}
                    </div>
                    <div className="quiz-nav-row">
                      <button type="button" className="secondary-btn" onClick={goPrevious} disabled={currentIndex === 0}>
                        Previous
                      </button>
                      <button type="button" className="primary-btn" onClick={goNext} disabled={answers[currentIndex] == null}>
                        {currentIndex === roundTotal - 1 ? "Finish Quiz" : "Next"}
                      </button>
                    </div>
                  </div>
                )}

                {stage === "results" && scored && (
                  <div className="quiz-results">
                    <div className="quiz-score-hero">
                      <span className="quiz-round-tag">{round === 1 ? "Your score" : `Practice round ${round}`}</span>
                      <ScoreRing percentage={scored.percentage} />
                      <strong>{scored.correct} / {scored.total}</strong>
                      <LevelPill percentage={scored.percentage} />
                    </div>

                    <p className={`quiz-student-message quiz-message-${toneForLevelLabel(scored.level.label)}`}>
                      {studentMessage({ scored, round })}
                    </p>

                    <div className="quiz-result-actions">
                      {scored.wrong.length > 0 ? (
                        <>
                          <button type="button" className="primary-btn" onClick={practiseMissed}>
                            <RotateCcw size={16} /> Practise the {scored.wrong.length} missed question{scored.wrong.length === 1 ? "" : "s"}
                          </button>
                          <button type="button" className="secondary-btn" onClick={startQuiz}>Retake whole quiz</button>
                        </>
                      ) : (
                        <button type="button" className="primary-btn" onClick={startQuiz}>
                          <RotateCcw size={16} /> Take the whole quiz again
                        </button>
                      )}
                      <button type="button" className="secondary-btn" onClick={backToOverview}>Back to overview</button>
                    </div>

                    {history.length > 1 && (
                      <div className="quiz-rounds-trail">
                        <ol>
                          {history.map((past) => (
                            <li key={past.round}>
                              <span>Round {past.round}</span>
                              <strong>{past.correct}/{past.total}</strong>
                              <span>{past.percentage}% · {past.label}</span>
                            </li>
                          ))}
                        </ol>
                        <p>You have now got {total - scored.wrong.length} of {total} questions right.</p>
                      </div>
                    )}

                    {scored.wrong.length > 0 && (
                      <section className="quiz-work-on">
                        <h4><Target size={16} /> Work on this part ({scored.wrong.length})</h4>
                        <div className="quiz-review-list quiz-work-list">
                          {scored.wrong.map((item) => (
                            <div key={item.sourceIndex} className="quiz-review-item incorrect">
                              <div className="quiz-review-question">
                                <XCircle size={16} />
                                <span>{item.sourceIndex + 1}. {item.question}</span>
                              </div>
                              <ul className="quiz-review-options">
                                {item.options.map((option, optionIndex) => {
                                  const isRight = optionIndex === item.correctIndex;
                                  const isChosen = optionIndex === item.chosenIndex;
                                  return (
                                    <li key={optionIndex} className={isRight ? "correct" : isChosen ? "incorrect" : ""}>
                                      {OPTION_LABELS[optionIndex]}. {option}
                                      {isRight && <span className="quiz-review-tag">correct answer</span>}
                                      {isChosen && !isRight && <span className="quiz-review-tag">your answer</span>}
                                    </li>
                                  );
                                })}
                              </ul>
                              {item.explanation ? <p className="quiz-review-why"><strong>Why:</strong> {item.explanation}</p> : null}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {scored.right.length > 0 && (
                      <details className="quiz-right-list">
                        <summary><CheckCircle2 size={16} /> You got {scored.right.length} right</summary>
                        <ul>
                          {scored.right.map((item) => (
                            <li key={item.sourceIndex}>{item.sourceIndex + 1}. {item.question} <strong>{item.options[item.correctIndex]}</strong></li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {analysis && (
                      <>
                        <QuizAnalysis analysis={analysis} />
                        <ParentChoice choice={parentChoice} onChoose={handleParentChoice} perfect={analysis.incorrect === 0} />
                      </>
                    )}

                    <p className="quiz-level-legend">{LEVEL_BANDS.map(describeBand).join(" · ")}</p>
                  </div>
                )}
              </>
            ) : <p>Prepare a quick check for understanding in seconds.</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default QuizGenerator;
