import { useState, useEffect, useRef } from "react";

const rate = 16000; // Hz
let audioContext = null;
let ws = null;
let gainNode = null;
let analyserNode = null;
let levelCheckInterval = null;

export default function EnhancedListenCard({ callId, student, listenUrl, startTime }) {
  const [isListening, setIsListening]   = useState(false);
  const [status, setStatus]             = useState("disconnected");
  const [audioLevel, setAudioLevel]     = useState(0);
  const [volume, setVolume]             = useState(1);
  const [isMuted, setIsMuted]           = useState(false);
  const [duration, setDuration]         = useState(0);
  const timerRef = useRef();

  /** ----------------  call timer  ---------------- **/
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (startTime) setDuration(Math.floor(Date.now() / 1000 - startTime));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [startTime]);

  /** ----------------  start / stop  ---------------- **/
  const listen = () => {
    if (isListening || !listenUrl) return;
    setStatus("connecting");
    startAudio(listenUrl, {
      volume: isMuted ? 0 : volume,
      onLevel : setAudioLevel,
      onStatus: (s) => { setStatus(s); setIsListening(s === "connected"); }
    }).catch(() => setStatus("error"));
  };

  const stop = () => {
    stopAudio().finally(() => {
      setIsListening(false);
      setStatus("disconnected");
      setAudioLevel(0);
    });
  };

  /** ----------------  volume / mute  ---------------- **/
  useEffect(() => {
    if (!isListening || !gainNode) return;
    // Update gain node volume
    gainNode.gain.value = isMuted ? 0 : volume;
  }, [volume, isMuted, isListening]);

  /** ----------------  cleanup  ---------------- **/
  useEffect(() => stop, []);

  /** ----------------  UI  ---------------- **/
  return (
    <div className="border rounded-xl p-4 shadow flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{student}</h3>
        <span className="text-xs italic">{status}</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={isListening ? stop : listen}
          className="px-4 py-2 rounded text-white
                     bg-indigo-600 hover:bg-indigo-700"
        >
          {isListening ? "Stop" : "Listen"}
        </button>

        {/* VU-meter */}
        <div className="h-2 w-24 bg-gray-200 rounded overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${Math.min(1, audioLevel) * 100}%` }}
          />
        </div>

        {/* Call duration */}
        <span className="ml-auto text-sm text-gray-500">
          {new Date(duration * 1000).toISOString().substr(14, 5)}
        </span>
      </div>

      {/* volume & mute */}
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
    </div>
  );
}

async function startAudio(listenUrl, options = {}) {
    if (ws) {
        console.warn("Audio is already playing.");
        return;
    }

    const { volume = 1, onLevel, onStatus } = options;

    try {
        // Notify connecting
        onStatus?.("connecting");
        
        audioContext = new AudioContext({ sampleRate: rate });

        await audioContext.audioWorklet.addModule('./audioProcessor.js');

        // Create audio processing chain
        const audioNode = new AudioWorkletNode(audioContext, 'audio-processor', {
            outputChannelCount: [2],
        });

        // Create gain node for volume control
        gainNode = audioContext.createGain();
        gainNode.gain.value = volume;

        // Create analyser for audio level detection
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

        // Connect the audio chain: audioNode -> gainNode -> analyserNode -> destination
        audioNode.connect(gainNode);
        gainNode.connect(analyserNode);
        analyserNode.connect(audioContext.destination);

        // Start audio level monitoring
        if (onLevel) {
            levelCheckInterval = setInterval(() => {
                analyserNode.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                onLevel(average / 255); // Normalize to 0-1
            }, 100);
        }
        
        ws = new WebSocket(listenUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            onStatus?.("connected");
        };

        ws.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                const int16Array = new Int16Array(event.data);
                const float32Array = new Float32Array(int16Array.length);

                for (let i = 0; i < int16Array.length; i++) {
                    float32Array[i] = int16Array[i] / 32768.0;
                }

                audioNode.port.postMessage({ audioData: float32Array });
            }
        };

        ws.onclose = () => {
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
        stopAudio();
    }
}

async function stopAudio() {
    console.log("Stopping audio.");
    
    // Clear level monitoring
    if (levelCheckInterval) {
        clearInterval(levelCheckInterval);
        levelCheckInterval = null;
    }
    
    if (audioContext) {
        await audioContext.close();
        audioContext = null;
    }
    
    if (ws) {
        ws.close();
        ws = null;
    }
    
    gainNode = null;
    analyserNode = null;
}