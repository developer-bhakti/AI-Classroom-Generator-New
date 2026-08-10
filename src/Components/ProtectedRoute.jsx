import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useSubscription } from "../context/useSubscription";
import { isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from "../Services/supabaseClient";

const ProtectedRoute = ({ children, requireSubscription = false }) => {
  const location = useLocation();
  const { session, loading } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();

  if (!isSupabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="panel-card" style={{ maxWidth: 520, padding: 28 }}>
          <h3>Setup required</h3>
          <p style={{ marginTop: 8 }}>{SUPABASE_SETUP_MESSAGE}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="route-loading">
        <div className="spinner" />
        <p>Loading your workspace...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (requireSubscription) {
    // Wait for the subscription lookup so an active subscriber never gets
    // bounced to the paywall on a slow first load.
    if (subLoading) {
      return (
        <div className="route-loading">
          <div className="spinner" />
          <p>Checking your subscription...</p>
        </div>
      );
    }
    if (!isActive) {
      return <Navigate to="/subscription" replace state={{ locked: location.pathname }} />;
    }
  }

  return children;
};

export default ProtectedRoute;
