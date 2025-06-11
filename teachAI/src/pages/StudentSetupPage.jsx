import React, { useState, useEffect } from "react";
import { User, ChevronDown, RefreshCw, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchAssistants } from "../api/vapi";

export default function StudentSetupPage() {
  const [teacherKey, setTeacherKey] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("+15551234567");
  const [assistants, setAssistants] = useState([]);
  const [selectedAssistant, setSelectedAssistant] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyVerified, setKeyVerified] = useState(false);
  const navigate = useNavigate();

  const verifyKey = async () => {
    if (!teacherKey.trim()) {
      alert("Please enter the teacher key");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      const data = await fetchAssistants(teacherKey.trim());
      setAssistants(data);
      setKeyVerified(true);
      
      if (data.length > 0) {
        setSelectedAssistant(data[0].id);
      }
    } catch (err) {
      setError(err.message);
      setKeyVerified(false);
      console.error('Error verifying key and fetching assistants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryKey = () => {
    setKeyVerified(false);
    setAssistants([]);
    setSelectedAssistant("");
    setError("");
  };

  const handleContinue = () => {
    if (!studentName.trim()) {
      alert("Please enter your name");
      return;
    }
    
    if (!selectedAssistant) {
      alert("Please select an assistant");
      return;
    }

    // Basic phone number validation
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    if (!phoneRegex.test(studentNumber)) {
      alert("Please enter a valid phone number");
      return;
    }

    navigate("/student/dashboard", {
      state: {
        studentName: studentName.trim(),
        studentNumber: studentNumber.trim(),
        selectedAssistantId: selectedAssistant,
        teacherKey: teacherKey.trim(),
      }
    });
  };

  const handlePhoneChange = (e) => {
    let value = e.target.value;
    if (!value.startsWith('+') && value.length > 0) {
      value = '+1' + value.replace(/^\+?1?/, '');
    }
    setStudentNumber(value);
  };

  const handleKeySubmit = (e) => {
    e.preventDefault();
    verifyKey();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black flex items-center justify-center p-4 relative overflow-hidden font-poppins">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-r from-emerald-800/30 to-teal-800/30 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-40 h-40 bg-gradient-to-r from-blue-800/30 to-indigo-800/30 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-gradient-to-r from-purple-800/20 to-pink-800/20 rounded-full blur-lg animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-10 w-full max-w-md border border-zinc-800">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-105 transition-all duration-300">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-medium text-white mb-2">Welcome, Student!</h2>
          <p className="text-zinc-400 font-normal">
            {!keyVerified ? "Enter your teacher's key to continue" : "Let's set up your profile"}
          </p>
        </div>
        
        {!keyVerified ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">Teacher Key *</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full px-4 py-3 pl-12 bg-zinc-800/50 border-2 border-zinc-700 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors text-white placeholder-zinc-400 backdrop-blur-sm"
                  value={teacherKey}
                  onChange={(e) => setTeacherKey(e.target.value)}
                  placeholder="Enter the key provided by your teacher"
                  maxLength={50}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      verifyKey();
                    }
                  }}
                />
                <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-xs text-zinc-500">
                Ask your teacher for the unique class key
              </p>
            </div>
            
            {error && (
              <div className="w-full px-4 py-3 border-2 border-red-500/50 rounded-xl bg-red-900/30 backdrop-blur-sm">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            
            <button
              onClick={verifyKey}
              disabled={!teacherKey.trim() || loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-medium py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-700 hover:to-teal-800 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Verifying Key...
                </>
              ) : (
                <>
                  <Key className="w-5 h-5" />
                  Verify Key & Continue
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center p-3 bg-emerald-900/30 rounded-xl border border-emerald-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-sm font-medium text-emerald-400">Key Verified</span>
              </div>
              <button
                onClick={handleRetryKey}
                className="text-sm text-emerald-400 hover:text-emerald-300 underline transition-colors"
              >
                Change Key
              </button>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">Your Name *</label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-zinc-800/50 border-2 border-zinc-700 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors text-white placeholder-zinc-400 backdrop-blur-sm"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="Enter your name"
                maxLength={100}
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">Phone Number *</label>
              <input
                type="tel"
                className="w-full px-4 py-3 bg-zinc-800/50 border-2 border-zinc-700 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors text-white placeholder-zinc-400 backdrop-blur-sm"
                value={studentNumber}
                onChange={handlePhoneChange}
                placeholder="+1 (555) 123-4567"
              />
              <p className="text-xs text-zinc-500">Include country code (e.g., +1 for US)</p>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">Choose Assistant *</label>
              {assistants.length === 0 ? (
                <div className="w-full px-4 py-3 border-2 border-yellow-500/50 rounded-xl bg-yellow-900/30 text-yellow-400 text-sm backdrop-blur-sm">
                  No assistants available. Please contact your teacher.
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedAssistant}
                    onChange={e => setSelectedAssistant(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-800/50 border-2 border-zinc-700 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors appearance-none cursor-pointer text-white backdrop-blur-sm"
                  >
                    <option value="" className="bg-zinc-800 text-zinc-400">Select an assistant...</option>
                    {assistants.map(assistant => (
                      <option key={assistant.id} value={assistant.vapi_id} className="bg-zinc-800 text-white">
                        {assistant.assistant_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none" />
                </div>
              )}
            </div>
            
            <button
              disabled={!studentName.trim() || !selectedAssistant}
              onClick={handleContinue}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-medium py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-700 hover:to-teal-800 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
            >
              Continue to Dashboard
            </button>
            
            <p className="text-xs text-zinc-500 text-center">
              * Required fields
            </p>
          </div>
        )}
      </div>
    </div>
  );
}