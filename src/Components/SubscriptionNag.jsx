import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Lock, X, Sparkles } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useSubscription } from "../context/useSubscription";
import { isFreePath } from "../Services/freeAccess";

const REOPEN_DELAY_MS = 10000;

const SubscriptionNag = () => {
  const { session, loading: authLoading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  // Never on a free page: a child playing a quiz or an activity must not be interrupted by a payment request.
  const onFreePage = isFreePath(location.pathname);

  // Suppressed on the subscription page itself, otherwise the popup would sit on
  // top of the plan buttons and the Razorpay checkout window the user needs to reach.
  const suppressed =
    authLoading ||
    subLoading ||
    !session ||
    isActive ||
    onFreePage ||
    location.pathname === "/subscription";

  useEffect(() => {
    if (suppressed || open) return undefined;
    const timer = setTimeout(() => setOpen(true), REOPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [suppressed, open]);

  useEffect(() => {
    // Signed out / subscribed / on the plans page: the next visit starts with the popup. Coming from a free
    // page it starts closed instead, so finishing a quiz and moving on does not flash a payment request at once
    // (it returns after the usual delay if they are still not subscribed).
    if (suppressed) setOpen(!onFreePage);
  }, [suppressed, onFreePage]);

  if (suppressed || !open) return null;

  return createPortal(
    <div className="profile-modal-backdrop nag-backdrop" onClick={() => setOpen(false)}>
      <div className="profile-modal nag-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-btn nag-close" onClick={() => setOpen(false)} aria-label="Close">
          <X size={18} />
        </button>

        <div className="nag-icon"><Lock size={24} /></div>
        <h3>Your subscription is inactive</h3>
        <p>
          Lesson plans, exam papers, child assessments, and your saved
          library are locked until you subscribe. Quizzes are always free.
        </p>

        <button
          type="button"
          className="primary-btn full"
          onClick={() => {
            setOpen(false);
            navigate("/subscription");
          }}
        >
          <Sparkles size={16} /> Buy a subscription
        </button>
        <button type="button" className="text-btn nag-dismiss" onClick={() => setOpen(false)}>
          Not now
        </button>
      </div>
    </div>,
    document.body
  );
};

export default SubscriptionNag;
