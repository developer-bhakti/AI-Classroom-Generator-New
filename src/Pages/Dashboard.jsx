import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { FileText, BookOpen, HelpCircle, Sparkles, ArrowRight, PencilRuler } from "lucide-react";

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
  const [selected, setSelected] = useState("worksheet");

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
                <Link to="/settings" className="secondary-btn">
                  Customize experience
                </Link>
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
    </div>
  );
};

export default Dashboard;
