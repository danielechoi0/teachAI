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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md border border-emerald-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome, Student!</h2>
          <p className="text-gray-600">
            {!keyVerified ? "Enter your teacher's key to continue" : "Let's set up your profile"}
          </p>
        </div>
        
        {!keyVerified ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Teacher Key *</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full px-4 py-3 pl-12 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
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
                <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">
                Ask your teacher for the unique class key
              </p>
            </div>
            
            {error && (
              <div className="w-full px-4 py-3 border-2 border-red-200 rounded-xl bg-red-50">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            
            <button
              onClick={verifyKey}
              disabled={!teacherKey.trim() || loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
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
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-sm font-medium text-emerald-700">Key Verified</span>
              </div>
              <button
                onClick={handleRetryKey}
                className="text-sm text-emerald-600 hover:text-emerald-700 underline"
              >
                Change Key
              </button>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Your Name *</label>
              <input
                type="text"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="Enter your name"
                maxLength={100}
              />
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Phone Number *</label>
              <input
                type="tel"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                value={studentNumber}
                onChange={handlePhoneChange}
                placeholder="+1 (555) 123-4567"
              />
              <p className="text-xs text-gray-500">Include country code (e.g., +1 for US)</p>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Choose Assistant *</label>
              {assistants.length === 0 ? (
                <div className="w-full px-4 py-3 border-2 border-yellow-200 rounded-xl bg-yellow-50 text-yellow-700 text-sm">
                  No assistants available. Please contact your teacher.
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedAssistant}
                    onChange={e => setSelectedAssistant(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors appearance-none bg-white cursor-pointer"
                  >
                    <option value="">Select an assistant...</option>
                    {assistants.map(assistant => (
                      <option key={assistant.id} value={assistant.vapi_id}>
                        {assistant.assistant_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>
            
            <button
              disabled={!studentName.trim() || !selectedAssistant}
              onClick={handleContinue}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Continue to Dashboard
            </button>
            
            <p className="text-xs text-gray-500 text-center">
              * Required fields
            </p>
          </div>
        )}
      </div>
    </div>
  );
}