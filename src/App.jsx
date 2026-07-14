import { Routes, Route } from "react-router-dom";

import Dashboard from "./Pages/Dashboard";
import Login from "./Pages/Login";
import WorksheetGenerator from "./Pages/WorksheetGenerator";
import LessonGenerator from "./Pages/LessonGenerator";
import QuizGenerator from "./Pages/QuizGenerator";
import ActivityIdeas from "./Pages/ActivityIdeas";
import Settings from "./Pages/Settings";
import ProtectedRoute from "./Components/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

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
    </Routes>
  );
}

export default App;