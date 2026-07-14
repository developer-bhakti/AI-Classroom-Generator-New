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

const QuizGenerator = () => {
  const [formData, setFormData] = useState({ topic: "World History", className: "Class 6", subject: "Social Studies", duration: "15 mins", objective: "Check recall and comprehension" });
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
    const resource = await generateResource({ type: "quiz", formData: { ...formData, topic: `${formData.subject}: ${formData.topic}` } });
    setResult(resource);
    setLoading(false);
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
            <label>Duration</label>
            <input name="duration" value={formData.duration} onChange={handleChange} />
            <label>Learning objective</label>
            <input name="objective" value={formData.objective} onChange={handleChange} />
            <button className="primary-btn full" type="submit">Generate quiz</button>
          </form>

          <div className="panel-card output-card">
            {loading ? <p>Generating your quiz...</p> : result ? (
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
            ) : <p>Prepare a quick check for understanding in seconds.</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default QuizGenerator;
