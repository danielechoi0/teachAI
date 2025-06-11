import React from "react";

export default function StatCard({ icon, label, value, subtitle, color }) {
  return (
    <div
      className={`bg-zinc-900/95 backdrop-blur-xl rounded-2xl border border-zinc-800 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-12 h-12 bg-gradient-to-br from-${color}-500 via-${color}-600 to-${color}-700 rounded-2xl flex items-center justify-center shadow-xl`}>
          {icon}
        </div>
        <div className={`text-2xl font-bold text-${color}-400`}>
          {value}
        </div>
      </div>
      <h3 className="font-semibold text-white mb-1">{label}</h3>
      <p className="text-sm text-zinc-400">{subtitle}</p>
    </div>
  );
}