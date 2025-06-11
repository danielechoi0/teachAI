import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Phone, Star, AlertCircle, Settings, MessageSquare, Volume2 } from "lucide-react";
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
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(interval);
  }, []);


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
      <div className="h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex items-center justify-center p-4">
        <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Setup Required</h2>
          <p className="text-zinc-400 mb-3">Please complete your setup to continue.</p>
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
    <div className="h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-3 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-emerald-800/20 to-teal-800/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-800/20 to-blue-800/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 h-full flex flex-col">
        {/* Header Card - Compact */}
        <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 p-4 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 rounded-xl flex items-center justify-center shadow-sm">
                  <img src="/favicon.png" alt="Edusona Logo" className="w-10 h-10" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                  Edusona
                </h1>
              </div>
              <p className="text-zinc-400 text-sm mb-1">{currentTime}</p>
              {assistantName && (
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Volume2 className="w-3 h-3" />
                  <span>Assistant: <span className="font-semibold text-emerald-400">{assistantName}</span></span>
                </div>
              )}
            </div>
            <div className="hidden md:block">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-xl">
                <Star className="w-6 h-6 text-white animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        <StatusToast status={status} />

        {/* Main Content Grid - Flex grow to fill remaining space */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Main Action Card - Spans 2 columns on lg */}
          <div className="lg:col-span-2 bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 p-4">
            <div className="text-center h-full flex flex-col justify-center">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-xl mb-3 group hover:shadow-emerald-500/25 transition-all duration-300">
                  <Phone className="w-8 h-8 text-white group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Hello, {studentName}! 👋</h2>
                <p className="text-zinc-400 text-sm">Ready to talk? Click below to begin your conversation practice</p>
              </div>

              <button
                onClick={handleStartCall}
                disabled={!selectedAssistantId || isLoading}
                className="group relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 text-white font-bold py-4 px-8 rounded-xl shadow-xl flex items-center gap-3 mx-auto disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-2xl hover:shadow-emerald-500/25 transition-all duration-300 transform hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-3">
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Phone className="w-6 h-6 group-hover:animate-bounce" />
                      Start Conversation
                    </>
                  )}
                </div>
              </button>
              
              {!selectedAssistantId && (
                <div className="mt-3 p-2 bg-red-900/50 border border-red-800 rounded-lg">
                  <p className="text-red-400 text-xs font-medium">Please select an assistant to start a call</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Settings and Messages */}
          <div className="flex flex-col gap-3">
            {/* Settings Card - Compact */}
            <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 p-4">
              <div className="text-center">
                <div className="w-10 h-10 mx-auto bg-gradient-to-br from-zinc-600 to-zinc-700 rounded-xl flex items-center justify-center mb-2">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">Settings</h3>
                <p className="text-zinc-400 text-xs mb-3">Customize your experience</p>
                <button
                  onClick={() => navigate("/student/setup")}
                  className="w-full bg-gradient-to-r from-zinc-600 to-zinc-700 text-white font-medium py-2 px-3 rounded-lg hover:from-zinc-700 hover:to-zinc-800 transition-all duration-200 transform hover:scale-105 text-sm"
                >
                  Change Settings
                </button>
              </div>
            </div>

            {/* Live Messages Card - Flexible height */}
            <div className="flex-1 bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 p-4">
              {liveMessages.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Live Messages</h3>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-zinc-400">Live ({liveMessages.length})</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {liveMessages.map((msg, idx) => (
                      <div key={msg.id || idx} className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-800/50 p-2 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                        <p className="text-zinc-200 font-medium text-xs">{msg.message}</p>
                        <div className="text-xs text-zinc-400 mt-1">
                          {formatTimestamp(msg.timestamp || msg.inserted_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-10 h-10 mx-auto bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-xl flex items-center justify-center mb-2 opacity-50">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-400 mb-1">No Messages Yet</h3>
                  <p className="text-zinc-500 text-xs">
                    {callId ? "Your teacher hasn't sent any live messages" : "Start a call to receive live messages"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}