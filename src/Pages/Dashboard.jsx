import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { FileText, BookOpen, HelpCircle, Sparkles, ArrowRight, PencilRuler, Languages } from "lucide-react";
import { LANGUAGES, getLanguage, setLanguage } from "../Services/contentStore";
import { useAuth } from "../context/useAuth";
import {
  ACADEMIC_MONTHS,
  TERMS,
  academicYearOptions,
  classOptions,
  currentAcademicYear,
  currentMonthName,
  subjectMap,
  termLabel
} from "../Services/curriculum";

// The seven doors into the child-assessment side of the app. `tint` picks the card's pastel colour.
const HUB_CARDS = [
  { emoji: "📚", title: "Annual Syllabus", text: "Add the whole year, term by term", to: "/syllabus?view=annual", tint: "lavender" },
  { emoji: "📅", title: "Monthly Syllabus", text: "Topics and learning outcomes for each month", to: "/syllabus?view=monthly", tint: "sky" },
  { emoji: "👧", title: "Student Details", text: "Each child, their class and their progress", to: "/students?view=details", tint: "pink" },
  { emoji: "📝", title: "Assessment", text: "A 20-question paper on what has been taught", to: "/assessment", tint: "sun" },
  { emoji: "📊", title: "Results", text: "Scores, levels and every past assessment", to: "/students?view=results", tint: "mint" },
  { emoji: "🎯", title: "Areas of Improvement", text: "Where each child should practise next", to: "/students?view=improvement", tint: "peach" },
  { emoji: "📄", title: "Progress Report", text: "A parent-friendly report to download or print", to: "/students?view=report", tint: "lilac" }
];

const cards = [
  {
    title: "AI Worksheet Generator",
    description: "Create print-ready worksheets in seconds.",
    path: "/worksheet",
    icon: <FileText size={22} />
  },
  {
    title: "AI Lesson Plan Generator",
    description: "Outline engaging lessons with clear structure.",
    path: "/lesson",
    icon: <BookOpen size={22} />
  },
  {
    title: "AI Quiz Generator",
    description: "Assess understanding with ready-made questions.",
    path: "/quiz",
    icon: <HelpCircle size={22} />
  },
  {
    title: "AI Classroom Activity Generator",
    description: "Spark curiosity with fresh classroom ideas.",
    path: "/activities",
    icon: <Sparkles size={22} />
  }
];

