import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { Eye, EyeOff, Check, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { supabase } from "../Services/supabaseClient";
import { describeAuthError } from "../Services/authErrors";

const Profile = () => {
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const [draftName, setDraftName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  useEffect(() => {
    if (profile?.full_name) setDraftName(profile.full_name);
  }, [profile?.full_name]);

  const email = profile?.email || user?.email || "";
  const name = profile?.full_name || email.split("@")[0] || "Teacher";
  const initials = (draftName || name || "T").trim().slice(0, 1).toUpperCase();

  const handleSaveName = async (e) => {
    e.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === profile?.full_name) return;

    setSavingName(true);
    setNameError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: trimmed })
      .eq("id", user.id);
    setSavingName(false);

    if (error) {
      setNameError(describeAuthError(error));
      return;
    }

    await refreshProfile();
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "Your new password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordMessage({ type: "error", text: describeAuthError(error) });
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage({ type: "success", text: "Your password has been updated." });
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

          <div className="settings-grid">
            <div className="panel-card settings-card">
              <div className="profile-header-row">
                <div className="profile-avatar">{initials}</div>
                <div>
                  <h3>{name}</h3>
                  <p className="content-row-meta">{email}</p>
                </div>
              </div>

              <form onSubmit={handleSaveName}>
                <div className="field-row">
                  <label>Display name</label>
                  <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Your name" />
                </div>

                <div className="field-row">
                  <label>Email</label>
                  <div className="field-static">{email}</div>
                </div>

                <div className="field-row">
                  <label>Role</label>
                  <div className="field-static">
                    <span className={`role-pill ${isAdmin ? "admin" : ""}`}>{isAdmin ? "Admin" : "Educator"}</span>
                  </div>
                </div>

                {nameError ? <p className="inline-error"><AlertTriangle size={14} /> {nameError}</p> : null}

                <div className="form-actions">
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={savingName || !draftName.trim() || draftName.trim() === profile?.full_name}
                  >
                    {nameSaved ? <><Check size={16} /> Saved</> : savingName ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </div>

            <div className="panel-card settings-card">
              <div className="settings-card-header">
                <div>
                  <h3>Change password</h3>
                  <p>Pick something at least 6 characters long.</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword}>
                <div className="field-row">
                  <label>New password</label>
                  <div className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                    />
                    <button type="button" className="password-toggle" onClick={() => setShowPassword((prev) => !prev)}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="field-row">
                  <label>Confirm new password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>

                {passwordMessage ? (
                  <p className={passwordMessage.type === "error" ? "inline-error" : "inline-success"}>
                    {passwordMessage.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} />} {passwordMessage.text}
                  </p>
                ) : null}

                <div className="form-actions">
                  <button type="submit" className="primary-btn" disabled={savingPassword || !newPassword}>
                    {savingPassword ? "Updating..." : "Update password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
