import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

import {
  User,
  Phone,
  PhoneOff,
  Users,
  MessageSquare,
  Clock,
  TrendingUp,
  Volume2,
  VolumeX,
  Eye,
  Sparkles,
  BookOpen,
  Award,
  Globe,
  Headphones,
  Star,
  Play,
  Pause,
  Activity
} from "lucide-react";

// You'll need to set these in your .env file
const VAPI_PUBLIC_API_KEY = import.meta.env.VITE_VAPI_PUBLIC_API_KEY;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const systemPrompt = `You are a Spanish assistant helping students practice conversation. Be encouraging, patient, and helpful. Correct mistakes gently and provide useful vocabulary. Keep conversations natural and engaging. Do not say you are AI.`;

// Audio Processor for streaming
const AudioProcessor = `
class PCMPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffers = [];
    this.isPlaying = false;
    
    this.port.onmessage = (event) => {
      if (event.data instanceof Int16Array) {
        this.buffers.push(event.data);
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (output.length > 0 && this.buffers.length > 0) {
      const buffer = this.buffers.shift();
      const outputChannel = output[0];
      
      for (let i = 0; i < outputChannel.length && i < buffer.length; i++) {
        outputChannel[i] = buffer[i] / 32768.0; // Convert to float32
      }
    }
    return true;
  }
}

registerProcessor('pcm-player', PCMPlayer);
`;

