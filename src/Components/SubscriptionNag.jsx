import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Lock, X, Sparkles } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useSubscription } from "../context/useSubscription";

const REOPEN_DELAY_MS = 10000;

const SubscriptionNag = () => {
  const { session, loading: authLoading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  // Suppressed on the subscription page itself, otherwise the popup would sit on
  // top of the plan buttons and the Razorpay checkout window the user needs to reach.
  const suppressed =
    authLoading ||
    subLoading ||
    !session ||
    isActive ||
    location.pathname === "/subscription";

  useEffect(() => {
    if (suppressed || open) return undefined;
    const timer = setTimeout(() => setOpen(true), REOPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [suppressed, open]);

  useEffect(() => {
    if (suppressed) setOpen(true);
  }, [suppressed]);

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
          Worksheets, lesson plans, quizzes, activities, exam papers, and your saved
          library are locked until you subscribe.
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
