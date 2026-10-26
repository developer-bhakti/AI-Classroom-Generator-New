import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, UserPlus } from "lucide-react";
import MonthSyllabusEditor from "./MonthSyllabusEditor";
import {
  ACADEMIC_MONTHS,
  TERMS,
  academicYearOptions,
  classOptions,
  currentAcademicYear,
  currentMonthName,
  parsePeriod,
  subjectMap,
  termLabel
} from "../../Services/curriculum";
import { listSyllabus, summarizePeriod } from "../../Services/syllabusService";
import { addStudent } from "../../Services/studentService";

/**
 * "Select student details": the student, class, academic year, subject and month. As soon as those
 * are chosen the syllabus for that month is loaded, so the child is checked only on what has been
 * taught. If the syllabus has not been added yet, the editor is right here.
 */
const AssessmentSetup = ({ userId, isAdmin, students, onStudentAdded, initial, onContinue }) => {
  const [studentId, setStudentId] = useState(initial.studentId || "");
  const [className, setClassName] = useState(initial.className || "UKG");
  const [subject, setSubject] = useState(initial.subject || subjectMap[initial.className || "UKG"][0]);
  const [academicYear, setAcademicYear] = useState(initial.academicYear || currentAcademicYear());
  const [periodKey, setPeriodKey] = useState(initial.periodKey || currentMonthName());

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [studentBusy, setStudentBusy] = useState(false);
  const [studentError, setStudentError] = useState(null);

  const [entries, setEntries] = useState(null); // null while loading
  const [syllabusError, setSyllabusError] = useState(null);
  const [editing, setEditing] = useState(false);

  const subjects = subjectMap[className] || [];
  const years = useMemo(() => academicYearOptions(), []);
  const period = useMemo(() => parsePeriod(periodKey) || parsePeriod(currentMonthName()), [periodKey]);
  const singleMonth = period.months.length === 1;

  const loadEntries = useCallback(async (isCurrent = () => true) => {
    try {
      const rows = await listSyllabus({ userId, academicYear, className, subject });
      if (isCurrent()) setEntries(rows);
    } catch (err) {
      if (isCurrent()) {
        setSyllabusError(err.message);
        setEntries([]);
      }
    }
  }, [userId, academicYear, className, subject]);

  useEffect(() => {
    let current = true;
    setEntries(null);
    setSyllabusError(null);
    setEditing(false);
    loadEntries(() => current);
    return () => { current = false; };
  }, [loadEntries]);

  const summary = useMemo(() => (entries ? summarizePeriod(entries, period.months) : null), [entries, period]);
  const hasTopics = Boolean(summary && summary.topics.length > 0);
  const student = students.find((item) => item.id === studentId);

  const changeStudent = (id) => {
    setStudentId(id);
    const chosen = students.find((item) => item.id === id);
    // A child's own class is the sensible default; the teacher can still change it.
    if (chosen && classOptions.includes(chosen.className) && chosen.className !== className) changeClass(chosen.className);
  };

  const changeClass = (value) => {
    setClassName(value);
    setSubject((current) => (subjectMap[value].includes(current) ? current : subjectMap[value][0]));
  };

  const submitNewStudent = async () => {
    if (!newName.trim()) return;
    setStudentBusy(true);
    setStudentError(null);
    try {
      const created = await addStudent({ teacherId: userId, name: newName, className });
      onStudentAdded(created);
      setStudentId(created.id);
      setNewName("");
      setAdding(false);
    } catch (err) {
      setStudentError(err.message);
    } finally {
      setStudentBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!student || !hasTopics) return;
    onContinue({
      student,
      className,
      subject,
      academicYear,
      period,
      syllabus: summary.months.filter((item) => item.topics.length > 0)
    });
  };

  const missingLink = summary && summary.missing.length > 0
    ? `/syllabus?view=monthly&year=${academicYear}&class=${encodeURIComponent(className)}&subject=${encodeURIComponent(subject)}&month=${summary.missing[0]}`
    : null;

  return (
    <form className="assess-setup" onSubmit={handleSubmit}>
      <div className="assess-block">
        <label htmlFor="assess-student">Student name</label>
        {students.length > 0 ? (
          <select id="assess-student" value={studentId} onChange={(e) => changeStudent(e.target.value)}>
            <option value="">Select a student…</option>
            {students.map((item) => <option key={item.id} value={item.id}>{item.name}{item.className ? ` — ${item.className}` : ""}</option>)}
          </select>
        ) : (
          <p className="cell-muted">No students yet — add the first one below.</p>
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

      <div className="assess-setup-grid four">
        <div>
          <label htmlFor="assess-class">Class</label>
          <select id="assess-class" value={className} onChange={(e) => changeClass(e.target.value)}>
            {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="assess-year">Academic year</label>
          <select id="assess-year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            {years.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="assess-subject">Subject</label>
          <select id="assess-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {subjects.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="assess-month">Month</label>
          <select id="assess-month" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
            <optgroup label="Month (monthly assessment)">
              {ACADEMIC_MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
            </optgroup>
            <optgroup label="Whole term (end-term assessment)">
              {TERMS.map((term) => <option key={term.id} value={`term:${term.id}`}>{termLabel(term)}</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      <section className="assess-block syl-preview" aria-live="polite">
        <div className="syl-preview-head">
          <h4><span aria-hidden="true">📚</span> Syllabus for {period.label}</h4>
          {entries === null ? <span className="cell-muted">Loading…</span> : null}
        </div>

        {syllabusError ? (
          <p className="inline-error"><AlertTriangle size={14} /> {syllabusError}. Run the latest supabase/schema.sql so the syllabus table exists.</p>
        ) : null}

        {summary ? summary.months.map((item) => (
          item.topics.length > 0 ? (
            <div className="syl-preview-month" key={item.month}>
              <p className="syl-preview-month-name">
                {!singleMonth ? <>{item.month} </> : null}
                <span className={`syl-source ${item.source}`}>{item.source === "school" ? "School syllabus" : "My syllabus"}</span>
              </p>
              <ul>{item.topics.map((topic, index) => <li key={index}>{topic}</li>)}</ul>
            </div>
          ) : (
            <p className="syl-missing" key={item.month}>
              <AlertTriangle size={14} /> No syllabus added for {item.month} yet.
            </p>
          )
        )) : null}

        {summary && summary.topics.length === 0 ? (
          <p className="cell-muted">
            The assessment only asks about topics that have been taught, so {singleMonth ? "add this month's syllabus" : "add the syllabus for this term's months"} first.
          </p>
        ) : null}

        {summary && singleMonth ? (
          <>
            {hasTopics ? (
              <button type="button" className="assess-link" onClick={() => setEditing((on) => !on)}>
                {editing ? "Hide the editor" : "Edit this month's syllabus"}
              </button>
            ) : null}
            {!hasTopics || editing ? (
              <MonthSyllabusEditor
                key={`${academicYear}|${className}|${subject}|${period.key}`}
                userId={userId}
                isAdmin={isAdmin}
                academicYear={academicYear}
                className={className}
                subject={subject}
                month={period.months[0]}
                entries={entries}
                onSaved={() => loadEntries()}
              />
            ) : null}
          </>
        ) : null}

        {summary && !singleMonth && missingLink ? (
          <Link to={missingLink} className="assess-link">Add the missing months in the Syllabus section →</Link>
        ) : null}
      </section>

      <button type="submit" className="primary-btn full" disabled={!student || !hasTopics}>
        Continue to evaluation <ArrowRight size={16} />
      </button>
      {!student ? <p className="cell-muted assess-hint">Choose a student to begin.</p> : !hasTopics && summary ? <p className="cell-muted assess-hint">Add the syllabus above to continue.</p> : null}
    </form>
  );
};

export default AssessmentSetup;
