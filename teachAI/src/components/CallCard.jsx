import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL

const rate = 16000; // Hz
let audioContext = null;
let ws = null;
let gainNode = null;
let analyserNode = null;
let levelCheckInterval = null;

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
    }).catch(() => setStatus("error"));
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

  return (
    <div className="border rounded-xl p-4 shadow flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{student}</h3>
        <span className="text-xs italic">{status}</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={isListening ? stop : listen}
          className="px-4 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700"
        >
          {isListening ? "Stop" : "Listen"}
        </button>

        <div className="h-2 w-24 bg-gray-200 rounded overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(1, audioLevel) * 100}%` }} />
        </div>

        <span className="ml-auto text-sm text-gray-500">
          {new Date(duration * 1000).toISOString().substr(14, 5)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(+e.target.value)}
          disabled={isMuted}
          className="flex-1"
        />
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="px-3 py-1 border rounded text-xs"
        >
          {isMuted ? "Un-mute" : "Mute"}
        </button>
      </div>

      {/* Only show messaging interface when listening */}
      {isListening && (
        <div className="border-t pt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Send message in real time:</label>
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message for the AI to speak..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md resize-none h-20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={isSending}
              />
              <button
                onClick={sendMessage}
                disabled={!message.trim() || !controlUrl || isSending}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed self-end"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`endCall-${callId}`}
                checked={endCallAfterSpoken}
                onChange={(e) => setEndCallAfterSpoken(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor={`endCall-${callId}`} className="text-sm text-gray-600">
                End call after message is spoken
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Send direct message to student (live):
              <span className="text-xs text-gray-500 ml-2">
                {socketRef.current?.connected ? "Connected" : "Not connected"}
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={directMessage}
                onChange={(e) => setDirectMessage(e.target.value)}
                onKeyPress={handleDirectKeyPress}
                placeholder="Type a live message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isDirectSending}
              />
              <button
                onClick={sendDirectMessage}
                disabled={!directMessage.trim() || isDirectSending || !socketRef.current?.connected}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isDirectSending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function startAudio(listenUrl, options = {}) {
  if (ws) return;
  const { volume = 1, onLevel, onStatus } = options;
  try {
    onStatus?.("connecting");
    audioContext = new AudioContext({ sampleRate: rate });
    await audioContext.audioWorklet.addModule('/audioProcessor.js');
    const audioNode = new AudioWorkletNode(audioContext, 'audio-processor', { outputChannelCount: [2] });
    
    gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    
    gainNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);
    
    if (onLevel) {
      levelCheckInterval = setInterval(() => {
        analyserNode.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        onLevel(avg / 255);
      }, 100);
    }

    ws = new WebSocket(listenUrl);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => onStatus?.("connected");
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const int16Array = new Int16Array(event.data);
        const float32Array = Float32Array.from(int16Array, i => i / 32768.0);
        audioNode.port.postMessage({ audioData: float32Array });
      }
    };
    ws.onclose = () => { onStatus?.("disconnected"); stopAudio(); };
    ws.onerror = (error) => { console.error("WebSocket error:", error); onStatus?.("error"); stopAudio(); };
  } catch (error) {
    console.error("Error starting audio:", error);
    onStatus?.("error");
    stopAudio();
  }
}

async function stopAudio() {
  if (levelCheckInterval) clearInterval(levelCheckInterval);
  if (audioContext) await audioContext.close();
  if (ws) ws.close();
  audioContext = null;
  gainNode = null;
  analyserNode = null;
  ws = null;
}