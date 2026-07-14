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
import ProtectedRoute from "./Components/ProtectedRoute";

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
          <ProtectedRoute>
            <WorksheetGenerator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lesson"
        element={
          <ProtectedRoute>
            <LessonGenerator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/quiz"
        element={
          <ProtectedRoute>
            <QuizGenerator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities"
        element={
          <ProtectedRoute>
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
          <ProtectedRoute>
            <ExamPaper />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;