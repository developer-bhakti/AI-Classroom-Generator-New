import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Dices, Eye, EyeOff, KeyRound } from "lucide-react";
import { applyUserEdits, getPasswordActivity, sendPasswordResetLink } from "../../Services/adminService";
import { addMonths, fromDateInput, toDateInput } from "../../Services/dateInputs";
import { formatINR } from "../../Services/subscriptionService";
import { generatePassword, MIN_PASSWORD_LENGTH, summarizePasswordActivity } from "../../Services/passwordRules";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const when = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * One window for everything about a user: login email, name, password, role, plan and end date. Only what
 * actually changed is sent. The current password cannot be shown (Supabase keeps only a one-way hash), so
 * the password field is for a NEW one and is left empty to keep the current one.
 */
const EditUserForm = ({ user, plans, isSelf, onApplied, onCancel, onOpenDetails }) => {
  const sub = user.subscription;
  const subEnd = sub ? toDateInput(sub.end_date) : "";

  const [name, setName] = useState(user.full_name || "");
  const [email, setEmail] = useState(user.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(user.role || "user");
  const [planId, setPlanId] = useState(sub?.plan_id || "");
  const [endDate, setEndDate] = useState(subEnd);

  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState([]); // what could not be saved
  const [note, setNote] = useState(null); // the reset-link result
  const [history, setHistory] = useState(null);
  const [justSet, setJustSet] = useState(null); // the password just saved, shown once so it can be passed on
  const [copied, setCopied] = useState("");
  const onceRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(summarizePasswordActivity(await getPasswordActivity(user.id)));
    } catch {
      setHistory({ lastChange: null, unavailable: true });
    }
  }, [user.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // The window scrolls; bring the one-time password into view so it is not missed.
  useEffect(() => { if (justSet) onceRef.current?.scrollIntoView({ block: "nearest" }); }, [justSet]);

  const cleanName = name.trim().replace(/\s+/g, " ");
  const cleanEmail = email.trim().toLowerCase();

  // What differs from what is saved. After a partial save the parent passes the refreshed user, so
  // anything that did save drops out of here and anything that failed is still listed.
  const changes = useMemo(() => {
    const profile = {};
    if (cleanName !== (user.full_name || "")) profile.fullName = cleanName;
    if (cleanEmail !== String(user.email || "").toLowerCase()) profile.email = cleanEmail;
    if (role !== user.role) profile.role = role;

    const plan = plans.find((item) => item.id === planId);
    const subscriptionChanged = Boolean(plan && endDate && (planId !== (sub?.plan_id || "") || endDate !== subEnd));

    return {
      profile,
      subscription: subscriptionChanged ? { planId: plan.id, planName: plan.name, endDate: fromDateInput(endDate) } : null,
      password: password || null
    };
  }, [cleanName, cleanEmail, role, planId, endDate, password, plans, user, sub, subEnd]);

  const problem =
    !cleanName ? "Enter a name."
      : !EMAIL.test(cleanEmail) ? "Enter a valid email address."
        : password && password.length < MIN_PASSWORD_LENGTH ? `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`
          : planId && !endDate ? "Choose the subscription end date."
            : endDate && !planId ? "Choose a plan for that end date."
              : null;

  const hasChanges = Object.keys(changes.profile).length > 0 || Boolean(changes.subscription) || Boolean(changes.password);
  const canSave = !busy && hasChanges && !problem;

  const choosePlan = (nextId) => {
    setPlanId(nextId);
    const plan = plans.find((item) => item.id === nextId);
    if (!plan) return;
    // A new plan adds its length on top of any time that is left.
    const base = sub && new Date(sub.end_date) > new Date() ? new Date(sub.end_date) : new Date();
    setEndDate(toDateInput(addMonths(base, plan.duration_months)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    if (changes.profile.email && !window.confirm(`Change the login email from ${user.email} to ${cleanEmail}? They must sign in with the new email from now on.`)) return;
    if (changes.password && !window.confirm(`Set a new password for ${user.full_name || user.email}? Their old password stops working right away.`)) return;

    setBusy(true);
    setProblems([]);
    setNote(null);
    const sentPassword = changes.password;
    const result = await applyUserEdits({ user, profile: changes.profile, subscription: changes.subscription, password: sentPassword });
    setBusy(false);

    const passwordSaved = result.saved.includes("password");
    if (result.failed.length === 0 && !passwordSaved) {
      onApplied(result);
      return;
    }
    setProblems(result.failed);
    if (result.saved.length > 0) onApplied(result, { keepOpen: true });
    if (passwordSaved) {
      // The window stays open so the admin can copy the new password: it lives only in this window's memory.
      setJustSet(sentPassword);
      setPassword("");
      setShowPassword(false);
      loadHistory();
    }
  };

  const copyText = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      // clipboard blocked: the text is still on screen to select
    }
  };

  const handleReset = async () => {
    setBusy(true);
    setNote(null);
    try {
      await sendPasswordResetLink({ userId: user.id, email: user.email });
      setNote({ type: "success", text: `A reset link was emailed to ${user.email}.` });
      loadHistory();
    } catch (err) {
      setNote({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="field-row">
        <label htmlFor="edit-user-email">Username (email)</label>
        <input id="edit-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </div>

      <div className="field-row">
        <label htmlFor="edit-user-name">Name</label>
        <input id="edit-user-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="off" />
      </div>

      <div className="field-row">
        <label htmlFor="edit-user-password">Password</label>
        <div className="password-field">
          <input
            id="edit-user-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty to keep the current password"
            autoComplete="new-password"
          />
          <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((prev) => !prev)}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="edit-password-tools">
          <button type="button" className="text-btn" disabled={busy} onClick={() => { setPassword(generatePassword()); setShowPassword(true); setJustSet(null); }}>
            <Dices size={14} /> Generate
          </button>
          {password ? (
            <button type="button" className="text-btn" disabled={busy} onClick={() => copyText("typed", password)}>
              <Copy size={14} /> {copied === "typed" ? "Copied" : "Copy"}
            </button>
          ) : null}
          <button type="button" className="text-btn" disabled={busy} onClick={handleReset}>
            <KeyRound size={14} /> Send reset link
          </button>
        </div>
        <p className="content-row-meta">
          {history?.lastChange ? `Last changed ${when(history.lastChange.at)} · ${history.lastChange.how}. ` : history && !history.unavailable ? "No password change recorded yet. " : ""}
          The current password can&apos;t be shown: it is stored scrambled, so nobody can read it back.
        </p>
        {note ? (
          <p className={note.type === "error" ? "inline-error" : "inline-success"}>
            {note.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} />} {note.text}
          </p>
        ) : null}
      </div>

      <div className="field-row">
        <label htmlFor="edit-user-role">Account type</label>
        <select id="edit-user-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
          <option value="user">User (teacher)</option>
          <option value="admin">Admin</option>
        </select>
        {isSelf ? <p className="content-row-meta">You can&apos;t change your own account type.</p> : null}
      </div>

      <div className="field-row">
        <label htmlFor="edit-user-plan">Plan (price)</label>
        <select id="edit-user-plan" value={planId} onChange={(e) => choosePlan(e.target.value)}>
          {sub ? null : <option value="">No plan</option>}
          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — {formatINR(plan.price_inr)}</option>)}
        </select>
      </div>

      <div className="field-row">
        <label htmlFor="edit-user-end">Subscription end date</label>
        <input id="edit-user-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      {justSet ? (
        <div className="password-once" role="status" ref={onceRef}>
          <p><Check size={14} /> Password updated. Give it to {user.full_name || user.email} now: it is shown only this once and is not stored anywhere.</p>
          <div className="password-once-row">
            <code>{justSet}</code>
            <button type="button" className="text-btn" onClick={() => copyText("once", justSet)}>{copied === "once" ? "Copied" : "Copy"}</button>
          </div>
        </div>
      ) : null}

      {problem && hasChanges ? <p className="inline-error" role="alert"><AlertTriangle size={14} /> {problem}</p> : null}
      {problems.map((item) => (
        <p key={item.label} className="inline-error" role="alert"><AlertTriangle size={14} /> Couldn&apos;t save the {item.label}: {item.message}</p>
      ))}

      <div className="edit-user-actions">
        <button type="button" className="secondary-btn" onClick={onCancel} disabled={busy}>{justSet ? "Close" : "Cancel"}</button>
        <button type="submit" className="primary-btn" disabled={!canSave}>{busy ? "Saving..." : "Update"}</button>
      </div>

      {onOpenDetails ? (
        <button type="button" className="text-btn edit-user-more" onClick={onOpenDetails}>Pause or cancel the subscription, or see activity</button>
      ) : null}
    </form>
  );
};

export default EditUserForm;
