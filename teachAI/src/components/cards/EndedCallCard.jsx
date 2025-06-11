import React from "react";
import { PhoneOff, FileText, AlertCircle } from "lucide-react";
import { formatDuration, formatTime } from "../../utils/formatters";

export default function EndedCallCard({ call, report, onViewReport }) {
  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
            <PhoneOff className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-white">{call.student}</h3>
            <p className="text-zinc-400 text-sm">Call ended</p>
          </div>
        </div>
        <div className="text-zinc-400 text-sm">Duration: {formatDuration(call.duration)}</div>
      </div>

      {report?.summary && (
        <div className="mb-4 p-3 bg-zinc-900/50 rounded-lg border-l-4 border-emerald-500">
          <div className="text-sm font-medium text-emerald-400 mb-1">Summary Preview</div>
          <p className="text-sm text-emerald-400 line-clamp-2">
            {report.summary.length > 100 ? `${report.summary.slice(0, 100)}…` : report.summary}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">Ended at {formatTime(call.endTime)}</div>
        {report ? (
          <button
            onClick={onViewReport}
            className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all duration-300"
          >
            <FileText className="w-4 h-4" />
            View Report
          </button>
        ) : (
          <div className="text-sm text-emerald-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Report pending…
          </div>
        )}
      </div>
    </div>
  );
}
