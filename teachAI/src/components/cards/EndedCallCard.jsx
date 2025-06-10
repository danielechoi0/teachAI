import React from "react";
import { PhoneOff, FileText, AlertCircle } from "lucide-react";
import { formatDuration, formatTime } from "../../utils/formatters";

export default function EndedCallCard({ call, report, onViewReport }) {
  return (
    <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center">
            <PhoneOff className="w-6 h-6 text-gray-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-700">{call.student}</h3>
            <p className="text-sm text-gray-500">Call ended</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Duration</div>
          <div className="font-semibold text-gray-700">{formatDuration(call.duration)}</div>
        </div>
      </div>

      {report?.summary && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
          <div className="text-sm font-medium text-blue-800 mb-1">Summary Preview</div>
          <p className="text-sm text-blue-700 line-clamp-2">
            {report.summary.length > 100 ? `${report.summary.slice(0, 100)}…` : report.summary}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">Ended at {formatTime(call.endTime)}</div>
        {report ? (
          <button
            onClick={onViewReport}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />View Report
          </button>
        ) : (
          <div className="text-sm text-amber-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />Report pending…
          </div>
        )}
      </div>
    </div>
  );
}
