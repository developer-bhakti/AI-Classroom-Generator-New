import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import {
  Search, Users, CreditCard, FileText, IndianRupee, X, AlertTriangle,
  Pause, Play, Ban, Trash2, Check
} from "lucide-react";
import { supabase } from "../Services/supabaseClient";
import { useAuth } from "../context/useAuth";
import { useSubscription } from "../context/useSubscription";
import {
  formatINR,
  isSubscriptionActive,
  describeSubscriptionStatus,
  statusPillClass,
  getPlans
} from "../Services/subscriptionService";
import {
  grantSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  deleteSubscription
} from "../Services/adminService";
import { ACTIVITY_LABELS } from "../Services/activityLog";
import { RESOURCE_TYPES } from "../Services/contentStore";

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

const toDateInput = (date) => {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};

const fromDateInput = (value) => {
  const d = new Date(`${value}T23:59:59`);
  return d.toISOString();
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const Admin = () => {
  const { user: currentUser } = useAuth();
  const { refresh: refreshOwnSubscription } = useSubscription();

  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [contentCount, setContentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  const [detailUser, setDetailUser] = useState(null);
  const [detail, setDetail] = useState({ activity: [], content: [], loading: false });

  const [grantPlanId, setGrantPlanId] = useState("");
  const [grantEndDate, setGrantEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const loadAll = useCallback(async () => {
    const [profilesRes, subsRes, paymentsRes, contentRes] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("id, user_id, plan_id, status, start_date, end_date, paused_at, plans(name, code)"),
      supabase.from("payments").select("amount_inr, status, created_at").eq("status", "paid"),
      supabase.from("generated_content").select("id", { count: "exact", head: true })
    ]);

    if (profilesRes.error) {
      setError(profilesRes.error.message);
      return null;
    }

    const subsByUser = new Map((subsRes.data || []).map((row) => [row.user_id, row]));
    const nextUsers = (profilesRes.data || []).map((profile) => ({
      ...profile,
      subscription: subsByUser.get(profile.id) || null
    }));

    setUsers(nextUsers);
    setPayments(paymentsRes.data || []);
    setContentCount(contentRes.count || 0);
    return nextUsers;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [, planData] = await Promise.all([loadAll(), getPlans().catch(() => [])]);
      if (!active) return;
      setPlans(planData);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [loadAll]);

  const stats = useMemo(() => {
    const activeSubs = users.filter((u) => isSubscriptionActive(u.subscription)).length;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const revenueThisMonth = payments
      .filter((p) => new Date(p.created_at) >= monthStart)
      .reduce((sum, p) => sum + Number(p.amount_inr), 0);
    return { activeSubs, revenueThisMonth };
  }, [users, payments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.full_name || ""} ${u.email} ${u.role}`.toLowerCase().includes(q));
  }, [users, query]);

  // Default the grant form to "this plan's length, added on top of any time left".
  const seedGrantForm = useCallback((targetUser, planId) => {
    const plan = plans.find((p) => p.id === planId) || plans[0];
    if (!plan) return;
    const sub = targetUser?.subscription;
    const base = sub && new Date(sub.end_date) > new Date() ? new Date(sub.end_date) : new Date();
    setGrantPlanId(plan.id);
    setGrantEndDate(toDateInput(addMonths(base, plan.duration_months)));
  }, [plans]);

  const openDetail = async (targetUser) => {
    setDetailUser(targetUser);
    setActionMessage(null);
    seedGrantForm(targetUser, targetUser.subscription?.plan_id);
    setDetail({ activity: [], content: [], loading: true });

    const [activityRes, contentRes] = await Promise.all([
      supabase.from("activity_log").select("id, action, metadata, created_at")
        .eq("user_id", targetUser.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("generated_content").select("id, type, title, created_at")
        .eq("user_id", targetUser.id).order("created_at", { ascending: false }).limit(20)
    ]);

    setDetail({ activity: activityRes.data || [], content: contentRes.data || [], loading: false });
  };

  // Re-reads the list and re-points the open modal at the refreshed row.
  const afterMutation = async (message) => {
    const nextUsers = await loadAll();
    if (nextUsers && detailUser) {
      setDetailUser(nextUsers.find((u) => u.id === detailUser.id) || null);
    }
    if (detailUser?.id === currentUser?.id) await refreshOwnSubscription();
    setActionMessage({ type: "success", text: message });
  };

  const runAction = async (fn, successMessage) => {
    setBusy(true);
    setActionMessage(null);
    try {
      await fn();
      await afterMutation(successMessage);
    } catch (err) {
      setActionMessage({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleGrant = () => {
    const plan = plans.find((p) => p.id === grantPlanId);
    if (!plan || !grantEndDate) return;
    runAction(
      () => grantSubscription({
        userId: detailUser.id,
        planId: plan.id,
        endDate: fromDateInput(grantEndDate),
        planName: plan.name
      }),
      `${plan.name} active until ${formatDate(fromDateInput(grantEndDate))}.`
    );
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete ${detailUser.full_name || detailUser.email}'s subscription entirely? This cannot be undone.`)) return;
    runAction(() => deleteSubscription(detailUser.subscription), "Subscription deleted.");
  };

  const sub = detailUser?.subscription;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Admin Dashboard" />
        <div className="content-area">
          <section className="page-intro">
            <div className="page-intro-badge">Administration</div>
            <h3>Everyone using Adiuvaret</h3>
            <p>Accounts, subscription status, revenue, and what each teacher has been generating.</p>
          </section>

          {error ? (
            <div className="error-state"><p><AlertTriangle size={16} /> {error}</p></div>
          ) : loading ? (
            <div className="panel-card">
              <div className="loading-state">
                <div className="spinner" />
                <p>Loading admin data...</p>
              </div>
            </div>
          ) : (
            <>
              <section className="stats-grid admin-stats-grid">
                <div className="stat-card">
                  <div className="stat-card-icon"><Users size={18} /></div>
                  <strong>{users.length}</strong>
                  <span>Total users</span>
                </div>
                <div className="stat-card">
                  <div className="stat-card-icon"><CreditCard size={18} /></div>
                  <strong>{stats.activeSubs}</strong>
                  <span>Active subscriptions</span>
                </div>
                <div className="stat-card">
                  <div className="stat-card-icon"><FileText size={18} /></div>
                  <strong>{contentCount}</strong>
                  <span>Resources generated</span>
                </div>
                <div className="stat-card">
                  <div className="stat-card-icon"><IndianRupee size={18} /></div>
                  <strong>{formatINR(stats.revenueThisMonth)}</strong>
                  <span>Revenue this month</span>
                </div>
              </section>

              <div className="toolbar-row">
                <h3 className="section-heading" style={{ margin: 0 }}>Users ({filtered.length})</h3>
                <div className="toolbar-search">
                  <Search size={16} />
                  <input placeholder="Search by name, email, or role" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>

              <div className="panel-card data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Expires</th>
                      <th>Joined</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Name">{row.full_name || "—"}</td>
                        <td data-label="Email" className="cell-muted">{row.email}</td>
                        <td data-label="Role">
                          <span className={`role-pill ${row.role === "admin" ? "admin" : ""}`}>{row.role}</span>
                        </td>
                        <td data-label="Plan">{row.subscription?.plans?.name || "—"}</td>
                        <td data-label="Status">
                          <span className={`status-pill ${statusPillClass(row.subscription)}`}>
                            {describeSubscriptionStatus(row.subscription)}
                          </span>
                        </td>
                        <td data-label="Expires" className="cell-muted">{formatDate(row.subscription?.end_date)}</td>
                        <td data-label="Joined" className="cell-muted">{formatDate(row.created_at)}</td>
                        <td data-label="">
                          <button type="button" className="text-btn" onClick={() => openDetail(row)}>Manage</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 ? <p className="table-empty">No users match “{query}”.</p> : null}
              </div>
            </>
          )}
        </div>
      </main>

      {detailUser ? createPortal(
        <div className="profile-modal-backdrop" onClick={() => setDetailUser(null)}>
          <div className="profile-modal content-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>{detailUser.full_name || detailUser.email}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setDetailUser(null)}><X size={18} /></button>
            </div>
            <div className="profile-modal-body">
              <p className="content-row-meta">{detailUser.email}</p>

              <div className="admin-sub-panel">
                <div className="admin-sub-head">
                  <h4>Subscription</h4>
                  <span className={`status-pill ${statusPillClass(sub)}`}>{describeSubscriptionStatus(sub)}</span>
                </div>

                <p className="content-row-meta">
                  {sub
                    ? `${sub.plans?.name || "Plan"} • ${sub.status === "paused" ? "Paused on" : "Expires"} ${formatDate(sub.status === "paused" ? sub.paused_at : sub.end_date)}`
                    : "This user has never had a subscription."}
                </p>

                {actionMessage ? (
                  <p className={actionMessage.type === "error" ? "inline-error" : "inline-success"}>
                    {actionMessage.type === "error" ? <AlertTriangle size={14} /> : <Check size={14} />} {actionMessage.text}
                  </p>
                ) : null}

                <div className="admin-grant-row">
                  <div className="field-row">
                    <label>Plan</label>
                    <select
                      value={grantPlanId}
                      onChange={(e) => {
                        setGrantPlanId(e.target.value);
                        seedGrantForm(detailUser, e.target.value);
                      }}
                    >
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name} — {formatINR(plan.price_inr)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-row">
                    <label>Active until</label>
                    <input type="date" value={grantEndDate} onChange={(e) => setGrantEndDate(e.target.value)} />
                  </div>
                </div>

                <button type="button" className="primary-btn full" disabled={busy || !grantPlanId} onClick={handleGrant}>
                  <Check size={16} /> {sub ? "Update subscription" : "Give subscription"}
                </button>

                {sub ? (
                  <div className="admin-action-row">
                    {sub.status === "paused" ? (
                      <button type="button" className="secondary-btn" disabled={busy}
                        onClick={() => runAction(() => resumeSubscription(sub), "Subscription resumed — paused days were added back.")}>
                        <Play size={15} /> Resume
                      </button>
                    ) : (
                      <button type="button" className="secondary-btn" disabled={busy || sub.status === "cancelled"}
                        onClick={() => runAction(() => pauseSubscription(sub), "Subscription paused.")}>
                        <Pause size={15} /> Pause
                      </button>
                    )}
                    <button type="button" className="secondary-btn" disabled={busy || sub.status === "cancelled"}
                      onClick={() => runAction(() => cancelSubscription(sub), "Subscription cancelled.")}>
                      <Ban size={15} /> Cancel
                    </button>
                    <button type="button" className="secondary-btn danger-btn" disabled={busy} onClick={handleDelete}>
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                ) : null}
              </div>

              {detail.loading ? (
                <div className="loading-state"><div className="spinner" /><p>Loading activity...</p></div>
              ) : (
                <>
                  <div className="output-section">
                    <h4>Recent activity</h4>
                    {detail.activity.length === 0 ? <p className="content-row-meta">No activity recorded yet.</p> : (
                      <ul>
                        {detail.activity.map((row) => (
                          <li key={row.id}>
                            {ACTIVITY_LABELS[row.action] || row.action}
                            {row.metadata?.title ? ` — ${row.metadata.title}` : ""}
                            {" • "}
                            <span className="cell-muted">{formatDateTime(row.created_at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="output-section">
                    <h4>Generated resources</h4>
                    {detail.content.length === 0 ? <p className="content-row-meta">Nothing generated yet.</p> : (
                      <ul>
                        {detail.content.map((row) => (
                          <li key={row.id}>
                            <span className="type-badge">{RESOURCE_TYPES[row.type]?.label || row.type}</span>{" "}
                            {row.title} • <span className="cell-muted">{formatDateTime(row.created_at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
};

export default Admin;
