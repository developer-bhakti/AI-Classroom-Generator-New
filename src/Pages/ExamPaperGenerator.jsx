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
  "Class 6": ["English", "Math", "Science", "Social Studies"],
  "Class 7": ["English", "Math", "Science", "Social Studies"],
  "Class 8": ["English", "Math", "Science", "Social Studies"],
  "Class 9": ["English", "Math", "Science", "History"],
  "Class 10": ["English", "Math", "Science", "History"],
  "Class 11": ["Physics", "Chemistry", "Biology", "Math"],
  "Class 12": ["Physics", "Chemistry", "Biology", "Math", "Computer Science"]
};

const ExamPaperGenerator = () => {
  const [formData, setFormData] = useState({
    topic: "Fractions",
    className: "Class 6",
    subject: "Math",
    duration: "40 mins",
    totalMarks: "20",
    difficulty: "Medium",
    instructions: "Answer all questions and show working where needed"
  });
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
    const resource = await generateResource({ type: "exam", formData: { ...formData, topic: `${formData.subject}: ${formData.topic}` } });
    setResult(resource);
    setLoading(false);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Exam Paper Generator" />
        <div className="content-area">
          <div className="page-intro">
            <div className="page-intro-badge">New</div>
            <h3>Create polished exam papers for your class</h3>
            <p>Build balanced assessment papers with clear sections, instructions, and answer support in minutes.</p>
          </div>

          <div className="grid-layout">
            <form className="panel-card" onSubmit={handleSubmit}>
              <h3>Design an exam paper</h3>
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
              <button className="primary-btn full" type="submit">Generate Exam Paper</button>
            </form>

            <div className="panel-card output-card">
              {loading ? <p>Generating your exam paper...</p> : result ? (
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
              ) : <p>Craft a fair and polished exam paper for your next assessment.</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExamPaperGenerator;
