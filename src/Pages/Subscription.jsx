import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../Components/Navbar";
import Sidebar from "../Components/Sidebar";
import { CreditCard, CheckCircle2, AlertTriangle, Clock, Sparkles, Lock } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useSubscription } from "../context/useSubscription";
import {
  getPlans,
  getMyPayments,
  isSubscriptionActive,
  describeSubscriptionStatus,
  statusPillClass,
  formatINR,
  startCheckout
} from "../Services/subscriptionService";

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

const daysLeft = (iso) => {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
};

const Subscription = () => {
  const location = useLocation();
  const lockedFrom = location.state?.locked;
  const { user, profile } = useAuth();
  // Shared context, so unlocking here also lifts the route gate and stops the popup.
  const { subscription, refresh: refreshSubscription } = useSubscription();
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState(null);
  const [banner, setBanner] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [, paymentData] = await Promise.all([
      refreshSubscription(),
      getMyPayments(user.id)
    ]);
    setPayments(paymentData);
  }, [user, refreshSubscription]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const planData = await getPlans();
        if (!active) return;
        setPlans(planData);
        await refresh();
      } catch (err) {
        if (active) setBanner({ type: "error", text: err.message });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user, refresh]);

  const handleSubscribe = async (plan) => {
    setBanner(null);
    setProcessingPlanId(plan.id);
    try {
      const result = await startCheckout({ plan, user, profile, onSuccess: refresh });
      setBanner({
        type: "success",
        text: `Payment successful. Your ${plan.name} plan is active until ${formatDate(result.end_date)}.`
      });
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    } finally {
      setProcessingPlanId(null);
    }
  };

  const active = isSubscriptionActive(subscription);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-panel">
        <Navbar title="Subscription" />
        <div className="content-area">
          <section className="page-intro">
            <div className="page-intro-badge">Your plan</div>
            <h3>Manage your Adiuvaret subscription</h3>
            <p>Choose a plan that fits your teaching year. Renew any time — remaining days are always carried over.</p>
          </section>

          {lockedFrom && !banner ? (
            <div className="error-state" style={{ marginBottom: 16 }}>
              <p><Lock size={16} /> That page is locked. Subscribe to unlock every generator and your saved library.</p>
            </div>
          ) : null}

          {banner ? (
            <div className={banner.type === "error" ? "error-state" : "success-state"} style={{ marginBottom: 16 }}>
              <p>
                {banner.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />} {banner.text}
              </p>
            </div>
          ) : null}

          {loading ? (
            <div className="panel-card">
              <div className="loading-state">
                <div className="spinner" />
                <p>Loading your subscription...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="panel-card subscription-status-card">
                <div className="subscription-status-head">
                  <div className="resource-icon"><CreditCard size={20} /></div>
                  <div>
                    <h3>{subscription?.plans?.name || "No active plan"}</h3>
                    <p className="content-row-meta">
                      {active
                        ? `Active until ${formatDate(subscription.end_date)} • ${daysLeft(subscription.end_date)} days left`
                        : subscription?.status === "paused"
                          ? `Paused by an administrator on ${formatDate(subscription.paused_at)} — your remaining days are safe.`
                          : subscription?.status === "cancelled"
                            ? "This subscription was cancelled. Subscribe again below."
                            : subscription
                              ? `Expired on ${formatDate(subscription.end_date)}`
                              : "Pick a plan below to get started."}
                    </p>
                  </div>
                  <span className={`status-pill ${statusPillClass(subscription)}`}>
                    {describeSubscriptionStatus(subscription)}
                  </span>
                </div>
              </div>

              <h3 className="section-heading">{active ? "Renew or change your plan" : "Choose a plan"}</h3>
              <div className="plan-grid">
                {plans.map((plan) => {
                  const isCurrent = subscription?.plan_id === plan.id && active;
                  const perMonth = Number(plan.price_inr) / plan.duration_months;
                  return (
                    <div key={plan.id} className={`panel-card plan-card ${isCurrent ? "current" : ""}`}>
                      {isCurrent ? <span className="plan-badge"><Sparkles size={13} /> Current plan</span> : null}
                      <h4>{plan.name}</h4>
                      <div className="plan-price">{formatINR(plan.price_inr)}</div>
                      <p className="plan-permonth">{formatINR(perMonth)}/month</p>
                      <ul className="plan-features">
                        <li><CheckCircle2 size={14} /> All generators included</li>
                        <li><CheckCircle2 size={14} /> Unlimited saved resources</li>
                        <li><Clock size={14} /> {plan.duration_months} month{plan.duration_months > 1 ? "s" : ""} of access</li>
                      </ul>
                      <button
                        type="button"
                        className="primary-btn full"
                        disabled={processingPlanId !== null}
                        onClick={() => handleSubscribe(plan)}
                      >
                        {processingPlanId === plan.id
                          ? "Opening payment..."
                          : active ? "Renew with this plan" : "Subscribe"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {payments.length > 0 ? (
                <>
                  <h3 className="section-heading">Payment history</h3>
                  <div className="content-list">
                    {payments.map((payment) => (
                      <div key={payment.id} className="panel-card content-row">
                        <div className="resource-icon"><CreditCard size={18} /></div>
                        <div className="content-row-body">
                          <div className="content-row-top">
                            <h3>{payment.plans?.name || "Subscription"}</h3>
                            <span className={`status-pill ${payment.status === "paid" ? "active" : payment.status === "failed" ? "expired" : ""}`}>
                              {payment.status}
                            </span>
                          </div>
                          <p className="content-row-meta">
                            {formatINR(payment.amount_inr)} • {formatDate(payment.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Subscription;
