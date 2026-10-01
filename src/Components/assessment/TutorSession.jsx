import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, GraduationCap, Send, Sparkles } from "lucide-react";
import { TUTOR_OPENING, askTutor, tutorHistoryEntry } from "../../Services/assessmentService";
import { describeGeminiError } from "../../Services/geminiService";

// The AI teacher. `messages` is the only conversation state: the model's history is rebuilt from it
// on every turn, so there is no second copy to drift out of sync.
const toHistory = (messages) => [
  TUTOR_OPENING,
  ...messages.map((message) => (message.role === "teacher" ? tutorHistoryEntry(message.turn) : { role: "user", text: message.text }))
];

const TutorSession = ({ className, subject, weakArea, onFinish, onLeave }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [understood, setUnderstood] = useState(false);
  const [counts, setCounts] = useState({ correct: 0, total: 0 });

  const startedRef = useRef(false);
  const endRef = useRef(null);

  const requestTurn = async (conversation) => {
    setLoading(true);
    setError(null);
    try {
      const turn = await askTutor({ className, subject, weakArea, history: toHistory(conversation) });
      setMessages([...conversation, { role: "teacher", text: turn.message, turn }]);
      if (turn.answerStatus !== "none") {
        setCounts((prev) => ({ correct: prev.correct + (turn.answerStatus === "correct" ? 1 : 0), total: prev.total + 1 }));
      }
      if (turn.understandingDemonstrated) setUnderstood(true);
    } catch (err) {
      setError(describeGeminiError(err));
    } finally {
      setLoading(false);
    }
  };

  // The ref keeps React StrictMode's double-invoked effect from asking the AI to open the lesson twice.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    requestTurn([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;
    const conversation = [...messages, { role: "child", text }];
    setMessages(conversation);
    setDraft("");
    requestTurn(conversation);
  };

  const lastTurn = [...messages].reverse().find((message) => message.role === "teacher")?.turn;
  const awaitingAnswer = Boolean(lastTurn?.practiceQuestion) && !understood;

  return (
    <div className="tutor">
      <div className="tutor-header">
        <div className="tutor-title">
          <span className="resource-icon"><GraduationCap size={20} /></span>
          <div>
            <h4>AI teacher</h4>
            <p className="cell-muted">Practising: {weakArea.skill}</p>
          </div>
        </div>
        <span className="preview-chip"><Sparkles size={14} /> {counts.correct} of {counts.total} practice answers right</span>
      </div>

      <div className="tutor-thread" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={`tutor-bubble ${message.role}`}>
            <p>{message.text}</p>
            {message.role === "teacher" && message.turn.practiceQuestion ? (
              <div className="tutor-question"><strong>Try this:</strong> {message.turn.practiceQuestion}</div>
            ) : null}
          </div>
        ))}
        {loading ? <div className="tutor-bubble teacher tutor-typing"><span /><span /><span /></div> : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <div className="error-state">
          <p><AlertTriangle size={16} /> {error}</p>
          <button type="button" className="secondary-btn" onClick={() => requestTurn(messages)}>Try again</button>
        </div>
      ) : null}

      {understood ? (
        <div className="tutor-ready">
          <p>The child has shown they understand <strong>{weakArea.skill}</strong>. Time for a short practice test.</p>
          <button type="button" className="primary-btn" onClick={() => onFinish({ messages, counts })}>Start practice test</button>
        </div>
      ) : (
        <form className="tutor-input" onSubmit={send}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={awaitingAnswer ? "Type the child's answer…" : "Type a message…"}
            disabled={loading || messages.length === 0}
            aria-label="Child's answer"
            autoComplete="off"
          />
          <button type="submit" className="primary-btn" disabled={loading || !draft.trim()}>
            <Send size={16} /> Send
          </button>
        </form>
      )}

      <div className="tutor-footer">
        <button type="button" className="secondary-btn" onClick={onLeave}>Leave session</button>
        {!understood && counts.total > 0 ? (
          <button type="button" className="secondary-btn" onClick={() => onFinish({ messages, counts })}>End teaching and start practice test</button>
        ) : null}
      </div>
    </div>
  );
};

export default TutorSession;