const quickStats = [
  { label: "Resources generated", value: "240+" },
  { label: "Teachers supported", value: "1.2k" },
  { label: "Avg. save time", value: "8 hrs" }
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [selected, setSelected] = useState("worksheet");
  const [showCustomize, setShowCustomize] = useState(false);
  const [language, setLanguageState] = useState(() => getLanguage());

  const [academicYear, setAcademicYear] = useState(() => currentAcademicYear());
  const [className, setClassName] = useState("UKG");
  const [subject, setSubject] = useState("English");
  const [period, setPeriod] = useState(() => currentMonthName());

  const years = useMemo(() => academicYearOptions(), []);
  const firstName = (profile?.full_name || "").trim().split(/\s+/)[0];

  const handleSelectLanguage = (lang) => {
    setLanguage(lang);
    setLanguageState(lang);
  };

  const changeClass = (value) => {
    setClassName(value);
    setSubject((current) => (subjectMap[value].includes(current) ? current : subjectMap[value][0]));
  };

  const checkChild = (e) => {
    e.preventDefault();
    const query = new URLSearchParams({ year: academicYear, class: className, subject, month: period });
    navigate(`/assessment?${query.toString()}`);
  };

  const featureCopy = useMemo(() => ({
    worksheet: {
      title: "Worksheet Generator",
      text: "Turn any topic into a polished practice sheet with warm-up, tasks, and reflection prompts."
    },
    lesson: {
      title: "Lesson Builder",
      text: "Create complete lesson plans with objectives, guided practice, and closing activities."
    },
    quiz: {
      title: "Quiz Maker",
      text: "Build short assessments that align with your class goals and pace."
    },
    activity: {
      title: "Activity Studio",
      text: "Generate interactive activities that make learning feel energetic and collaborative."
    }
  }), []);

  const activeFeature = featureCopy[selected];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Dashboard" />

        <div className="content-area">
          <section className="child-check">
            <div className="child-check-copy">
              <p className="eyebrow">{firstName ? `Hello, ${firstName}` : "Hello"} <span aria-hidden="true">👋</span></p>
              <h1>Is my child&apos;s knowledge as expected?</h1>
              <p className="hero-text">
                Pick the year, class, subject and month. We load that month&apos;s syllabus and check your child only on what has already been taught.
              </p>
            </div>
            <form className="child-check-form" onSubmit={checkChild}>
              <div>
                <label htmlFor="cc-year">Academic year</label>
                <select id="cc-year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                  {years.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cc-class">Class</label>
                <select id="cc-class" value={className} onChange={(e) => changeClass(e.target.value)}>
                  {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cc-subject">Subject</label>
                <select id="cc-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  {(subjectMap[className] || []).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cc-month">Month</label>
                <select id="cc-month" value={period} onChange={(e) => setPeriod(e.target.value)}>
                  <optgroup label="Month">
                    {ACADEMIC_MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
                  </optgroup>
                  <optgroup label="Whole term (end-term)">
                    {TERMS.map((term) => <option key={term.id} value={`term:${term.id}`}>{termLabel(term)}</option>)}
                  </optgroup>
                </select>
              </div>
              <button type="submit" className="primary-btn child-check-go">
                Check my child <ArrowRight size={16} />
              </button>
            </form>
          </section>

          <section className="hub-grid" aria-label="Child assessment">
            {HUB_CARDS.map((card) => (
              <Link key={card.title} to={card.to} className={`hub-card hub-${card.tint}`}>
                <span className="hub-emoji" aria-hidden="true">{card.emoji}</span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <span className="hub-open">Open <ArrowRight size={15} /></span>
              </Link>
            ))}
          </section>

          <h2 className="section-heading hub-tools-heading">Teaching tools</h2>

          <section className="hero-card hero-card-rich">
            <div className="hero-copy">
              <p className="eyebrow">Adiuvaret AI Classroom Generator</p>
              <h1>Design impactful lessons in minutes.</h1>
              <p className="hero-text">
                Empower your classroom with instantly generated worksheets, lesson plans, quizzes, and activities tailored to your students.
              </p>
              <div className="hero-actions">
                <Link to="/worksheet" className="primary-btn">
                  <PencilRuler size={16} /> Start creating
                </Link>
                <button type="button" className="secondary-btn" onClick={() => setShowCustomize(true)}>
                  <Languages size={16} /> Customize experience
                </button>
              </div>
            </div>
            <div className="hero-orb" />
          </section>

          <section className="stats-grid">
            {quickStats.map((stat) => (
              <div key={stat.label} className="stat-card">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </section>

          <section className="card-grid">
            {cards.map((card) => (
              <Link key={card.path} to={card.path} className="resource-card">
                <div className="resource-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <span className="resource-link">
                  Open tool <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </section>

          <section className="feature-panel">
            <div className="feature-tabs">
              {Object.keys(featureCopy).map((key) => (
                <button
                  key={key}
                  className={`tab-btn ${selected === key ? "active" : ""}`}
                  onClick={() => setSelected(key)}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
            <div className="feature-content">
              <h3>{activeFeature.title}</h3>
              <p>{activeFeature.text}</p>
            </div>
          </section>
        </div>
      </main>

      {showCustomize ? createPortal(
        <div className="profile-modal-backdrop" onClick={() => setShowCustomize(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Customize Experience</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowCustomize(false)}>×</button>
            </div>
            <div className="profile-modal-body">
              <p>Choose the language the AI should write your generated resources in. This applies to every worksheet, lesson plan, quiz, activity, and exam paper you generate from now on.</p>
              <div className="field-row">
                <label>Generate in</label>
                <div className="feature-tabs">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={`tab-btn ${language === lang ? "active" : ""}`}
                      onClick={() => handleSelectLanguage(lang)}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
};

export default Dashboard;