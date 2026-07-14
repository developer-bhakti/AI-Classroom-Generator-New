import React, { useMemo, useState } from "react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { generateResource } from "../Services/aiService";

const classOptions = Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`);

const subjectMap = {
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

const WorksheetGenerator = () => {
  const [formData, setFormData] = useState({ topic: "Fractions", className: "Class 4", subject: "Math", difficultyLevel: "Medium", numberOfQuestions: "10", worksheetType: "Practice", learningObjectives: "Practice problem solving", additionalInstructions: "Keep language simple and age appropriate" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const subjects = useMemo(() => subjectMap[formData.className] || [], [formData.className]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "className") {
      setFormData({ ...formData, className: value, subject: subjectMap[value][0] || "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const resource = await generateResource({ type: "worksheet", formData: { ...formData, topic: `${formData.subject}: ${formData.topic}` } });
    setResult(resource);
    setLoading(false);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Worksheet Generator" />
        <div className="content-area grid-layout">
          <form className="panel-card" onSubmit={handleSubmit}>
            <h3>Create a worksheet</h3>
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
            <label>Number of Questions</label>
            <input name="numberOfQuestions" value={formData.numberOfQuestions} onChange={handleChange} />
            <label>Worksheet Type</label>
            <input name="worksheetType" value={formData.worksheetType} onChange={handleChange} />
            <label>Learning Objectives</label>
            <input name="learningObjectives" value={formData.learningObjectives} onChange={handleChange} />
            <label>Additional Instructions</label>
            <textarea name="additionalInstructions" value={formData.additionalInstructions} onChange={handleChange} rows="3" />
            <div className="form-actions">
              <button className="primary-btn" type="submit">Generate Worksheet</button>
              <button className="secondary-btn" type="button" onClick={() => setFormData({ ...formData, topic: "", learningObjectives: "", additionalInstructions: "" })}>Clear</button>
              <button className="secondary-btn" type="button">Regenerate</button>
            </div>
          </form>

          <div className="panel-card output-card">
            {loading ? <p>Generating your worksheet...</p> : result ? (
              <>
                <h3>{result.title}</h3>
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
