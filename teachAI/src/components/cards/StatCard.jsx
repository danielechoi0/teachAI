import React from "react";
export default function StatCard({ icon, label, value, subtitle, color }) {
  return (
    <div
      className={`bg-gradient-to-br from-${color}-50 to-${color}-100 p-6 rounded-2xl border border-${color}-200 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-12 h-12 bg-${color}-100 rounded-xl flex items-center justify-center`}>{icon}</div>
        <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
      </div>
      <h3 className="font-semibold text-gray-800 mb-1">{label}</h3>
      <p className="text-sm text-gray-600">{subtitle}</p>
    </div>
  );
}