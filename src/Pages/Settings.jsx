import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Palette, ShieldCheck, Sparkles, UserCircle2 } from "lucide-react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { useAuth } from "../context/useAuth";

const Settings = () => {
  const { user, profile } = useAuth();
  const email = profile?.email || user?.email || "";
  const name = profile?.full_name || email.split("@")[0] || "Teacher";
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(document.documentElement.getAttribute("data-theme") === "dark");
  const [aiTips, setAiTips] = useState(true);

  const toggleTheme = () => {
    const nextTheme = darkMode ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem("adiuvaret-theme", nextTheme);
    setDarkMode(!darkMode);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Settings" />
        <div className="content-area">
          <section className="page-intro">
            <div className="page-intro-badge">Workspace preferences</div>
            <h3>Personalize your teaching flow</h3>
            <p>Shape the environment around your routine with calm defaults, helpful reminders, and smart AI suggestions.</p>
          </section>

          <div className="settings-grid">
            <div className="panel-card settings-card">
              <div className="settings-card-header">
                <UserCircle2 size={20} />
                <div>
                  <h3>Profile</h3>
                  <p>Keep your account details aligned with your classroom identity.</p>
                </div>
              </div>

              <div className="settings-info-row">
                <span>Name</span>
                <strong>{name}</strong>
              </div>
              <div className="settings-info-row">
                <span>Email</span>
                <strong>{email}</strong>
              </div>
              <Link to="/profile" className="secondary-btn full">Manage profile</Link>
            </div>

            <div className="panel-card settings-card">
              <div className="settings-card-header">
                <Palette size={20} />
                <div>
                  <h3>Appearance</h3>
                  <p>Choose a visual style that fits your teaching time and mood.</p>
                </div>
              </div>

              <label className="switch-row">
                <span>
                  <strong>Dark mode</strong>
                  <small>Reduce glare during late-night planning.</small>
                </span>
                <input type="checkbox" checked={darkMode} onChange={toggleTheme} />
              </label>

              <label className="switch-row">
                <span>
                  <strong>Compact layout</strong>
                  <small>Keep the workspace focused and minimal.</small>
                </span>
                <input type="checkbox" defaultChecked />
              </label>
            </div>

            <div className="panel-card settings-card">
              <div className="settings-card-header">
                <Bell size={20} />
                <div>
                  <h3>Notifications</h3>
                  <p>Stay updated without feeling overwhelmed.</p>
                </div>
              </div>

              <label className="switch-row">
                <span>
                  <strong>Weekly digest</strong>
                  <small>Receive summaries of recent classroom activity.</small>
                </span>
                <input type="checkbox" checked={notifications} onChange={() => setNotifications(!notifications)} />
              </label>
            </div>

            <div className="panel-card settings-card">
              <div className="settings-card-header">
                <Sparkles size={20} />
                <div>
                  <h3>AI assistance</h3>
                  <p>Control how much guidance the assistant offers while you create.</p>
                </div>
              </div>

              <label className="switch-row">
                <span>
                  <strong>Smart suggestions</strong>
                  <small>Helpful prompts and fresh ideas while you work.</small>
                </span>
                <input type="checkbox" checked={aiTips} onChange={() => setAiTips(!aiTips)} />
              </label>

              <div className="settings-badge-row">
                <span className="feature-badge"><ShieldCheck size={14} /> Secure workspace</span>
                <span className="feature-badge"><Sparkles size={14} /> Adaptive support</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;