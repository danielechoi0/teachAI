import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { StatusProvider } from "./hooks/useStatus";
import SignInPage from "./pages/SignInPage";
import StudentSetupPage from "./pages/StudentSetupPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import TeacherDashboardPage from "./pages/TeacherDashboardPage";
import AssistantCustomizerPage from "./pages/AssistantCustomizerPage";

export default function App() {
  return (
    <StatusProvider>
      <Router>
        <Routes>
          <Route path="/" element={<SignInPage />} />
          <Route path="/student/setup" element={<StudentSetupPage />} />
          <Route path="/student/dashboard" element={<StudentDashboardPage />} />
          <Route path="/teacher/dashboard" element={<TeacherDashboardPage />} />
          <Route path="/customizer" element={<AssistantCustomizerPage />} />
        </Routes>
      </Router>
    </StatusProvider>
  );
}