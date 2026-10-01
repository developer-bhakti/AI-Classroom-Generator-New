import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, UserPlus, X } from "lucide-react";
import { classOptions, subjectMap } from "../../Services/curriculum";
import { getSyllabusAreas, getSyllabusTopics } from "../../Services/syllabus";
import { addStudent } from "../../Services/studentService";

const AssessmentSetup = ({ kind, teacherId, students, onStudentAdded, onStart, busy }) => {
  const isCurrent = kind === "current";

  const [className, setClassName] = useState("Class 3");
  const [subject, setSubject] = useState("Math");
  const [topics, setTopics] = useState([]);
  const [customTopic, setCustomTopic] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [studentId, setStudentId] = useState("");

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [studentBusy, setStudentBusy] = useState(false);
  const [studentError, setStudentError] = useState(null);

  const subjects = subjectMap[className] || [];
  const areas = useMemo(() => getSyllabusAreas(className, subject), [className, subject]);
  const builtInTopics = useMemo(() => getSyllabusTopics(className, subject), [className, subject]);

  const changeClass = (value) => {
    setClassName(value);
    setSubject(subjectMap[value][0] || "");
    setTopics([]);
  };

  const changeSubject = (value) => {
    setSubject(value);
    setTopics([]);
  };

  const toggleTopic = (topic) => setTopics((prev) => (prev.includes(topic) ? prev.filter((item) => item !== topic) : [...prev, topic]));

  const addCustomTopic = () => {
    const value = customTopic.trim();
    if (value && !topics.some((topic) => topic.toLowerCase() === value.toLowerCase())) setTopics((prev) => [...prev, value]);
    setCustomTopic("");
  };

  const submitNewStudent = async () => {
    if (!newName.trim()) return;
    setStudentBusy(true);
    setStudentError(null);
    try {
      const student = await addStudent({ teacherId, name: newName, className });
      onStudentAdded(student);
      setStudentId(student.id);
      setNewName("");
      setAdding(false);
    } catch (err) {
      setStudentError(err.message);
    } finally {
      setStudentBusy(false);
    }
  };

  const student = students.find((item) => item.id === studentId);
  const customTopics = topics.filter((topic) => !builtInTopics.includes(topic));
  const canStart = Boolean(student) && (!isCurrent || topics.length > 0 || progressNote.trim() !== "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canStart || busy) return;
    onStart({
      kind,
      className,
      subject,
      // An end-term paper covers everything in the built-in syllabus; with none, the AI uses the standard one.
      topics: isCurrent ? topics : builtInTopics,
      progressNote: isCurrent ? progressNote.trim() : "",
      student
    });
  };

  return (
    <form className="assess-setup" onSubmit={handleSubmit}>
      <div className="assess-setup-grid">
        <div>
          <label htmlFor="assess-class">Class</label>
          <select id="assess-class" value={className} onChange={(e) => changeClass(e.target.value)}>
            {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="assess-subject">Subject</label>
          <select id="assess-subject" value={subject} onChange={(e) => changeSubject(e.target.value)}>
            {subjects.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      {isCurrent ? (
        <div className="assess-block">
          <label>Syllabus covered so far</label>
          {areas.length > 0 ? (
            areas.map((area) => (
              <div className="assess-area" key={area.area}>
                <p className="assess-area-title">{area.area}</p>
                <div className="assess-chip-row">
                  {area.topics.map((topic) => {
                    const on = topics.includes(topic);
                    return (
                      <button type="button" key={topic} className={`assess-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggleTopic(topic)}>
                        {on ? <Check size={13} /> : null} {topic}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="cell-muted">No built-in syllabus for {className} {subject} yet — add the topics taught so far below.</p>
          )}

          <div className="assess-add-topic">
            <input
              value={customTopic}
              placeholder={areas.length > 0 ? "Add another topic…" : "Type a topic, e.g. Fractions"}
              onChange={(e) => setCustomTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomTopic();
                }
              }}
              aria-label="Add a topic"
            />
            <button type="button" className="secondary-btn" onClick={addCustomTopic} disabled={!customTopic.trim()}>
              <Plus size={16} /> Add
            </button>
          </div>
          {customTopics.length > 0 ? (
            <div className="assess-chip-row">
              {customTopics.map((topic) => (
                <button type="button" key={topic} className="assess-chip on" onClick={() => toggleTopic(topic)} aria-label={`Remove ${topic}`}>
                  {topic} <X size={13} />
                </button>
              ))}
            </div>
          ) : null}

          <label htmlFor="assess-progress">Monthly progress note <span className="cell-muted">(optional)</span></label>
          <input id="assess-progress" value={progressNote} placeholder="e.g. Completed up to May; multiplication just started" onChange={(e) => setProgressNote(e.target.value)} />
        </div>
      ) : (
        <div className="assess-block">
          <label>Syllabus covered</label>
          {builtInTopics.length > 0 ? (
            <>
              <p className="cell-muted">The end-term paper covers the whole {className} {subject} syllabus:</p>
              <div className="assess-chip-row">
                {builtInTopics.map((topic) => <span className="assess-chip on static" key={topic}>{topic}</span>)}
              </div>
            </>
          ) : (
            <p className="cell-muted">The paper will cover the standard {className} {subject} syllabus for the whole term.</p>
          )}
        </div>
      )}

      <div className="assess-block">
        <label htmlFor="assess-student">Student</label>
        {students.length > 0 ? (
          <select id="assess-student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select a student…</option>
            {students.map((item) => <option key={item.id} value={item.id}>{item.name}{item.className ? ` — ${item.className}` : ""}</option>)}
          </select>
        ) : (
          <p className="cell-muted">You haven't added any students yet.</p>
        )}

        {adding ? (
          <div className="assess-add-topic">
            <input
              value={newName}
              placeholder={`Student's name (added to ${className})`}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNewStudent();
                }
              }}
              aria-label="New student's name"
              autoFocus
            />
            <button type="button" className="primary-btn" onClick={submitNewStudent} disabled={studentBusy || !newName.trim()}>
              {studentBusy ? "Adding…" : "Add student"}
            </button>
            <button type="button" className="secondary-btn" onClick={() => { setAdding(false); setStudentError(null); }}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="secondary-btn assess-add-student" onClick={() => setAdding(true)}>
            <UserPlus size={16} /> Add a new student
          </button>
        )}
        {studentError ? <p className="inline-error"><AlertTriangle size={14} /> {studentError}</p> : null}
      </div>

      <button type="submit" className="primary-btn full" disabled={!canStart || busy}>
        {busy ? "Preparing the paper…" : "Generate 20-question assessment"}
      </button>
      {!canStart && student ? <p className="cell-muted assess-hint">Pick at least one topic the class has covered, or write a progress note.</p> : null}
    </form>
  );
};

export default AssessmentSetup;
