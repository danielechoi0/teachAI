import React from "react";
import AssistantCustomizer from "../components/AssistantCustomizer";
import { BACKEND_URL } from "../api/vapi";
import useStatus from "../hooks/useStatus";
import { useNavigate } from "react-router-dom";

export default function AssistantCustomizerPage() {
  const { showStatus } = useStatus();
  const navigate = useNavigate();
  return (
    <AssistantCustomizer
      BACKEND_URL={BACKEND_URL}
      showStatus={showStatus}
      onBack={() => navigate(-1)}
      onSuccess={() => navigate("/teacher/dashboard")}
    />
  );
}