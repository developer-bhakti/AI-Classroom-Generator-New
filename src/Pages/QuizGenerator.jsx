import React, { useMemo, useState } from "react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { Bookmark, BookmarkCheck, AlertTriangle, PlayCircle, CheckCircle2, XCircle, RotateCcw, ListChecks } from "lucide-react";
import { generateResource } from "../Services/aiService";
import { describeGeminiError } from "../Services/geminiService";
import { recordHistory, saveContent, removeSavedContent } from "../Services/contentStore";
import { getResourcePalette } from "../Services/resourcePalette";

const classOptions = ["PG", "Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`)];

const subjectMap = {
  "PG": ["English", "Math", "EVS"],
  "Nursery": ["English", "Math", "EVS"],
  "LKG": ["English", "Math", "EVS"],
  "UKG": ["English", "Math", "EVS"],
  "Class 1": ["English", "Math", "EVS"],
  "Class 2": ["English", "Math", "EVS"],
  "Class 3": ["English", "Math", "Science"],
  "Class 4": ["English", "Math", "Science"],
  "Class 5": ["English", "Math", "Science"],
  "Class 6": ["English", "Math", "Science", "Social Studies"],
  "Class 7": ["English", "Math", "Science", "Social Studies"],
  "Class 8": ["English", "Math", "Science", "Social Studies"],
  "Class 9": ["English", "Math", "Science", "History"],
  "Class 10": ["English", "Math", "Science", "History"],
  "Class 11": ["Physics", "Chemistry", "Biology", "Math"],
  "Class 12": ["Physics", "Chemistry", "Biology", "Math", "Computer Science"]
};

const OPTION_LABELS = ["A", "B", "C", "D"];

const QuizGenerator = () => {
  const [formData, setFormData] = useState({ topic: "World History", className: "Class 6", subject: "Social Studies", duration: "15 mins", objective: "Check recall and comprehension" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [outputPalette, setOutputPalette] = useState(null);

  const [stage, setStage] = useState("preview"); // preview | active | results
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);

  const subjects = useMemo(() => subjectMap[formData.className] || [], [formData.className]);
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
      const resource = await generateResource({ type: "quiz", formData: { ...formData, topic: `${formData.subject}: ${formData.topic}` } });
      setResult(resource);
      setEntry(await recordHistory({ type: "quiz", formData, result: resource }));
      setSaved(false);
      setOutputPalette(formPalette);
      setStage("preview");
      setCurrentIndex(0);
      setAnswers(new Array(resource.questions?.length || 0).fill(null));
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

  const score = useMemo(() => {
    if (stage !== "results") return 0;
    return questions.reduce((count, q, index) => (answers[index] === q.correctIndex ? count + 1 : count), 0);
  }, [stage, questions, answers]);

  const startQuiz = () => {
    setAnswers(new Array(total).fill(null));
    setCurrentIndex(0);
    setStage("active");
  };

  const selectOption = (optionIndex) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
  };

  const goPrevious = () => setCurrentIndex((index) => Math.max(0, index - 1));

  const goNext = () => {
    if (currentIndex === total - 1) {
      setStage("results");
    } else {
      setCurrentIndex((index) => Math.min(total - 1, index + 1));
    }
  };

  const retakeQuiz = () => {
    setAnswers(new Array(total).fill(null));
    setCurrentIndex(0);
    setStage("active");
  };

  const backToOverview = () => setStage("preview");

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
                  </div>
                )}

                {stage === "active" && total > 0 && (
                  <div className="quiz-active">
                    <div className="quiz-progress-row">
                      <span>Question {currentIndex + 1} of {total}</span>
                      <div className="quiz-progress-track">
                        <div className="quiz-progress-fill" style={{ width: `${((currentIndex + 1) / total) * 100}%` }} />
                      </div>
                    </div>
                    <h4 className="quiz-question-text">{questions[currentIndex].question}</h4>
                    <div className="quiz-options">
                      {questions[currentIndex].options.map((option, optionIndex) => (
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
                        {currentIndex === total - 1 ? "Finish Quiz" : "Next"}
                      </button>
                    </div>
                  </div>
                )}

                {stage === "results" && (
                  <div className="quiz-results">
                    <div className="quiz-score-card">
                      <strong>{score} / {total}</strong>
                      <span>You scored {total ? Math.round((score / total) * 100) : 0}%</span>
                    </div>
                    <div className="quiz-review-list">
                      {questions.map((q, index) => {
                        const userAnswer = answers[index];
                        const isCorrect = userAnswer === q.correctIndex;
                        return (
                          <div key={index} className={`quiz-review-item ${isCorrect ? "correct" : "incorrect"}`}>
                            <div className="quiz-review-question">
                              {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                              <span>{index + 1}. {q.question}</span>
                            </div>
                            <ul className="quiz-review-options">
                              {q.options.map((option, optionIndex) => {
                                let optionClass = "";
                                if (optionIndex === q.correctIndex) optionClass = "correct";
                                else if (optionIndex === userAnswer) optionClass = "incorrect";
                                return (
                                  <li key={optionIndex} className={optionClass}>
                                    {OPTION_LABELS[optionIndex]}. {option}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                    <div className="quiz-nav-row">
                      <button type="button" className="secondary-btn" onClick={backToOverview}>Back to overview</button>
                      <button type="button" className="primary-btn" onClick={retakeQuiz}>
                        <RotateCcw size={16} /> Retake Quiz
                      </button>
                    </div>
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
