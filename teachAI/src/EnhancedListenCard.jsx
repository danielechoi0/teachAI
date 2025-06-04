import { useState, useEffect, useRef } from "react";

const rate = 16000; // Hz
let audioContext = null;
let ws = null;
let gainNode = null;
let analyserNode = null;
let levelCheckInterval = null;

// Transcription buffers - Always collect audio, not just when transcribing
let audioBufferForTranscription = [];
let transcriptionInterval = null;

export default function EnhancedListenCard({ callId, student, listenUrl, startTime }) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("disconnected");
  const [audioLevel, setAudioLevel] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
 
  // Transcription states
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [currentGrade, setCurrentGrade] = useState(null);
  const [transcriptionHistory, setTranscriptionHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
 
  const timerRef = useRef();

  /** ----------------  call timer  ---------------- **/
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (startTime) setDuration(Math.floor(Date.now() / 1000 - startTime));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [startTime]);

  /** ----------------  transcription timer  ---------------- **/
  useEffect(() => {
    if (isTranscribing && isListening) {
      // Process immediately if we have audio data
      if (audioBufferForTranscription.length > 0) {
        processAudioBufferForTranscription();
      }
      
      // Then set up interval for ongoing processing
      transcriptionInterval = setInterval(() => {
        processAudioBufferForTranscription();
      }, 8000); // Every 8 seconds for more responsive grading
     
      return () => {
        if (transcriptionInterval) {
          clearInterval(transcriptionInterval);
          transcriptionInterval = null;
        }
      };
    }
  }, [isTranscribing, isListening]);

  /** ----------------  start / stop  ---------------- **/
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
      onAudioData: collectAudioForTranscription // Always collect audio
    }).catch((error) => {
      console.error("Audio start error:", error);
      setStatus("error");
    });
  };

  const stop = () => {
    stopAudio().finally(() => {
      setIsListening(false);
      setStatus("disconnected");
      setAudioLevel(0);
     
      // Clear transcription buffers
      audioBufferForTranscription = [];
      if (transcriptionInterval) {
        clearInterval(transcriptionInterval);
        transcriptionInterval = null;
      }
    });
  };

  /** ----------------  transcription functions  ---------------- **/
  const collectAudioForTranscription = (audioData) => {
    // Always collect audio data, regardless of transcription state
    audioBufferForTranscription.push(audioData);
   
    // Keep buffer manageable (last 20 seconds worth)
    const maxSamples = 20 * rate; // 20 seconds worth
    let totalSamples = audioBufferForTranscription.reduce((sum, chunk) => sum + chunk.length, 0);
   
    while (totalSamples > maxSamples && audioBufferForTranscription.length > 1) {
      const removedChunk = audioBufferForTranscription.shift();
      totalSamples -= removedChunk.length;
    }
  };

  const processAudioBufferForTranscription = async () => {
    if (audioBufferForTranscription.length === 0 || isProcessing) {
      console.log("⏸️ No audio data to process or already processing");
      return;
    }
   
    setIsProcessing(true);
    console.log("🎙️ Processing audio buffer for transcription...", {
      chunks: audioBufferForTranscription.length,
      totalSamples: audioBufferForTranscription.reduce((sum, chunk) => sum + chunk.length, 0)
    });
   
    try {
      // Combine all audio chunks into a single buffer
      const totalLength = audioBufferForTranscription.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedBuffer = new Float32Array(totalLength);
     
      let offset = 0;
      for (const chunk of audioBufferForTranscription) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }
     
      // Convert to WAV format for transcription
      const wavBuffer = encodeWAV(combinedBuffer, rate);
     
      console.log("📤 Sending audio for transcription...", {
        audioLengthSeconds: totalLength / rate,
        wavSizeKB: Math.round(wavBuffer.byteLength / 1024)
      });
      
      // Send to backend for transcription
      const response = await fetch('/transcribe-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callId: callId,
          audioData: Array.from(new Uint8Array(wavBuffer)),
          sampleRate: rate
        })
      });
     
      if (response.ok) {
        const result = await response.json();
        const transcript = result.transcript;
        
        console.log("📝 Transcription result:", transcript);
       
        if (transcript && transcript.trim().length > 5) { // Only process meaningful transcripts
          setCurrentTranscript(prev => prev + " " + transcript);
         
          console.log("📊 Sending for grading...");
          
          // Send for grading
          const gradeResponse = await fetch('/grade-transcript', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              callId: callId,
              transcript: transcript,
              currentGrade: currentGrade,
              student: student
            })
          });
         
          if (gradeResponse.ok) {
            const gradeResult = await gradeResponse.json();
            console.log("📈 Grade result:", gradeResult);
            
            setCurrentGrade(gradeResult.grade);
           
            // Add to history
            setTranscriptionHistory(prev => [...prev, {
              timestamp: Date.now(),
              transcript: transcript,
              grade: gradeResult.grade
            }]);
          } else {
            const errorText = await gradeResponse.text();
            console.error("❌ Grading failed:", gradeResponse.status, errorText);
          }
        } else {
          console.log("🔇 Transcript too short or empty, skipping grading");
        }
      } else {
        const errorText = await response.text();
        console.error("❌ Transcription failed:", response.status, errorText);
      }
     
      // Clear the buffer after processing
      audioBufferForTranscription = [];
     
    } catch (error) {
      console.error('❌ Error processing transcription:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleTranscription = () => {
    console.log("🔄 Toggling transcription:", !isTranscribing);
    setIsTranscribing(!isTranscribing);
    
    if (!isTranscribing) {
      // Reset transcription state when starting
      setCurrentTranscript("");
      setCurrentGrade(null);
      setTranscriptionHistory([]);
      console.log("🆕 Transcription state reset, starting grading...");
      
      // If we have audio data and are listening, process immediately
      if (isListening && audioBufferForTranscription.length > 0) {
        console.log("⚡ Processing existing audio data immediately...");
        setTimeout(() => processAudioBufferForTranscription(), 1000);
      }
    } else {
      // When stopping transcription, clear the buffer
      audioBufferForTranscription = [];
      console.log("⏹️ Transcription stopped, buffer cleared");
    }
  };

  /** ----------------  volume / mute  ---------------- **/
  useEffect(() => {
    if (!isListening || !gainNode) return;
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
          className="px-4 py-2 rounded text-white bg-indigo-600 hover:bg-indigo-700"
        >
          {isListening ? "Stop" : "Listen"}
        </button>

        {/* Transcription toggle */}
        <button
          onClick={toggleTranscription}
          disabled={!isListening}
          className={`px-3 py-1 rounded text-sm ${
            !isListening 
              ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              : isTranscribing 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
          }`}
        >
          {isTranscribing ? "🎙️ Grading Active" : "📝 Start Grading"}
        </button>

        {/* Current grade display */}
        {currentGrade && (
          <div className={`px-2 py-1 rounded text-sm font-medium ${
            currentGrade === 'A' ? 'bg-green-100 text-green-800' :
            currentGrade === 'B' ? 'bg-blue-100 text-blue-800' :
            currentGrade === 'C' ? 'bg-yellow-100 text-yellow-800' :
            currentGrade === 'D' ? 'bg-orange-100 text-orange-800' :
            'bg-red-100 text-red-800'
          }`}>
            Grade: {currentGrade}
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-sm animate-pulse">
            🔄 Processing...
          </div>
        )}

        {/* Audio buffer indicator */}
        {isListening && (
          <div className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
            Buffer: {audioBufferForTranscription.length} chunks
          </div>
        )}

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

      {/* Volume & mute */}
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

      {/* Transcription history */}
      {transcriptionHistory.length > 0 && (
        <div className="mt-2 p-2 bg-gray-50 rounded max-h-32 overflow-y-auto">
          <h4 className="text-sm font-medium mb-2">Recent Transcripts ({transcriptionHistory.length}):</h4>
          {transcriptionHistory.slice(-3).map((item, index) => (
            <div key={index} className="text-xs mb-1 p-1 bg-white rounded">
              <span className="font-medium text-blue-600">Grade {item.grade}:</span> 
              <span className="text-gray-700">{item.transcript}</span>
            </div>
          ))}
        </div>
      )}

      {/* Debug info */}
      {isTranscribing && (
        <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
          Status: {isTranscribing ? 'Active' : 'Inactive'} | 
          Processing: {isProcessing ? 'Yes' : 'No'} | 
          Audio chunks: {audioBufferForTranscription.length} | 
          Transcripts: {transcriptionHistory.length}
        </div>
      )}
    </div>
  );
}

// Helper function to encode audio as WAV (unchanged)
function encodeWAV(audioBuffer, sampleRate) {
  const length = audioBuffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(arrayBuffer);
 
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
 
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
 
  // Audio data
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, audioBuffer[i]));
    view.setInt16(offset, sample * 0x7FFF, true);
    offset += 2;
  }
 
  return arrayBuffer;
}

