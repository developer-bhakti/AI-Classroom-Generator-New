import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const AdminRoute = ({ children }) => {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="route-loading">
        <div className="spinner" />
        <p>Checking access...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;
  if (profile?.role !== "admin") return <Navigate to="/dashboard" replace />;

  return children;
};


export default AdminRoute;
