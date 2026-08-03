import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { Eye, EyeOff, Check } from "lucide-react";

const Profile = () => {
  const [name, setName] = useState(() => localStorage.getItem("adiuvaret-name") || "Teacher");
  const [draftName, setDraftName] = useState(name);
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  const email = localStorage.getItem("adiuvaret-user") || "adiuvaret@gmail.com";
  const password = localStorage.getItem("adiuvaret-password") || "adiuvaret@123";
  const initials = (draftName || "T").trim().slice(0, 1).toUpperCase();

  const handleSave = (e) => {
    e.preventDefault();
    const trimmed = draftName.trim() || "Teacher";
    localStorage.setItem("adiuvaret-name", trimmed);
    setName(trimmed);
    setDraftName(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Profile" />
        <div className="content-area">
          <section className="page-intro">
            <div className="page-intro-badge">Your identity</div>
            <h3>Manage your classroom identity</h3>
            <p>This is how you appear across Adiuvaret. Looking for themes or notifications instead? <Link to="/settings" className="link-text">Open Settings</Link></p>
          </section>

          <div className="panel-card settings-card" style={{ maxWidth: 520 }}>
            <div className="profile-header-row">
              <div className="profile-avatar">{initials}</div>
              <div>
                <h3>{name}</h3>
                <p className="content-row-meta">{email}</p>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className="field-row">
                <label>Display name</label>
                <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Your name" />
              </div>

              <div className="field-row">
                <label>Email</label>
                <div className="field-static">{email}</div>
              </div>

              <div className="field-row">
                <label>Password</label>
                <button type="button" className="settings-password-row field-static" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }} onClick={() => setShowPassword((prev) => !prev)}>
                  <span>{showPassword ? password : "••••••••"}</span>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="form-actions">
                <button type="submit" className="primary-btn" disabled={draftName.trim() === name && !saved}>
                  {saved ? <><Check size={16} /> Saved</> : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
