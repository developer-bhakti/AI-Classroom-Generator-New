import React, { useMemo, useState } from "react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { Bookmark, BookmarkCheck, AlertTriangle } from "lucide-react";
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

const LessonGenerator = () => {
  const [formData, setFormData] = useState({ topic: "The Water Cycle", className: "Class 5", subject: "Science", duration: "45 mins", objective: "Explain each stage clearly" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [outputPalette, setOutputPalette] = useState(null);

  const subjects = useMemo(() => subjectMap[formData.className] || [], [formData.className]);
  // The form previews the colour live; once generated the card keeps the palette it was
  // generated with, so editing the dropdowns cannot re-tint output already on screen.
  const formPalette = useMemo(() => getResourcePalette({ ...formData, type: "lesson" }), [formData]);
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
      const resource = await generateResource({ type: "lesson", formData: { ...formData, topic: `${formData.subject}: ${formData.topic}` } });
      setResult(resource);
      setEntry(await recordHistory({ type: "lesson", formData, result: resource }));
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
        <Navbar title="Lesson Generator" />
        <div className="content-area grid-layout">
          <form className="panel-card" onSubmit={handleSubmit}>
            <h3>Create a lesson plan</h3>
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
            <button className="primary-btn full" type="submit">Generate lesson plan</button>
          </form>

          <div className="panel-card output-card themed-output" style={{ "--resource-accent": palette.hex, "--resource-ink": palette.ink, "--resource-glow": palette.glow }}>
            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>Generating your lesson plan...</p>
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
                <p>{result.summary}</p>
                {result.sections.map((section) => (
                  <div key={section.heading} className="output-section">
                    <h4>{section.heading}</h4>
                    <ul>
                      {section.items.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ))}
                <p className="note">{result.note}</p>
              </>
            ) : <p>Build a structure for your next class with one click.</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LessonGenerator;