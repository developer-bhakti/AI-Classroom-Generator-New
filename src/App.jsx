import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import Dashboard from "./Pages/Dashboard";
import Login from "./Pages/Login";
import SignUp from "./Pages/SignUp";
import WorksheetGenerator from "./Pages/WorksheetGenerator";
import LessonGenerator from "./Pages/LessonGenerator";
import QuizGenerator from "./Pages/QuizGenerator";
import ActivityIdeas from "./Pages/ActivityIdeas";
import Settings from "./Pages/Settings";
import ExamPaper from "./Pages/ExamPaper";
import SavedContent from "./Pages/SavedContent";
import History from "./Pages/History";
import Profile from "./Pages/Profile";
import Subscription from "./Pages/Subscription";
import Admin from "./Pages/Admin";
import ProtectedRoute from "./Components/ProtectedRoute";
import AdminRoute from "./Components/AdminRoute";
import SubscriptionNag from "./Components/SubscriptionNag";

function App() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("adiuvaret-theme");
    const initialTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
    document.documentElement.style.colorScheme = initialTheme;
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("adiuvaret-theme", theme);
  }, [theme]);

  return (
    <>
      <SubscriptionNag />
      <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/worksheet"
        element={
          <ProtectedRoute requireSubscription>
            <WorksheetGenerator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lesson"
        element={
          <ProtectedRoute requireSubscription>
            <LessonGenerator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quiz"
        element={
          <ProtectedRoute requireSubscription>
            <QuizGenerator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities"
        element={
          <ProtectedRoute requireSubscription>
            <ActivityIdeas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam"
        element={
          <ProtectedRoute requireSubscription>
            <ExamPaper />
          </ProtectedRoute>
        }
      />
      <Route
        path="/saved"
        element={
          <ProtectedRoute requireSubscription>
            <SavedContent />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute requireSubscription>
            <History />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription"
        element={
          <ProtectedRoute>
            <Subscription />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Admin />
          </AdminRoute>
        }
      />
      </Routes>
    </>
  );
}

export default App;