// Audio functions (unchanged from original)
async function startAudio(listenUrl, options = {}) {
    if (ws) {
        console.warn("Audio is already playing.");
        return;
    }

    const { volume = 1, onLevel, onStatus, onAudioData } = options;

    try {
        onStatus?.("connecting");
       
        audioContext = new AudioContext({ sampleRate: rate });

        await audioContext.audioWorklet.addModule('./audioProcessor.js');

        const audioNode = new AudioWorkletNode(audioContext, 'audio-processor', {
            outputChannelCount: [2],
        });

        gainNode = audioContext.createGain();
        gainNode.gain.value = volume;

        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

        // Connect the audio chain
        audioNode.connect(gainNode);
        gainNode.connect(analyserNode);
        analyserNode.connect(audioContext.destination);

        // Start audio level monitoring
        if (onLevel) {
            levelCheckInterval = setInterval(() => {
                analyserNode.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                onLevel(average / 255);
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

                // Send to audio playback
                audioNode.port.postMessage({ audioData: float32Array });
               
                // Also send to transcription if callback provided
                if (onAudioData) {
                    onAudioData(float32Array);
                }
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
   
    if (levelCheckInterval) {
        clearInterval(levelCheckInterval);
        levelCheckInterval = null;
    }
   
    if (transcriptionInterval) {
        clearInterval(transcriptionInterval);
        transcriptionInterval = null;
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
    audioBufferForTranscription = [];
}