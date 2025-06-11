import React from "react";
import {
  CheckCircle,
  Info,
  AlertTriangle,
} from "lucide-react";

const iconMap = {
  success: <CheckCircle className="h-5 w-5 text-emerald-400" />,
  info: <Info className="h-5 w-5 text-blue-400" />,
  error: <AlertTriangle className="h-5 w-5 text-red-400" />,
};

export default function StatusToast({ status }) {
  if (!status?.message) return null;

  const statusType = status.type || "info";

  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div
        className={`flex items-center gap-3 rounded-xl border-l-4 px-4 py-3 shadow-lg backdrop-blur-md bg-zinc-900/90
        ${
          statusType === "success"
            ? "border-emerald-500 text-emerald-200"
            : statusType === "info"
            ? "border-blue-500 text-blue-200"
            : "border-red-500 text-red-200"
        }`}
      >
        {iconMap[statusType]}
        <span className="text-sm font-medium">{status.message}</span>
      </div>
    </div>
  );
}
