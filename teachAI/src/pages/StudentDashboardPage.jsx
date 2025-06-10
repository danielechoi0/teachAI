import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Phone, Star, AlertCircle, Settings, MessageSquare, Sparkles, Volume2 } from "lucide-react";
import StatusToast from "../components/StatusToast";
import useStatus from "../hooks/useStatus.jsx";
import { startCall, fetchAssistants } from "../api/vapi";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function StudentDashboardPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { studentName, studentNumber, selectedAssistantId, teacherKey, callId } = state || {};
  const { status, showStatus } = useStatus();

  const [isLoading, setIsLoading] = useState(false);
  const [assistantName, setAssistantName] = useState("");
  const [liveMessages, setLiveMessages] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!state || !studentName || !selectedAssistantId) {
      navigate("/student/setup");
      return;
    }

    fetchAssistantName();

    socketRef.current = io(BACKEND_URL);

    if (callId && socketRef.current) {
      socketRef.current.emit("join_call", { callId });

      socketRef.current.on("live_message", (msg, ack) => {
        if (msg?.message) {
          setLiveMessages(prev => [...prev, { ...msg, timestamp: new Date() }]);
          if (ack) ack({ success: true });
        } else {
          if (ack) ack({ error: "No message content" });
        }
      });
    }

    return () => {
      socketRef.current?.disconnect();
    };
  }, [state, studentName, selectedAssistantId, callId, navigate]);

  const fetchAssistantName = async () => {
    try {
      const assistants = await fetchAssistants(teacherKey);
      const assistant = assistants.find(a => a.vapi_id === selectedAssistantId);
      if (assistant) {
        setAssistantName(assistant.assistant_name);
      } else {
        showStatus("Selected assistant not found. Please go back and select again.", "error");
      }
    } catch (err) {
      console.error("Error fetching assistant details:", err);
    }
  };

  async function handleStartCall() {
    try {
      setIsLoading(true);
      const response = await startCall({ assistantId: selectedAssistantId, studentName, studentNumber });
      showStatus("📞 Call is on the way – answer your phone!", "success");
      if (response && response.callId) {
        navigate("/student/dashboard", {
          state: { studentName, studentNumber, selectedAssistantId, teacherKey, callId: response.callId },
        });
      }
    } catch (err) {
      showStatus(`Failed to start call: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Just now";
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (!state || !studentName || !selectedAssistantId) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Setup Required</h2>
          <p className="text-gray-600 mb-3">Please complete your setup to continue.</p>
          <div className="flex space-x-2 justify-center">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-emerald-300/20 to-teal-300/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-300/20 to-blue-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Hello, {studentName}! 👋
                </h1>
              </div>
              <p className="text-gray-600 text-lg mb-2">Ready to talk?</p>
              {assistantName && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Volume2 className="w-4 h-4" />
                  <span>Assistant: <span className="font-semibold text-emerald-600">{assistantName}</span></span>
                </div>
              )}
            </div>
            <div className="hidden md:block">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-3xl flex items-center justify-center shadow-lg">
                <Star className="w-10 h-10 text-white animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        <StatusToast status={status} />

        {/* Main Action Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8 mb-8">
          <div className="text-center">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-2xl mb-4 group hover:shadow-emerald-500/25 transition-all duration-300">
                <Phone className="w-12 h-12 text-white group-hover:scale-110 transition-transform duration-300" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready to Start?</h2>
              <p className="text-gray-600">Click below to begin your conversation practice</p>
            </div>

            <button
              onClick={handleStartCall}
              disabled={!selectedAssistantId || isLoading}
              className="group relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 text-white font-bold py-6 px-12 rounded-2xl shadow-xl flex items-center gap-4 mx-auto text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-2xl hover:shadow-emerald-500/25 transition-all duration-300 transform hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center gap-4">
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    Connecting...
                  </>
                ) : (
                  <>
                    <Phone className="w-8 h-8 group-hover:animate-bounce" />
                    Start Conversation
                  </>
                )}
              </div>
            </button>
            
            {!selectedAssistantId && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm font-medium">Please select an assistant to start a call</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl flex items-center justify-center mb-4">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Settings</h3>
              <p className="text-gray-600 text-sm mb-4">Customize your experience</p>
              <button
                onClick={() => navigate("/student/setup")}
                className="w-full bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium py-3 px-4 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 transform hover:scale-105"
              >
                Change Settings
              </button>
            </div>
          </div>

          {/* Live Messages Card */}
          <div className="lg:col-span-2">
            {liveMessages.length > 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Live Messages from Teacher</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-600">Live ({liveMessages.length} messages)</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 max-h-40 overflow-y-auto">
                  {liveMessages.map((msg, idx) => (
                    <div key={msg.id || idx} className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
                      <p className="text-gray-700 font-medium">{msg.message}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(msg.timestamp || msg.inserted_at)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl flex items-center justify-center mb-4 opacity-50">
                    <MessageSquare className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No Messages Yet</h3>
                  <p className="text-gray-500 text-sm">
                    {callId ? "Your teacher hasn't sent any live messages" : "Start a call to receive live messages"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}