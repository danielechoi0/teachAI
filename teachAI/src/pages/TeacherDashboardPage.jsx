import React, { useState, useEffect, useCallback } from "react";
import EndedCallCard from "../components/cards/EndedCallCard";
import StatusToast from "../components/StatusToast";
import useStatus from "../hooks/useStatus.jsx";
import useTeacherSocket from "../hooks/useTeacherSocket";
import EnhancedListenCard from "../components/CallCard";
import CallReportModal from "../components/modals/CallReportModal";
import AssistantCustomizer from "../components/AssistantCustomizer";
import CallHistoryPage from "../components/CallHistory";

import {
  Activity,
  PhoneOff,
  Headphones,
  Settings,
  Monitor,
  LogOut,
  User,
  Key,
  History,
} from "lucide-react";
import { supabase } from "../utils/supabaseClient.js";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function AuthComponent({ onAuthSuccess }) {
  const { showStatus } = useStatus();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthSuccess(data.user);
        showStatus("Signed in!", "success");
      } else {
        const { error: signupError } = await supabase.auth.signUp({ email, password });
        if (signupError) throw signupError;

        let sessionUser = null;
        for (let i = 0; i < 10; i++) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) {
            sessionUser = data.session.user;
            break;
          }
          await new Promise(res => setTimeout(res, 200));
        }

        if (!sessionUser) throw new Error("Session not established. Try logging in.");

        const { error: profileError } = await supabase
          .from("teachers")
          .insert({ id: sessionUser.id, display_name: displayName || email });

        if (profileError) throw profileError;

        onAuthSuccess(sessionUser);
        showStatus("Account created!", "success");
      }
    } catch (err) {
      setError(err.message);
      showStatus(`${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 p-6">
      <form onSubmit={handleAuth} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-4">
        <div className="text-center mb-4">
          <Headphones className="w-10 h-10 mx-auto text-indigo-600" />
          <h2 className="text-xl font-bold mt-2">
            {isLogin ? "Teacher Login" : "Create Teacher Account"}
          </h2>
        </div>
        <input 
          type="email" 
          placeholder="teacher@school.edu" 
          className="w-full border px-4 py-2 rounded-lg" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="••••••••" 
          className="w-full border px-4 py-2 rounded-lg" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          minLength={6} 
          required 
        />
        {!isLogin && (
          <input 
            type="text" 
            placeholder="Display name" 
            className="w-full border px-4 py-2 rounded-lg" 
            value={displayName} 
            onChange={e => setDisplayName(e.target.value)} 
          />
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>}
        <button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-indigo-600 text-white py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
        </button>
        <button 
          type="button" 
          onClick={() => setIsLogin(!isLogin)} 
          className="text-indigo-600 text-sm mt-2"
        >
          {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function TeacherDashboardPage() {
  const { status, showStatus } = useStatus();
  const [user, setUser] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeCalls, setActiveCalls] = useState([]);
  const [endedCalls, setEndedCalls] = useState([]);
  const [callReports, setCallReports] = useState({});
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchTeacherProfile = useCallback(async (id) => {
    try {
      console.log("📋 Fetching teacher profile for ID:", id);
      const { data, error } = await supabase.from("teachers").select("*").eq("id", id).maybeSingle();
      
      if (error) {
        console.error("Teacher profile error:", error);
        throw error;
      }
      
      if (data) {
        console.log("Teacher profile loaded:", data.display_name);
        setTeacher(data);
      } else {
        console.log("No teacher profile found for user");
        showStatus("Teacher profile not found. Please contact support.", "error");
      }
    } catch (err) {
      console.error("fetchTeacherProfile error:", err.message);
      showStatus(`${err.message}`, "error");
    }
  }, [showStatus]);

  useEffect(() => {
    let mounted = true;

    const handleSession = async (session) => {
      if (!mounted) return;

      if (session?.user) {
        console.log("✅ Authenticated user:", session.user.email);
        setUser(session.user);
        await fetchTeacherProfile(session.user.id);
      } else {
        console.log("No user session");
        setUser(null);
        setTeacher(null);
      }

      setLoading(false);
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Error fetching session:", error.message);
        showStatus(`Auth error: ${error.message}`, "error");
        setLoading(false);
      } else {
        handleSession(data?.session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log("🔄 Auth state changed:", session?.user?.email);
        handleSession(session);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchTeacherProfile, showStatus]);

  const onNewCall = useCallback((call) => {
    console.log("Adding new call:", call);
    setActiveCalls(prev => [...prev, call]);
  }, []);

  const onCallEnded = useCallback(({ callId, student, duration, endTime }) => {
    console.log("Ending call:", { callId, student, duration, endTime });
    setActiveCalls(prev => prev.filter(c => c.callId !== callId));
    setEndedCalls(prev => [...prev, { callId, student, duration, endTime }]);
  }, []);

  const onCallReport = useCallback((report) => {
    console.log("Received call report:", report);
    setCallReports(prev => ({ ...prev, [report.callId]: report }));
  }, []);

  const onSetActiveCalls = useCallback((calls) => {
    console.log("Setting active calls:", calls);
    setActiveCalls(calls);
  }, []);

  const { socket, isConnected, addEventListeners } = useTeacherSocket(!!(user && teacher));

  useEffect(() => {
    if (socket && user && teacher) {
      console.log("🎧 Setting up socket event listeners");
      addEventListeners({
        onNewCall,
        onCallEnded,
        onCallReport,
        setActiveCalls: onSetActiveCalls,
        showStatus,
      });
    }
  }, [socket, user, teacher, onNewCall, onCallEnded, onCallReport, onSetActiveCalls, showStatus, addEventListeners]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      showStatus("Signed out successfully", "success");
    } catch (err) {
      showStatus(`Sign out error: ${err.message}`, "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100">
        <div className="text-center">
          <Headphones className="w-10 h-10 animate-bounce text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !teacher) return <AuthComponent onAuthSuccess={setUser} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 flex">
      <StatusToast status={status} />
      
      {/* Side Navigation */}
      <div className="w-80 bg-white shadow-xl border-r border-gray-200 flex flex-col min-h-screen justify-between">
        <div>
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800">Teacher Portal</h1>
            <p className="text-gray-600 text-sm">Welcome, {teacher.display_name}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-500">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <nav className="flex flex-col">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50 transition-colors ${
                activeTab === 'dashboard' ? 'bg-blue-50 border-r-4 border-blue-600 text-blue-700' : 'text-gray-700'
              }`}
            >
              <Monitor className="w-5 h-5" />
              <div>
                <div className="font-medium">Dashboard</div>
                <div className="text-sm text-gray-500">Monitor active calls</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('customize')}
              className={`flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50 transition-colors ${
                activeTab === 'customize' ? 'bg-blue-50 border-r-4 border-blue-600 text-blue-700' : 'text-gray-700'
              }`}
            >
              <Settings className="w-5 h-5" />
              <div>
                <div className="font-medium">Assistant Builder</div>
                <div className="text-sm text-gray-500">Create & customize assistants</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-3 px-6 py-4 text-left hover:bg-gray-50 transition-colors ${
                activeTab === 'history' ? 'bg-blue-50 border-r-4 border-blue-600 text-blue-700' : 'text-gray-700'
              }`}
            >
              <History className="w-5 h-5" />
              <div>
                <div className="font-medium">Call History</div>
                <div className="text-sm text-gray-500">View all previous calls</div>
              </div>
            </button>
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 mb-3 rounded-lg text-left transition-colors ${
              activeTab === 'profile'
                ? 'bg-blue-50 text-blue-700 border border-blue-600'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <User className="w-5 h-5" />
            <span>Profile</span>
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>


      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeTab === 'dashboard' ? (
          <div className="flex-1 p-6">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">Call Monitor</h2>
                  <p className="text-gray-600">Monitor student conversations and view reports</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 px-4 py-2 rounded-full text-sm font-semibold text-blue-700">
                    {activeCalls.length} Active • {endedCalls.length} Ended
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Headphones className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              {/* Active Calls */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-green-600" />
                  Active Calls ({activeCalls.length})
                </h3>
                {activeCalls.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center">
                    <p className="text-gray-500">No active calls</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {activeCalls.map(call => (
                      <EnhancedListenCard key={call.callId} {...call} />
                    ))}
                  </div>
                )}
              </div>

              {/* Ended Calls */}
              {endedCalls.length > 0 && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <PhoneOff className="w-6 h-6 text-gray-600" />
                    Recent Ended Calls ({endedCalls.length})
                  </h3>
                  <div className="grid gap-4">
                    {endedCalls
                      .slice()
                      .reverse()
                      .map(call => (
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
        ) : activeTab === 'customize' ? (
          <div className="flex-1 bg-white">
            <AssistantCustomizer 
              showStatus={showStatus}
              BACKEND_URL={BACKEND_URL}
              user={user}
              onBack={() => setActiveTab('dashboard')}
              onSuccess={() => {
                showStatus("Assistant created successfully!", "success");
              }}
            />
          </div>
        ) : activeTab === 'history' ? (
          <CallHistoryPage 
            user={user}
            showStatus={showStatus}
            BACKEND_URL={BACKEND_URL}
          />
        ) : (
          <div className="flex-1 p-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Profile & Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={teacher.display_name}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={user.email}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Student Access Key
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={teacher.student_key}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 font-mono text-lg"
                        readOnly
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(teacher.student_key);
                          showStatus("Key copied to clipboard!", "success");
                        }}
                        className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Share this key with your students so they can access your assistants.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedReport && (
        <CallReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </div>
  );
}