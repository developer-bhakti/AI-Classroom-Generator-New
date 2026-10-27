import React, { useMemo, useState } from "react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { Sparkles, FileText, CheckCircle2, Bookmark, BookmarkCheck, AlertTriangle } from "lucide-react";
import { generateResource } from "../Services/aiService";
import { describeGeminiError } from "../Services/geminiService";
import { recordHistory, saveContent, removeSavedContent } from "../Services/contentStore";
import { getResourcePalette } from "../Services/resourcePalette";
import { classOptions, subjectMap } from "../Services/curriculum";
import TeacherAnswerKey from "../Components/TeacherAnswerKey";
import ResourcePrint from "../Components/print/ResourcePrint";

const ExamPaper = () => {
  const [formData, setFormData] = useState({
    className: "Class 3",
    subject: "Math",
    topic: "Fractions",
    duration: "40 mins",
    totalMarks: "20",
    difficulty: "Medium",
    instructions: "Answer all questions and show working where needed"
  });
  const [generatedPaper, setGeneratedPaper] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [outputPalette, setOutputPalette] = useState(null);

  const subjects = useMemo(() => subjectMap[formData.className] || [], [formData.className]);
  // The form previews the colour live; once generated the card keeps the palette it was
  // generated with, so editing the dropdowns cannot re-tint output already on screen.
  const formPalette = useMemo(() => getResourcePalette({ ...formData, type: "exam" }), [formData]);
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
      const paper = await generateResource({
        type: "exam",
        formData: {
          ...formData,
          topic: `${formData.subject}: ${formData.topic}`
        }
      });
      setGeneratedPaper(paper);
      setEntry(await recordHistory({ type: "exam", formData, result: paper }));
      setSaved(false);
      setOutputPalette(formPalette);
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

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Exam Paper" />
        <div className="content-area">
          <div className="page-intro">
            <div className="page-intro-badge">New</div>
            <h3>Create a professional exam paper</h3>
            <p>Set the class, subject, topic, marks, and instructions for a polished assessment draft.</p>
          </div>

          <div className="grid-layout">
            <form className="panel-card exam-form-card" onSubmit={handleSubmit}>
              <div className="form-card-header">
                <div className="resource-icon"><FileText size={18} /></div>
                <div>
                  <h3>Exam Paper Details</h3>
                  <p>Fill in the basics and generate a polished draft.</p>
                </div>
              </div>
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

              <label>Total Marks</label>
              <input name="totalMarks" value={formData.totalMarks} onChange={handleChange} />

              <label>Difficulty</label>
              <select name="difficulty" value={formData.difficulty} onChange={handleChange}>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>

              <label>Instructions</label>
              <textarea name="instructions" value={formData.instructions} onChange={handleChange} rows="3" />

              <button className="primary-btn full" type="submit">Create Exam Paper</button>
            </form>

            <div className="panel-card output-card exam-preview-card themed-output" style={{ "--resource-accent": palette.hex, "--resource-ink": palette.ink, "--resource-glow": palette.glow }}>
              <div className="preview-top">
                <div className="resource-icon"><Sparkles size={18} /></div>
                <div>
                  <h3>Generated Preview</h3>
                  <p>Ready-to-use assessment content appears here.</p>
                </div>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>Generating your exam paper...</p>
                </div>
              ) : error ? (
                <div className="error-state">
                  <p><AlertTriangle size={16} /> {error}</p>
                  <button type="button" className="secondary-btn" onClick={runGeneration}>Try again</button>
                </div>
              ) : generatedPaper ? (
                <>
                  <div className="output-card-header">
                    <div className="preview-chip">
                      <CheckCircle2 size={16} />
                      Draft generated successfully
                    </div>
                    <button type="button" className={`save-toggle-btn ${saved ? "active" : ""}`} onClick={toggleSave}>
                      {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {saved ? "Saved" : "Save"}
                    </button>
                  </div>
                  <h4>{generatedPaper.title}</h4>
                  <p>{generatedPaper.summary}</p>
                  {generatedPaper.sections.map((section) => (
                    <div key={section.heading} className="output-section">
                      <h4>{section.heading}</h4>
                      <ul>
                        {section.items.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ))}
                  <p className="note">{generatedPaper.note}</p>
                  <ResourcePrint kind="exam" resource={generatedPaper} meta={formData} hint />
                  <TeacherAnswerKey answerKey={generatedPaper.answerKey} title={generatedPaper.title} meta={formData} />
                </>
              ) : (
                <div className="empty-state">
                  <p><strong>Class:</strong> {formData.className}</p>
                  <p><strong>Subject:</strong> {formData.subject}</p>
                  <p><strong>Topic:</strong> {formData.topic}</p>
                  <p><strong>Duration:</strong> {formData.duration}</p>
                  <p><strong>Total Marks:</strong> {formData.totalMarks}</p>
                  <p><strong>Difficulty:</strong> {formData.difficulty}</p>
                  <p><strong>Instructions:</strong> {formData.instructions}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExamPaper;