export default function App() {
  const [currentPage, setCurrentPage] = useState("signin");
  const [userType, setUserType] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("+15551234567");
  const [status, setStatus] = useState({ message: "", type: "" });
  const [teacherCalls, setTeacherCalls] = useState([]);

  async function startCall() {
    const assistantConfig = {
      model: {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.7,
        messages: [{ role: "system", content: systemPrompt }],
      },
      voice: { provider: "playht", voiceId: "jennifer" },
      firstMessage: `Hi, ${studentName || "there"}, how may I assist you today?`,
    };

    try {
      await fetch(`${BACKEND_URL}/start-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantConfig, studentName, studentNumber }),
      });
      showStatus("📞 Call is on the way – answer your phone!", "success");
    } catch (e) {
      console.error(e);
      showStatus("Failed to start call.", "error");
    }
  }

  useEffect(() => {
    if (userType !== "teacher") return;

    const sock = io(BACKEND_URL + "/teacher");
    
    sock.on("new_call", (callData) => {
      console.log("📞 New call received:", callData);
      setTeacherCalls((prev) => [...prev, callData]);
      showStatus(`📞 New call from ${callData.student}`, "success");
    });
    
    sock.on("call_ended", ({ callId }) => {
      console.log("📞 Call ended:", callId);
      setTeacherCalls((prev) => {
        const endedCall = prev.find(c => c.callId === callId);
        if (endedCall) {
          showStatus(`📞 Call with ${endedCall.student} ended`, "info");
        }
        return prev.filter((c) => c.callId !== callId);
      });
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
      sock.disconnect();
    };
  }, [userType]);

  function showStatus(message, type) {
    setStatus({ message, type });
    setTimeout(() => setStatus({ message: "", type: "" }), 4000);
  }

  const SignInPage = () => (
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
  );

  const StudentSetupPage = () => (
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
  );

  const StudentDashboard = () => (
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

  const TeacherDashboard = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Teacher Dashboard</h1>
              <p className="text-gray-600">Monitor active student conversations</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 px-4 py-2 rounded-full">
                <span className="text-sm font-semibold text-blue-700">
                  {teacherCalls.length} Active Call{teacherCalls.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Headphones className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          {status.message && (
            <div className={`mb-6 p-4 rounded-xl border-l-4 ${
              status.type === "success"
                ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                : status.type === "info"
                ? "bg-blue-50 border-blue-500 text-blue-700"
                : "bg-red-50 border-red-500 text-red-700"
            }`}>
              <div className="flex items-center gap-2">
                {status.type === "success" ? "✅" : status.type === "info" ? "ℹ️" : "❌"}
                {status.message}
              </div>
            </div>
          )}

          {teacherCalls.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <Phone className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Active Calls</h3>
              <p className="text-gray-500">Student conversations will appear here when they start</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {teacherCalls.map((call) => (
                <EnhancedListenCard key={call.callId} {...call} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className={currentPage === "signin" ? "" : "hidden"}><SignInPage /></div>
      <div className={currentPage === "student-setup" ? "" : "hidden"}><StudentSetupPage /></div>
      <div className={currentPage === "student-dashboard" ? "" : "hidden"}><StudentDashboard /></div>
      <div className={currentPage === "teacher-dashboard" ? "" : "hidden"}><TeacherDashboard /></div>
    </>
  );
}

// Enhanced Listen Card with Audio Streaming
function EnhancedListenCard({ callId, student, listenUrl, startTime }) {
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [callDuration, setCallDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const wsRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Calculate call duration
  useEffect(() => {
    const interval = setInterval(() => {
      if (startTime) {
        setCallDuration(Math.floor((Date.now() / 1000) - startTime));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Audio level monitoring
  const monitorAudioLevel = () => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255);
      
      animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
    }
  };

  const startListening = async () => {
    if (!listenUrl || isListening) return;

    try {
      setConnectionStatus('connecting');
      
      // Create audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      // Create audio processor worklet
      const processorCode = `data:text/javascript;base64,${btoa(AudioProcessor)}`;
      await audioContextRef.current.audioWorklet.addModule(processorCode);

      // Create worklet node
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-player', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      });

      // Create gain node for volume control
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;

      // Create analyser for audio level monitoring
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      // Connect audio nodes
      workletNodeRef.current
        .connect(gainNodeRef.current)
        .connect(analyserRef.current)
        .connect(audioContextRef.current.destination);

      // Start audio level monitoring
      monitorAudioLevel();

      // Setup WebSocket connection
      wsRef.current = new WebSocket(listenUrl);
      wsRef.current.binaryType = 'arraybuffer';

      wsRef.current.onopen = () => {
        setConnectionStatus('connected');
        setIsListening(true);
        console.log('Audio stream connected for:', student);
      };

      wsRef.current.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer && workletNodeRef.current) {
          const audioData = new Int16Array(event.data);
          workletNodeRef.current.port.postMessage(audioData);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error for', student, ':', error);
        setConnectionStatus('error');
        stopListening();
      };

      wsRef.current.onclose = () => {
        console.log('Audio stream disconnected for:', student);
        setConnectionStatus('disconnected');
        stopListening();
      };

    } catch (error) {
      console.error('Error starting audio stream for', student, ':', error);
      setConnectionStatus('error');
      stopListening();
    }
  };

  const stopListening = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsListening(false);
    setConnectionStatus('disconnected');
    setAudioLevel(0);
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    if (gainNodeRef.current && !isMuted) {
      gainNodeRef.current.gain.value = newVolume;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = !isMuted ? 0 : volume;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Live';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">{student}</h3>
            <p className="text-sm text-gray-600">Active conversation</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-gray-500">Duration</div>
            <div className="font-mono text-lg font-bold text-gray-800">
              {formatDuration(callDuration)}
            </div>
          </div>
          <div className={`flex items-center gap-1 text-sm font-semibold ${getStatusColor()}`}>
            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-gray-400'}`}></div>
            {getStatusText()}
          </div>
        </div>
      </div>

      {/* Audio Controls */}
      <div className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {isListening ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isListening ? 'Stop' : 'Listen'}
            </button>
            
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg transition-all duration-200 ${
                isMuted
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-20"
            />
          </div>
        </div>

        {/* Audio Level Indicator */}
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-gray-500" />
          <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-150"
              style={{ width: `${audioLevel * 100}%` }}
            ></div>
          </div>
          <span className="text-xs text-gray-500 w-8">{Math.round(audioLevel * 100)}%</span>
        </div>
      </div>

      {/* Connection Info */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span>Call ID: {callId}</span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            Monitoring
          </span>
        </div>
      </div>
    </div>
  );
}

const StatsSection = () => (
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
);

const StatCard = ({ icon, label, value, subtitle, color }) => (
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
);