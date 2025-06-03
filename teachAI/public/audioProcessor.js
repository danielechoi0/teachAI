// audioProcessor.js
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.audioBuffer = new Float32Array();
        this.port.onmessage = (msg) => {
            const receivedAudio = msg.data.audioData;
            const expandedBuffer = new Float32Array(this.audioBuffer.length + receivedAudio.length);
            expandedBuffer.set(this.audioBuffer, 0);
            expandedBuffer.set(receivedAudio, this.audioBuffer.length);
            this.audioBuffer = expandedBuffer;
        };
    }
    process(inputs, outputs) {
        const stereoOut = outputs[0]; // Stereo output channels array
        const leftOut = stereoOut[0]; // Left output channel
        const rightOut = stereoOut[1]; // Right output channel (for stereo playback)
        if (!leftOut) return true; 
        for (let sampleIdx = 0; sampleIdx < leftOut.length; sampleIdx++) {
        
            leftOut[sampleIdx] = this.audioBuffer[sampleIdx * 2] || 0;
           
            if (rightOut) {
                rightOut[sampleIdx] = this.audioBuffer[sampleIdx * 2 + 1] || 0;
            }
        }
        
        this.audioBuffer = this.audioBuffer.slice(leftOut.length * 2);
        return true; 
    }
}
registerProcessor('audio-processor', AudioProcessor);