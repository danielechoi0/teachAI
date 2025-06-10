import React from "react";

export default function StatusToast({ status }) {
  if (!status.message) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div
        className={`p-4 rounded-xl border-l-4 shadow-lg ${
          status.type === "success"
            ? "bg-emerald-50 border-emerald-500 text-emerald-700"
            : status.type === "info"
            ? "bg-blue-50 border-blue-500 text-blue-700"
            : "bg-red-50 border-red-500 text-red-700"
        }`}
      >
        <div className="text-sm font-medium">{status.message}</div>
      </div>
    </div>
  );
}
