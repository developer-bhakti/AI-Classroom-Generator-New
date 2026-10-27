import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Circle, Eye, EyeOff, ShieldCheck } from "lucide-react";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { useAuth } from "../context/useAuth";
import { supabase } from "../Services/supabaseClient";
import { describeAuthError } from "../Services/authErrors";
import { logActivity } from "../Services/activityLog";
import { validatePasswordChange } from "../Services/passwordRules";

const Password = () => {
  const { user, profile, isAdmin, passwordRecovery, endPasswordRecovery } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const email = profile?.email || user?.email || "";
  // Someone who came in through a reset link has no old password to give; everyone else must prove theirs.
  const requireCurrent = !passwordRecovery;
  const check = useMemo(() => validatePasswordChange({ current, next, confirm, requireCurrent }), [current, next, confirm, requireCurrent]);
  const inputType = showPasswords ? "text" : "password";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!check.ok) {
      setMessage({ type: "error", text: check.error });
      return;
    }

    setSaving(true);

    if (requireCurrent) {
      // Signing in again is how Supabase checks a password; it replaces this session with an identical one.
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
      if (verifyError) {
        setSaving(false);
        const wrong = verifyError.status === 400 || /invalid login credentials/i.test(verifyError.message || "");
        setMessage({ type: "error", text: wrong ? "Your current password is not correct." : describeAuthError(verifyError) });
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setSaving(false);

    if (error) {
      setMessage({ type: "error", text: describeAuthError(error) });
      return;
    }

    // Nothing is kept: the fields are emptied and only the fact that it changed is logged.
    logActivity(user.id, "password_changed", { via: passwordRecovery ? "reset_link" : "password_page" });
    setCurrent("");
    setNext("");
    setConfirm("");
    setShowPasswords(false);
    endPasswordRecovery();
    setMessage({ type: "success", text: "Your password has been updated. Use the new one the next time you sign in." });
  };

  const toggle = (
    <button
      type="button"
      className="password-toggle"
      aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
      onClick={() => setShowPasswords((prev) => !prev)}
    >
      {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Password Management" />
        <div className="content-area">
          <section className="page-intro">
            <div className="page-intro-badge">Account security</div>
            <h3>Password Management</h3>
            <p>Keep your account safe. Your password is never stored or shown by this app, and it is sent only to the sign-in service. Looking for your name or email instead? <Link to="/profile" className="link-text">Open Profile</Link></p>
          </section>

          <div className="settings-grid">
            <div className="panel-card settings-card">
              <div className="settings-card-header">
                <ShieldCheck size={20} />
                <div>
                  <h3>Change your password</h3>
                  <p>{email ? `Signed in as ${email}.` : "Choose a new password for your account."}</p>
                </div>
              </div>

              {passwordRecovery ? (
                <p className="inline-success"><Check size={14} /> You opened a password reset link, so you do not need your old password. Choose a new one below.</p>
              ) : null}

              <form onSubmit={handleSubmit} autoComplete="on">
                {requireCurrent ? (
                  <div className="field-row">
                    <label htmlFor="current-password">Current password</label>
                    <div className="password-field">
                      <input
                        id="current-password"
                        type={inputType}
                        value={current}
                        onChange={(e) => setCurrent(e.target.value)}
                        placeholder="Current password"
                        autoComplete="current-password"
                      />
                      {toggle}
                    </div>
                  </div>
                ) : null}

                <div className="field-row">
                  <label htmlFor="new-password">New password</label>
                  <div className="password-field">
                    <input
                      id="new-password"
                      type={inputType}
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                      placeholder="New password"
                      autoComplete="new-password"
                    />
                    {requireCurrent ? null : toggle}
                  </div>
                </div>

                <div className="field-row">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    type={inputType}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                </div>

                <ul className="password-rules" aria-label="Password requirements">
                  {check.rules.map((rule) => (
                    <li key={rule.id} className={rule.met ? "met" : ""}>
                      {rule.met ? <Check size={14} /> : <Circle size={14} />} {rule.label}
                    </li>
                  ))}
                </ul>

                {message ? (
                  <p className={message.type === "error" ? "inline-error" : "inline-success"} role={message.type === "error" ? "alert" : "status"}>
                    {message.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} />} {message.text}
                  </p>
                ) : null}

                <div className="form-actions">
                  <button type="submit" className="primary-btn" disabled={saving || !next}>
                    {saving ? "Updating..." : "Update password"}
                  </button>
                </div>
              </form>
            </div>

            <div className="panel-card settings-card">
              <div className="settings-card-header">
                <ShieldCheck size={20} />
                <div>
                  <h3>{isAdmin ? "Resetting someone else's password" : "Forgot your password?"}</h3>
                  <p>
                    {isAdmin
                      ? "You can set a new password for any user, or email them a reset link so they choose their own."
                      : "Ask your school administrator to email you a reset link, or contact our team at info@adiuvaret.in."}
                  </p>
                </div>
              </div>
              {isAdmin ? (
                <>
                  <p className="content-row-meta">Open the Admin Dashboard, choose <strong>Edit</strong> on the person's row, then type a new password in the Password box, or use <strong>Send reset link</strong>.</p>
                  <Link to="/admin" className="secondary-btn full">Open Admin Dashboard</Link>
                </>
              ) : (
                <p className="content-row-meta">The link opens this page and lets you choose a new password without knowing the old one.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Password;
