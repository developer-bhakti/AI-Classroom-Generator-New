import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, GraduationCap, Send, Sparkles } from "lucide-react";
import { REQUEST_STATUS_LABELS, createTeacherRequest, listTeacherRequests } from "../../Services/studentService";

const TIME_OPTIONS = ["Morning (8 am – 12 pm)", "Afternoon (12 – 4 pm)", "Evening (4 – 8 pm)", "Weekends only"];

const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// The "Yes" branch: ask Adiuvaret to match an online teacher for the weak areas found, and show
// the requests already made for this child. AI-guided practice stays available as a quicker option.
const TeacherSupport = ({ teacherId, defaultContact, student, record, className, subject, onStartPractice }) => {
  const [selected, setSelected] = useState(() => record.weakAreas.map((area) => area.skill));
  const [preferredTime, setPreferredTime] = useState(TIME_OPTIONS[2]);
  const [contact, setContact] = useState(defaultContact || "");
  const [note, setNote] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sentJustNow, setSentJustNow] = useState(false);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    let active = true;
    listTeacherRequests(student.id)
      .then((rows) => { if (active) setRequests(rows); })
      .catch((err) => console.warn(err.message));
    return () => { active = false; };
  }, [student.id]);

  const toggle = (skill) => setSelected((prev) => (prev.includes(skill) ? prev.filter((item) => item !== skill) : [...prev, skill]));

  const submit = async (e) => {
    e.preventDefault();
    if (selected.length === 0 || !contact.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await createTeacherRequest({
        teacherId,
        studentId: student.id,
        assessmentId: record.persisted ? record.id : null,
        className,
        subject,
        // Both the broad skill areas and the specific topics, so staff can match on either.
        areas: [
          ...new Set(record.weakAreas.filter((area) => selected.includes(area.skill) && area.area).map((area) => area.area)),
          ...selected
        ],
        preferredTime,
        contact,
        note
      });
      setRequests((prev) => [created, ...prev]);
      setSentJustNow(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="teacher-support">
      <h4><GraduationCap size={18} /> Online teacher support</h4>

      {sentJustNow ? (
        <div className="success-state">
          <p><CheckCircle2 size={16} /> Request sent. Adiuvaret will match an online {subject} teacher and get in touch on {contact.trim()}.</p>
        </div>
      ) : (
        <form className="teacher-support-form" onSubmit={submit}>
          <p className="cell-muted">
            For <strong>{student.name}</strong> — {className} {subject}. Pick the areas the teacher should focus on.
          </p>

          <fieldset className="teacher-support-areas">
            <legend>Areas of improvement</legend>
            {record.weakAreas.map((area) => (
              <label key={area.skill} className="teacher-support-check">
                <input type="checkbox" checked={selected.includes(area.skill)} onChange={() => toggle(area.skill)} />
                <span>
                  {area.skill}
                  {area.area ? <span className="assess-tag">{area.area}</span> : null}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="assess-setup-grid">
            <div>
              <label htmlFor="ts-time">Preferred time</label>
              <select id="ts-time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)}>
                {TIME_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ts-contact">Email or phone to reach you</label>
              <input id="ts-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@school.in or 98xxxxxxx" />
            </div>
          </div>

          <label htmlFor="ts-note">Anything the teacher should know <span className="cell-muted">(optional)</span></label>
          <textarea id="ts-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Child is shy; prefers short sessions" />

          {error ? <p className="inline-error"><AlertTriangle size={14} /> {error}</p> : null}

          <button type="submit" className="primary-btn" disabled={sending || selected.length === 0 || !contact.trim()}>
            <Send size={16} /> {sending ? "Sending…" : "Request an online teacher"}
          </button>
        </form>
      )}

      {requests.length > 0 ? (
        <div className="teacher-support-history">
          <h5>Requests for {student.name}</h5>
          <ul>
            {requests.map((request) => (
              <li key={request.id}>
                <span>{request.subject} · {request.areas.slice(0, 3).join(", ")}{request.areas.length > 3 ? "…" : ""}</span>
                <span className="cell-muted">{formatDate(request.createdAt)}</span>
                <span className={`request-pill request-${request.status}`}>{REQUEST_STATUS_LABELS[request.status] || request.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="teacher-support-ai">
        <p className="cell-muted"><Sparkles size={14} /> Want to start right away? The AI teacher can practise one weak topic with the child now.</p>
        <div className="assess-pick">
          {record.weakAreas.map((area) => (
            <button type="button" key={area.skill} className="secondary-btn" onClick={() => onStartPractice(area)}>
              Practise with AI: {area.skill}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeacherSupport;
