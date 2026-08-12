import React, { useMemo, useState } from "react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { Bookmark, BookmarkCheck, AlertTriangle, Image as ImageIcon, FileText, Download } from "lucide-react";
import { generateResource, generateResourceImage } from "../Services/aiService";
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
  "Class 6": ["English", "Math", "Science", "Social Science"],
  "Class 7": ["English", "Math", "Science", "Social Science"],
  "Class 8": ["English", "Math", "Science", "Social Science"],
  "Class 9": ["English", "Math", "Science", "History"],
  "Class 10": ["English", "Math", "Science", "History"],
  "Class 11": ["Physics", "Chemistry", "Biology", "Math"],
  "Class 12": ["Physics", "Chemistry", "Biology", "Math", "Computer Science"]
};

const slugify = (value) => (value || "worksheet").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "worksheet";

const WorksheetGenerator = () => {
  const [formData, setFormData] = useState({ topic: "Fractions", className: "Class 4", subject: "Math", difficultyLevel: "Medium", worksheetType: "Practice", learningObjectives: "Practice problem solving", additionalInstructions: "Keep language simple and age appropriate" });
  const [outputMode, setOutputMode] = useState("image");
  const [result, setResult] = useState(null);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [outputPalette, setOutputPalette] = useState(null);

  const subjects = useMemo(() => subjectMap[formData.className] || [], [formData.className]);
  // The form's live palette previews the colour before generating; once something has been
  // generated the card keeps *that* palette, so editing the dropdowns can't re-tint old output.
  const formPalette = useMemo(() => getResourcePalette({ ...formData, type: "worksheet" }), [formData]);
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
      if (outputMode === "image") {
        setImage(await generateResourceImage({ type: "worksheet", formData }));
      } else {
        const resource = await generateResource({ type: "worksheet", formData: { ...formData, topic: `${formData.subject}: ${formData.topic}` } });
        setResult(resource);
        setEntry(await recordHistory({ type: "worksheet", formData, result: resource }));
        setSaved(false);
      }
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

  // Switching modes clears the error so a failure in one mode doesn't hide the other's output.
  const switchMode = (mode) => {
    setOutputMode(mode);
    setError(null);
  };

  const downloadImage = () => {
    if (!image) return;
    const link = document.createElement("a");
    link.href = image.dataUrl;
    link.download = `${slugify(formData.topic)}-worksheet.${image.mimeType === "image/jpeg" ? "jpg" : "png"}`;
    link.click();
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
        <Navbar title="Worksheet Generator" />
        <div className="content-area grid-layout">
          <form className="panel-card" onSubmit={handleSubmit}>
            <h3>Create a worksheet</h3>
            <label>Output</label>
            <div className="mode-toggle" role="group" aria-label="Worksheet output format">
              <button type="button" className={outputMode === "image" ? "active" : ""} aria-pressed={outputMode === "image"} onClick={() => switchMode("image")}>
                <ImageIcon size={15} /> Worksheet image
              </button>
              <button type="button" className={outputMode === "text" ? "active" : ""} aria-pressed={outputMode === "text"} onClick={() => switchMode("text")}>
                <FileText size={15} /> Text worksheet
              </button>
            </div>
            <p className="palette-hint">
              <span className="palette-dot" style={{ background: formPalette.hex }} />
              {formData.className} {formData.subject} comes out in {formPalette.name} • {formPalette.bandLabel} styling
            </p>
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
            <label>Difficulty Level</label>
            <select name="difficultyLevel" value={formData.difficultyLevel} onChange={handleChange}>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <label>Worksheet Type</label>
            <input name="worksheetType" value={formData.worksheetType} onChange={handleChange} />
            <label>Learning Objectives</label>
            <input name="learningObjectives" value={formData.learningObjectives} onChange={handleChange} />
            <label>Additional Instructions</label>
            <textarea name="additionalInstructions" value={formData.additionalInstructions} onChange={handleChange} rows="3" />
            <div className="form-actions">
              <button className="primary-btn" type="submit" disabled={loading}>{outputMode === "image" ? "Generate Worksheet Image" : "Generate Worksheet"}</button>
              <button className="secondary-btn" type="button" onClick={() => setFormData({ ...formData, topic: "", learningObjectives: "", additionalInstructions: "" })}>Clear</button>
              <button className="secondary-btn" type="button" disabled={loading} onClick={() => runGeneration()}>Regenerate</button>
            </div>
          </form>

          <div className="panel-card output-card themed-output" style={{ "--resource-accent": palette.hex, "--resource-ink": palette.ink, "--resource-glow": palette.glow }}>
            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>{outputMode === "image" ? "Drawing your worksheet — this takes a little longer than text..." : "Generating your worksheet..."}</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p><AlertTriangle size={16} /> {error}</p>
                <button type="button" className="secondary-btn" onClick={() => runGeneration()}>Try again</button>
              </div>
            ) : outputMode === "image" ? (
              image ? (
                <>
                  <div className="output-card-header">
                    <h3>{image.title}</h3>
                    <button type="button" className="save-toggle-btn" onClick={downloadImage}>
                      <Download size={16} /> Download
                    </button>
                  </div>
                  <div className="worksheet-image-frame">
                    <img className="worksheet-image" src={image.dataUrl} alt={`Printable worksheet on ${formData.topic}`} />
                  </div>
                  <p className="note">{image.note}</p>
                </>
              ) : <p>Type a topic — Independence Day, Fractions, The Water Cycle — and generate a printable worksheet page.</p>
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
            ) : <p>Try a prompt to generate a worksheet for your class.</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default WorksheetGenerator;
