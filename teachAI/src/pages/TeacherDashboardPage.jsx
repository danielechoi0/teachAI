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
      onAuthSuccess(data.user, false); // false indicates login, not signup
      showStatus("Signed in!", "success");
    } else {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({ 
        email, 
        password 
      });
      if (signupError) throw signupError;

      let sessionUser = null;
      let attempts = 0;
      const maxAttempts = 15;
      
      while (attempts < maxAttempts) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          sessionUser = sessionData.session.user;
          break;
        }
        await new Promise(res => setTimeout(res, 300));
        attempts++;
      }

      if (!sessionUser) {
        throw new Error("Session not established. Please try logging in manually.");
      }

      let profileCreated = false;
      let profileAttempts = 0;
      const maxProfileAttempts = 3;

      while (!profileCreated && profileAttempts < maxProfileAttempts) {
        try {
          const { error: profileError } = await supabase
            .from("teachers")
            .insert({ 
              id: sessionUser.id, 
              display_name: displayName || email.split('@')[0]
            });

          if (profileError) {
            if (profileError.code === '23505') {
              console.log("Profile already exists, continuing...");
              profileCreated = true;
            } else {
              throw profileError;
            }
          } else {
            profileCreated = true;
          }
        } catch (retryError) {
          profileAttempts++;
          if (profileAttempts >= maxProfileAttempts) {
            throw new Error(`Failed to create profile: ${retryError.message}`);
          }
          await new Promise(res => setTimeout(res, 500));
        }
      }

      onAuthSuccess(sessionUser, true); // true indicates signup
      showStatus("Account created successfully!", "success");
    }
  } catch (err) {
    console.error("Auth error:", err);
    setError(err.message);
    showStatus(`${err.message}`, "error");

    if (!isLogin) {
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error("Error signing out after failed signup:", signOutError);
      }
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-blue-800/30 to-indigo-800/30 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-40 h-40 bg-gradient-to-r from-purple-800/30 to-pink-800/30 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-to-r from-emerald-800/20 to-teal-800/20 rounded-full blur-lg animate-pulse delay-500"></div>
      </div>

      <form onSubmit={handleAuth} className="relative z-10 bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-4 border border-zinc-800">
        <div className="text-center mb-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Headphones className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold mt-2 text-white">
            {isLogin ? "Teacher Login" : "Create Teacher Account"}
          </h2>
        </div>
        <input 
          type="email" 
          placeholder="teacher@school.edu" 
          className="w-full bg-zinc-900/50 border border-zinc-700 text-white placeholder-zinc-400 px-4 py-2 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="••••••••" 
          className="w-full bg-zinc-800/50 border border-zinc-700 text-white placeholder-zinc-400 px-4 py-2 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          minLength={6} 
          required 
        />
        {!isLogin && (
          <input 
            type="text" 
            placeholder="Display name" 
            className="w-full bg-zinc-800/50 border border-zinc-700 text-white placeholder-zinc-400 px-4 py-2 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
            value={displayName} 
            onChange={e => setDisplayName(e.target.value)} 
          />
        )}
        {error && <p className="text-sm text-red-400 bg-red-900/20 p-2 rounded-lg border border-red-800">{error}</p>}
        <button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-2 rounded-lg disabled:opacity-50 hover:from-blue-700 hover:to-indigo-800 transition-all"
        >
          {loading ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
        </button>
        <button 
          type="button" 
          onClick={() => setIsLogin(!isLogin)} 
          className="text-blue-400 text-sm mt-2 hover:text-blue-300 transition-colors"
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
  const [isNewSignup, setIsNewSignup] = useState(false);

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
        
        // If this was a new signup, automatically redirect to dashboard
        if (isNewSignup) {
          setActiveTab("dashboard");
          setIsNewSignup(false);
        }
      } else {
        console.log("No teacher profile found for user");
        showStatus("Teacher profile not found. Please contact support.", "error");
      }
    } catch (err) {
      console.error("fetchTeacherProfile error:", err.message);
      showStatus(`${err.message}`, "error");
    }
  }, [showStatus, isNewSignup]);

  const handleAuthSuccess = useCallback((authenticatedUser, isSignup = false) => {
    setUser(authenticatedUser);
    if (isSignup) {
      setIsNewSignup(true);
    }
  }, []);

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
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex items-center justify-center relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-blue-800/30 to-indigo-800/30 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute bottom-32 right-16 w-40 h-40 bg-gradient-to-r from-purple-800/30 to-pink-800/30 rounded-full blur-xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Headphones className="w-8 h-8 text-white animate-bounce" />
          </div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !teacher) return <AuthComponent onAuthSuccess={handleAuthSuccess} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-emerald-800/20 to-teal-800/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-40 h-40 bg-gradient-to-r from-blue-800/20 to-indigo-800/20 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-to-r from-purple-800/15 to-pink-800/15 rounded-full blur-lg animate-pulse delay-500"></div>
      </div>

      <StatusToast status={status} />
      
      {/* Side Navigation */}
      <div className="relative z-10 w-80 bg-zinc-900/95 backdrop-blur-xl shadow-2xl border-r border-zinc-800 flex flex-col min-h-screen justify-between">
        <div>
          <div className="p-6 border-b border-zinc-800">
            <h1 className="text-2xl font-bold text-white">Teacher Portal</h1>
            <p className="text-zinc-400 text-sm">Welcome, {teacher.display_name}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-zinc-500">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <nav className="flex flex-col">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-3 px-6 py-4 text-left hover:bg-zinc-800/50 transition-colors ${
                activeTab === 'dashboard' ? 'bg-blue-900/30 border-r-4 border-blue-500 text-blue-400' : 'text-zinc-300'
              }`}
            >
              <Monitor className="w-5 h-5" />
              <div>
                <div className="font-medium">Dashboard</div>
                <div className="text-sm text-zinc-500">Monitor active calls</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('customize')}
              className={`flex items-center gap-3 px-6 py-4 text-left hover:bg-zinc-800/50 transition-colors ${
                activeTab === 'customize' ? 'bg-blue-900/30 border-r-4 border-blue-500 text-blue-400' : 'text-zinc-300'
              }`}
            >
              <Settings className="w-5 h-5" />
              <div>
                <div className="font-medium">Assistant Builder</div>
                <div className="text-sm text-zinc-500">Create & customize assistants</div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-3 px-6 py-4 text-left hover:bg-zinc-800/50 transition-colors ${
                activeTab === 'history' ? 'bg-blue-900/30 border-r-4 border-blue-500 text-blue-400' : 'text-zinc-300'
              }`}
            >
              <History className="w-5 h-5" />
              <div>
                <div className="font-medium">Call History</div>
                <div className="text-sm text-zinc-500">View all previous calls</div>
              </div>
            </button>
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="p-6 border-t border-zinc-800">
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 mb-3 rounded-lg text-left transition-colors ${
              activeTab === 'profile'
                ? 'bg-blue-900/30 text-blue-400 border border-blue-700'
                : 'hover:bg-zinc-800/50 text-zinc-300'
            }`}
          >
            <User className="w-5 h-5" />
            <span>Profile</span>
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-red-900/30 hover:text-red-400 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {activeTab === 'dashboard' ? (
          <div className="flex-1 p-6">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Call Monitor</h2>
                  <p className="text-zinc-400">Monitor student conversations and view reports</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-blue-900/50 border border-blue-800 px-4 py-2 rounded-full text-sm font-semibold text-blue-400">
                    {activeCalls.length} Active • {endedCalls.length} Ended
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-xl">
                    <Headphones className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>

              {/* Active Calls */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-green-500" />
                  Active Calls ({activeCalls.length})
                </h3>
                {activeCalls.length === 0 ? (
                  <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8 text-center">
                    <p className="text-zinc-500">No active calls</p>
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
                  <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <PhoneOff className="w-6 h-6 text-zinc-400" />
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
          <div className="flex-1 bg-zinc-900/50 backdrop-blur-sm">
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
              <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl shadow-2xl p-8">
                <h2 className="text-2xl font-bold text-white mb-6">Profile & Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={teacher.display_name}
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 text-white rounded-lg"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={user.email}
                      className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-700 text-white rounded-lg"
                      readOnly
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Student Access Key
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={teacher.student_key}
                        className="flex-1 px-4 py-3 bg-zinc-800/50 border border-zinc-700 text-white rounded-lg font-mono text-lg"
                        readOnly
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(teacher.student_key);
                          showStatus("Key copied to clipboard!", "success");
                        }}
                        className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-sm text-zinc-500 mt-2">
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