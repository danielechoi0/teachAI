import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

const rate = 16000; // Hz
let audioContext = null;
let ws = null;
let gainNode = null;
let analyserNode = null;
let levelCheckInterval = null;
let audioNode = null;

export default function EnhancedListenCard({ callId = "demo-call", student = "Demo Student", listenUrl = "", controlUrl = "", startTime = Date.now() / 1000 }) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("disconnected");
  const [audioLevel, setAudioLevel] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [endCallAfterSpoken, setEndCallAfterSpoken] = useState(false);
  const [directMessage, setDirectMessage] = useState("");
  const [isDirectSending, setIsDirectSending] = useState(false);
  const socketRef = useRef(null);
  const timerRef = useRef();

  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (startTime) setDuration(Math.floor(Date.now() / 1000 - startTime));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [startTime]);

  useEffect(() => {
    try {
      socketRef.current = io(BACKEND_URL, {
        timeout: 10000,
        transports: ['websocket', 'polling']
      });

      socketRef.current.on('connect', () => {
        console.log("Socket connected");
      });

      socketRef.current.on('disconnect', () => {
        console.log("Socket disconnected");
      });

      socketRef.current.on('connect_error', (error) => {
        console.error("Socket connection error:", error);
      });

    } catch (error) {
      console.error("Socket initialization error:", error);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const listen = () => {
    if (isListening || !listenUrl) return;
    setStatus("connecting");
    startAudio(listenUrl, {
      volume: isMuted ? 0 : volume,
      onLevel: setAudioLevel,
      onStatus: (s) => {
        setStatus(s);
        setIsListening(s === "connected");
      },
    }).catch((error) => {
      console.error("Error starting audio:", error);
      setStatus("error");
    });
  };

  const stop = () => {
    stopAudio().finally(() => {
      setIsListening(false);
      setStatus("disconnected");
      setAudioLevel(0);
    });
  };

  const sendMessage = async () => {
    if (!message.trim() || !controlUrl || isSending) return;
    setIsSending(true);
    try {
      const response = await fetch(`${BACKEND_URL}/send-control-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlUrl,
          message: message.trim(),
          endCallAfterSpoken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send message");
      }

      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const sendDirectMessage = () => {
    if (!directMessage.trim() || isDirectSending) return;
    
    if (!socketRef.current) {
      alert("Socket connection not available");
      return;
    }

    if (!socketRef.current.connected) {
      alert("Socket not connected. Please wait for connection.");
      return;
    }

    setIsDirectSending(true);
    
    const timeout = setTimeout(() => {
      setIsDirectSending(false);
      alert("Message send timeout. Please try again.");
    }, 10000);

    socketRef.current.emit("live_message", 
      { 
        callId, 
        message: directMessage.trim() 
      }, 
      (ack) => {
        clearTimeout(timeout);
        setIsDirectSending(false);
        
        if (ack?.error) {
          alert("Failed to send message: " + ack.error);
        } else {
          setDirectMessage("");
        }
      }
    );
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleDirectKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendDirectMessage();
    }
  };

  useEffect(() => {
    if (!isListening || !gainNode) return;
    gainNode.gain.value = isMuted ? 0 : volume;
  }, [volume, isMuted, isListening]);

  useEffect(() => stop, []);

  const getStatusColor = () => {
    switch (status) {
      case "connected": return "text-emerald-400";
      case "connecting": return "text-blue-400";
      case "error": return "text-red-400";
      default: return "text-zinc-500";
    }
  };

  return (
    <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-zinc-800 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-white text-xl">{student}</h3>
        <span className={`text-xs italic ${getStatusColor()}`}>{status}</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={isListening ? stop : listen}
          className={`px-6 py-3 rounded-xl text-white font-medium transition-all duration-300 shadow-lg ${
            isListening 
              ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 hover:shadow-xl hover:scale-[1.02]" 
              : "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 hover:shadow-xl hover:scale-[1.02]"
          }`}
        >
          {isListening ? "Stop" : "Listen"}
        </button>

        <div className="h-3 w-24 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-100" 
            style={{ width: `${Math.min(1, audioLevel) * 100}%` }} 
          />
        </div>

        <span className="ml-auto text-sm text-zinc-400 font-mono">
          {new Date(duration * 1000).toISOString().substr(14, 5)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(+e.target.value)}
          disabled={isMuted}
          className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer volume-slider"
          style={{
            background: `linear-gradient(to right, #059669 0%, #059669 ${volume * 100}%, #27272a ${volume * 100}%, #27272a 100%)`
          }}
        />
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
            isMuted 
              ? "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700" 
              : "bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 shadow-lg"
          }`}
        >
          {isMuted ? "Un-mute" : "Mute"}
        </button>
      </div>

      {/* Only show messaging interface when listening */}
      {isListening && (
        <div className="border-t border-zinc-800 pt-6 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-zinc-300">Send message in real time:</label>
            <div className="flex gap-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message for the AI to speak..."
                className="flex-1 px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-xl resize-none h-20 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-white placeholder-zinc-500 backdrop-blur-sm transition-all duration-300"
                disabled={isSending}
              />
              <button
                onClick={sendMessage}
                disabled={!message.trim() || !controlUrl || isSending}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl hover:from-emerald-700 hover:to-teal-800 disabled:from-zinc-700 disabled:to-zinc-800 disabled:cursor-not-allowed self-end shadow-lg transition-all duration-300 font-medium"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id={`endCall-${callId}`}
                checked={endCallAfterSpoken}
                onChange={(e) => setEndCallAfterSpoken(e.target.checked)}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-zinc-600 rounded bg-zinc-800 accent-emerald-600"
              />
              <label htmlFor={`endCall-${callId}`} className="text-sm text-zinc-400">
                End call after message is spoken
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-zinc-300">
              Send direct message to student (live):
              <span className={`text-xs ml-2 ${
                socketRef.current?.connected ? "text-emerald-400" : "text-red-400"
              }`}>
                {socketRef.current?.connected ? "Connected" : "Not connected"}
              </span>
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={directMessage}
                onChange={(e) => setDirectMessage(e.target.value)}
                onKeyPress={handleDirectKeyPress}
                placeholder="Type a live message..."
                className="flex-1 px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-zinc-500 backdrop-blur-sm transition-all duration-300"
                disabled={isDirectSending}
              />
              <button
                onClick={sendDirectMessage}
                disabled={!directMessage.trim() || isDirectSending || !socketRef.current?.connected}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 disabled:from-zinc-700 disabled:to-zinc-800 disabled:cursor-not-allowed shadow-lg transition-all duration-300 font-medium"
              >
                {isDirectSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .volume-slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          transition: all 0.2s;
        }
        
        .volume-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          background: #059669;
        }
        
        .volume-slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}

async function startAudio(listenUrl, options = {}) {
  if (ws) return;
  const { volume = 1, onLevel, onStatus } = options;
  
  try {
    onStatus?.("connecting");
    
    // Create audio context
    audioContext = new AudioContext({ sampleRate: rate });
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
      console.log("Audio context resumed");
    }
    
    // Add audio worklet module
    await audioContext.audioWorklet.addModule('/audioProcessor.js');
    
    // Create audio worklet node
    audioNode = new AudioWorkletNode(audioContext, 'audio-processor', { 
      outputChannelCount: [2] 
    });
    
    gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    
    audioNode.connect(gainNode);
    gainNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);
    
    console.log("Audio nodes connected successfully");
    
    // Set up audio level monitoring
    if (onLevel) {
      levelCheckInterval = setInterval(() => {
        analyserNode.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        onLevel(avg / 255);
      }, 100);
    }

    ws = new WebSocket(listenUrl);
    ws.binaryType = 'arraybuffer';
    
    ws.onopen = () => {
      console.log("WebSocket connected");
      onStatus?.("connected");
    };
    
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer && audioNode) {
        try {
          const int16Array = new Int16Array(event.data);
          const float32Array = Float32Array.from(int16Array, i => i / 32768.0);
          audioNode.port.postMessage({ audioData: float32Array });
        } catch (error) {
          console.error("Error processing audio data:", error);
        }
      }
    };
    
    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      onStatus?.("disconnected");
      stopAudio();
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      onStatus?.("error");
      stopAudio();
    };
    
  } catch (error) {
    console.error("Error starting audio:", error);
    onStatus?.("error");
    await stopAudio();
    throw error;
  }
}

async function stopAudio() {
  console.log("Stopping audio...");
  
  if (levelCheckInterval) {
    clearInterval(levelCheckInterval);
    levelCheckInterval = null;
  }
  
  if (ws) {
    ws.close();
    ws = null;
  }
  
  try {
    if (audioNode) {
      audioNode.disconnect();
      audioNode = null;
    }
    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }
    if (analyserNode) {
      analyserNode.disconnect();
      analyserNode = null;
    }
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }
  } catch (error) {
    console.error("Error cleaning up audio:", error);
  }
  
  console.log("Audio stopped and cleaned up");
}