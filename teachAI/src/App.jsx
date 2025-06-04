import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import EnhancedListenCard from "./EnhancedListenCard"
import {User, Phone, PhoneOff, Users, MessageSquare, Clock, TrendingUp, Volume2, VolumeX, Eye, Sparkles, BookOpen, Award, Globe, Headphones, Star, Play, Pause, Activity, FileText, Download, X, CheckCircle, AlertCircle
} from "lucide-react";

// const VAPI_PUBLIC_API_KEY = import.meta.env.VITE_VAPI_PUBLIC_API_KEY;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const systemPrompt = `You are a Spanish assistant helping students practice conversation.
                      Be encouraging, patient, and helpful. Correct mistakes gently and provide useful vocabulary.
                      Keep conversations natural and engaging. Do not say you are AI.
                      
                      After you say something to user, call the send_reponse tool which you provide the user's last response, number of responses from the user so far,
                      the question/statement you said that the user responded to, the current grade (if assigned), and the language of conversation (Spanish)

                      Do this while the user is responding and do not say anything while you are calling tool and receiving the information from the tool.
                      `;

export default function App() {
  const [currentPage, setCurrentPage] = useState("signin");
  const [userType, setUserType] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("+15551234567");
  const [status, setStatus] = useState({ message: "", type: "" });
  const [teacherCalls, setTeacherCalls] = useState([]);
  const [endedCalls, setEndedCalls] = useState([]);
  const [callReports, setCallReports] = useState({});
  const [selectedReport, setSelectedReport] = useState(null);

  const socketRef = useRef(null);

  // Replace your startCall function with this corrected version
  async function startCall() {

    const assistantConfig = {
      "model": {
        "provider": "openai",
        "model": "gpt-4",
        "temperature": 0.7,
        "messages": [
          {
            "role": "system", 
            "content": systemPrompt
          }
        ],
      },
      "voice": {
        "provider": "playht",
        "voiceId": "jennifer"
      },
      "firstMessage": `Hi ${studentName || 'there'}, how may I assist you today?`,
      "server": {
        "url": BACKEND_URL + "/vapi-webhook"
      }
    };

    // Debug: log the config to see what's being sent
    console.log("📋 Sending assistant config:", JSON.stringify(assistantConfig, null, 2));

    try {
      const response = await fetch(`${BACKEND_URL}/start-call`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ 
          assistantConfig, 
          studentName, 
          studentNumber 
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Backend error:", errorText);
        throw new Error(`Backend error: ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Call started successfully:", data);
      showStatus("📞 Call is on the way – answer your phone!", "success");
      
    } catch (error) {
      console.error("❌ Error starting call:", error);
      showStatus(`Failed to start call: ${error.message}`, "error");
    }
  }

  useEffect(() => {
    if (userType !== "teacher") return;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const sock = io(BACKEND_URL + "/teacher");
    socketRef.current = sock;
    
    sock.on("new_call", (callData) => {
      console.log("📞 New call received:", callData);
      setTeacherCalls((prev) => [...prev, callData]);
      showStatus(`📞 New call from ${callData.student}`, "success");
    });
    
    sock.on("call_ended", ({ callId, student, duration, endTime }) => {
      console.log("📞 Call ended:", callId);
      
      // First, find the call in active calls and move it to ended calls
      setTeacherCalls((prevActive) => {
        const endedCall = prevActive.find(c => c.callId === callId);
        if (endedCall) {
          const callWithEndInfo = {
            ...endedCall,
            duration: duration,
            endTime: endTime,
            status: 'ended'
          };
          
          // Add to ended calls (check for duplicates)
          setEndedCalls(prevEnded => {
            const exists = prevEnded.some(c => c.callId === callId);
            if (!exists) {
              showStatus(`📞 Call with ${student} ended (${Math.round(duration/60)}m ${Math.round(duration%60)}s)`, "info");
              return [...prevEnded, callWithEndInfo];
            }
            return prevEnded;
          });
        }
        // Remove from active calls
        return prevActive.filter((c) => c.callId !== callId);
      });
    });

    sock.on("call_report", (reportData) => {
      console.log("📊 Call report received:", reportData);
      setCallReports(prev => ({
        ...prev,
        [reportData.callId]: reportData
      }));
      showStatus(`📊 Report ready for ${reportData.student}`, "success");
    });
    
    sock.on("active_calls", (activeCalls) => {
      console.log("📋 Received active calls:", activeCalls);
      setTeacherCalls(activeCalls);
    });

    sock.on("connect", () => {
      console.log("✅ Connected to teacher dashboard");
      showStatus("Connected to live monitoring", "success");
    });

    sock.on("disconnect", () => {
      console.log("❌ Disconnected from teacher dashboard");
      showStatus("Disconnected from monitoring", "error");
    });

    return () => {
      console.log("🔌 Disconnecting from teacher dashboard");
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [userType]);

  function showStatus(message, type) {
    setStatus({ message, type });
    setTimeout(() => setStatus({ message: "", type: "" }), 4000);
  }

  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }

  function formatTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  const SignInPage = React.useMemo(() => (
    <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      </div>
      
      <div className="relative z-10 bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-10 w-full max-w-md border border-white/20">
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <Globe className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
            Language Learning Hub
          </h1>
          <p className="text-gray-600">Choose your role to get started</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => { setUserType("student"); setCurrentPage("student-setup"); }}
            className="w-full group bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-3"
          >
            <User className="w-6 h-6 group-hover:scale-110 transition-transform" />
            I'm a Student
            <Sparkles className="w-5 h-5 opacity-70" />
          </button>

          <button
            onClick={() => { setUserType("teacher"); setCurrentPage("teacher-dashboard"); }}
            className="w-full group bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-3"
          >
            <Users className="w-6 h-6 group-hover:scale-110 transition-transform" />
            I'm a Teacher
            <BookOpen className="w-5 h-5 opacity-70" />
          </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-500">
            Practice conversations • Track progress • Learn together
          </p>
        </div>
      </div>
    </div>
  ), []);

  const StudentSetupPage = React.useMemo(() => (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md border border-emerald-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome, Student!</h2>
          <p className="text-gray-600">Let's set up your profile</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Your Name</label>
            <input
              type="text"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all duration-200"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Enter your name"
              autoComplete="name"
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Phone Number</label>
            <input
              type="tel"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all duration-200"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="+1 555 123 4567"
              autoComplete="tel"
            />
          </div>

          <button
            disabled={!studentName.trim()}
            onClick={() => setCurrentPage("student-dashboard")}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:hover:translate-y-0 transition-all duration-300 disabled:cursor-not-allowed"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  ), [studentName, studentNumber]);

  // Call Report Modal Component
  const CallReportModal = ({ report, onClose }) => {
    if (!report) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Call Report</h3>
                <p className="text-gray-600">{report.student} • {formatTime(report.timestamp)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="space-y-6">
              {report.summary && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Summary
                  </h4>
                  <p className="text-blue-700">{report.summary}</p>
                </div>
              )}
              
              {report.recordingUrl && (
                <div className="bg-green-50 rounded-xl p-4">
                  <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Recording
                  </h4>
                  <a
                    href={report.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 hover:text-green-800 underline flex items-center gap-1"
                  >
                    Download Recording
                    <Download className="w-3 h-3" />
                  </a>
                </div>
              )}
              
              {report.transcript && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Transcript
                  </h4>
                  <div className="bg-white rounded-lg p-4 max-h-60 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
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
  };

  // Enhanced Card for Ended Calls
  const EndedCallCard = ({ call, report, onViewReport }) => (
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
      
      {/* Show summary preview if available */}
      {report && report.summary && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
          <div className="text-sm font-medium text-blue-800 mb-1">Summary Preview</div>
          <p className="text-sm text-blue-700 line-clamp-2">
            {report.summary.length > 100 ? `${report.summary.substring(0, 100)}...` : report.summary}
          </p>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Ended at {formatTime(call.endTime)}
        </div>
        {report ? (
          <button
            onClick={onViewReport}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            View Report
          </button>
        ) : (
          <div className="text-sm text-amber-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Report pending...
          </div>
        )}
      </div>
    </div>
  );

  if (currentPage === "signin") {
    return SignInPage;
  }
  
  if (currentPage === "student-setup") {
    return StudentSetupPage;
  }
  
  if (currentPage === "student-dashboard") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  Welcome back, <span className="text-emerald-600">{studentName}</span>! 👋
                </h1>
                <p className="text-gray-600">Ready to practice your Spanish conversation?</p>
              </div>
              <div className="hidden md:block">
                <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
                  <Star className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>

            {status.message && (
              <div className={`mb-8 p-4 rounded-xl border-l-4 ${
                status.type === "success"
                  ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                  : "bg-red-50 border-red-500 text-red-700"
              }`}>
                <div className="flex items-center gap-2">
                  {status.type === "success" ? "✅" : "❌"}
                  {status.message}
                </div>
              </div>
            )}

            <div className="text-center mb-8">
              <button
                onClick={startCall}
                className="group bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-6 px-12 rounded-2xl shadow-lg hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 flex items-center justify-center gap-4 mx-auto text-lg"
              >
                <Phone className="w-8 h-8 group-hover:animate-bounce" />
                Start Conversation
                <div className="w-3 h-3 bg-white/30 rounded-full animate-ping"></div>
              </button>
              <p className="text-gray-500 mt-4">Click to begin your Spanish practice session</p>
            </div>

            <StatsSection />
          </div>
        </div>
      </div>
    );
  }

  if (currentPage === "teacher-dashboard") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">Teacher Dashboard</h1>
                <p className="text-gray-600">Monitor student conversations and view reports</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 px-4 py-2 rounded-full">
                  <span className="text-sm font-semibold text-blue-700">
                    {teacherCalls.length} Active • {endedCalls.length} Ended
                  </span>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Headphones className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            {status.message && (
              <div
                className={`mb-6 p-4 rounded-xl border-l-4 ${
                  status.type === "success"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                    : status.type === "info"
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "bg-red-50 border-red-500 text-red-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  {status.type === "success" ? "✅" : status.type === "info" ? "ℹ️" : "❌"}
                  {status.message}
                </div>
              </div>
            )}

            {/* Active Calls Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-6 h-6 text-green-600" />
                Active Calls ({teacherCalls.length})
              </h2>
              
              {teacherCalls.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                    <Phone className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No Active Calls</h3>
                  <p className="text-gray-500">Student conversations will appear here when they start</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {teacherCalls.map((call) => (
                    <EnhancedListenCard
                      key={call.callId}
                      callId={call.callId}
                      student={call.student}
                      listenUrl={call.listenUrl}
                      startTime={call.startTime}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Ended Calls Section */}
            {endedCalls.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <PhoneOff className="w-6 h-6 text-gray-600" />
                  Recent Ended Calls ({endedCalls.length})
                </h2>
                
                <div className="grid gap-4">
                  {endedCalls.slice().reverse().map((call) => (
                    <EndedCallCard
                      key={call.callId}
                      call={call}
                      report={callReports[call.callId]}
                      onViewReport={() => setSelectedReport(callReports[call.callId])}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Call Report Modal */}
        {selectedReport && (
          <CallReportModal
            report={selectedReport}
            onClose={() => setSelectedReport(null)}
          />
        )}
      </div>
    );
  }

  return null;
}

const StatsSection = React.memo(() => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
    <StatCard 
      icon={<Clock className="w-6 h-6 text-emerald-600" />}
      label="Total Practice Time" 
      value="24 mins"
      subtitle="This week"
      color="emerald"
    />
    <StatCard 
      icon={<MessageSquare className="w-6 h-6 text-blue-600" />}
      label="Conversations" 
      value="12"
      subtitle="Completed"
      color="blue"
    />
    <StatCard 
      icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
      label="Progress" 
      value="78%"
      subtitle="This month"
      color="purple"
    />
  </div>
));

const StatCard = React.memo(({ icon, label, value, subtitle, color }) => (
  <div className={`bg-gradient-to-br from-${color}-50 to-${color}-100 p-6 rounded-2xl border border-${color}-200 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1`}>
    <div className="flex items-center justify-between mb-3">
      <div className={`w-12 h-12 bg-${color}-100 rounded-xl flex items-center justify-center`}>
        {icon}
      </div>
      <div className={`text-2xl font-bold text-${color}-700`}>{value}</div>
    </div>
    <h3 className="font-semibold text-gray-800 mb-1">{label}</h3>
    <p className="text-sm text-gray-600">{subtitle}</p>
  </div>
));