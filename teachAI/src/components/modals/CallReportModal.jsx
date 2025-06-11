import React from "react";
import { FileText, Download, MessageSquare, X, CheckCircle, AlertCircle } from "lucide-react";
import { formatTime } from "../../utils/formatters";

export default function CallReportModal({ report, onClose }) {
  if (!report) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-zinc-800">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-xl">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Call Report</h3>
              <p className="text-zinc-400">{report.student} • {formatTime(report.timestamp)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {report.summary && (
              <div className="bg-zinc-900/95 backdrop-blur-xl rounded-xl p-4 border-l-4 border-emerald-500">
                <h4 className="font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />Summary
                </h4>
                <p className="text-zinc-400">{report.summary}</p>
              </div>
            )}

            {report.recordingUrl && (
              <div className="bg-zinc-900/95 backdrop-blur-xl rounded-xl p-4 border-l-4 border-blue-500">
                <h4 className="font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-400" />Recording
                </h4>
                <a
                  href={report.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-500 underline flex items-center gap-1"
                >
                  Download Recording <Download className="w-3 h-3 text-blue-400" />
                </a>
              </div>
            )}

            {report.transcript && (
              <div className="bg-zinc-900/95 backdrop-blur-xl rounded-xl p-4 border-l-4 border-zinc-400">
                <h4 className="font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-zinc-400" />Transcript
                </h4>
                <div className="bg-zinc-800 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-zinc-400 font-mono">
                    {report.transcript}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}