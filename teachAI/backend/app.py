import eventlet
eventlet.monkey_patch()


from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
import os, requests, time, traceback, base64, io
from flask_cors import CORS


load_dotenv()
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")
VAPI_KEY = os.getenv("VAPI_API_KEY")
API_URL = "https://api.vapi.ai"
PHONE_ID = os.getenv("VAPI_PHONE_NUMBER_ID")


# OpenAI API key for Whisper transcription
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


# Store active calls for better tracking
active_calls = {}
# Store transcription context for each call
transcription_context = {}


def create_assistant(cfg):
    r = requests.post(
        f"{API_URL}/assistant",
        headers={"Authorization": VAPI_KEY, "Content-Type": "application/json"},
        json=cfg, timeout=15
    )
    r.raise_for_status()
    return r.json()["id"]


def start_call(assistant_id, student_name, student_number):
    r = requests.post(
        f"{API_URL}/call",
        headers={"Authorization": VAPI_KEY, "Content-Type": "application/json"},
        json={
            "phoneNumberId": PHONE_ID,
            "assistantId": assistant_id,
            "customer": {"name": student_name, "number": student_number},
        }, timeout=15
    )
    r.raise_for_status()
    return r.json()["id"]


def poll_listen_url(call_id, retries=30, delay=2):
    print(f"🔍 Polling for listenUrl for call {call_id}...")
    for attempt in range(retries):
        try:
            r = requests.get(
                f"{API_URL}/call/{call_id}",
                headers={"Authorization": VAPI_KEY},
                timeout=10
            )
            r.raise_for_status()
            s = r.json()
           
            url = s.get("monitor", {}).get("listenUrl")
            if url:
                print(f"✅ Got listenUrl on attempt {attempt + 1}: {url}")
                return url
           
            print(f"⏳ Attempt {attempt + 1}/{retries} - no listenUrl yet, retrying...")
            time.sleep(delay)
        except Exception as e:
            print(f"❌ Error on attempt {attempt + 1}: {e}")
            if attempt == retries - 1:
                raise
            time.sleep(delay)
   
    raise RuntimeError(f"listenUrl not ready after {retries} attempts")


def transcribe_audio_with_whisper(audio_data):
    """
    Transcribe audio using OpenAI's Whisper API
    """
    try:
        # Convert audio data to bytes
        audio_bytes = bytes(audio_data)
       
        # Create a file-like object
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "audio.wav"  # Whisper needs a filename
       
        # Send to OpenAI Whisper API
        response = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}"
            },
            files={
                "file": audio_file
            },
            data={
                "model": "whisper-1",
                "response_format": "text"
            },
            timeout=30
        )
       
        if response.status_code == 200:
            return response.text.strip()
        else:
            print(f"❌ Whisper API error: {response.status_code} - {response.text}")
            return None
           
    except Exception as e:
        print(f"❌ Error transcribing audio: {e}")
        return None


@app.route("/start-call", methods=["POST"])
def start_phone_call():
    try:
        data = request.get_json()
        cfg = data["assistantConfig"]
        student_name = data["studentName"]
        student_number = data["studentNumber"]


        print(f"📞 Starting call for {student_name} at {student_number}")
       
        # Create assistant and start call
        assistant_id = create_assistant(cfg)
       
        call_id = start_call(assistant_id, student_name, student_number)
       
        # Get streaming URL
        listen_url = poll_listen_url(call_id)


        # Store call info
        call_info = {
            "callId": call_id,
            "student": student_name,
            "listenUrl": listen_url,
            "startTime": time.time(),
            "assistantId": assistant_id
        }
        active_calls[call_id] = call_info
       
        # Initialize transcription context
        transcription_context[call_id] = {
            "segments": [],
            "current_grade": None,
            "segment_count": 0,
            "language": cfg.get("model", {}).get("messages", [{}])[0].get("content", "").lower()
        }


        # Notify all teacher dashboards
        socketio.emit("new_call", call_info, namespace="/teacher")


        return jsonify({"success": True, "callId": call_id}), 201


    except Exception as e:
        print(f"❌ Error starting call: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/transcribe-audio", methods=["POST"])
def transcribe_audio():
    """
    Endpoint to handle audio transcription requests
    """
    try:
        data = request.get_json()
        call_id = data.get("callId")
        audio_data = data.get("audioData")  # Array of bytes
        sample_rate = data.get("sampleRate", 16000)
       
        if not call_id or not audio_data:
            return jsonify({"error": "Missing callId or audioData"}), 400
       
        print(f"🎙️ Transcribing audio for call {call_id}")
       
        # Transcribe using Whisper
        transcript = transcribe_audio_with_whisper(audio_data)
       
        if transcript:
            print(f"📝 Transcription result: {transcript[:100]}...")
           
            # Store in context
            if call_id in transcription_context:
                transcription_context[call_id]["segments"].append({
                    "timestamp": time.time(),
                    "transcript": transcript
                })
           
            return jsonify({
                "success": True,
                "transcript": transcript
            })
        else:
            return jsonify({
                "success": False,
                "transcript": "",
                "error": "Transcription failed"
            })
           
    except Exception as e:
        print(f"❌ Error in transcribe_audio: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/grade-transcript", methods=["POST"])
def grade_transcript():
    try:
        data = request.get_json()
        call_id = data.get("callId")
        transcript = data.get("transcript", "").strip()
        current_grade = data.get("currentGrade")
        student = data.get("student", "Student")
       
        if not call_id or not transcript:
            return jsonify({"error": "Missing callId or transcript"}), 400
       
        # Get context for this call
        context = transcription_context.get(call_id, {})
        language = context.get("language", "english")
        segment_count = context.get("segment_count", 0)
       
        # Detect language from context if possible
        if "spanish" in language or "español" in language:
            detected_language = "Spanish"
        elif "french" in language or "français" in language:
            detected_language = "French"
        elif "german" in language or "deutsch" in language:
            detected_language = "German"
        else:
            detected_language = "English"
       
        print(f"📊 Grading transcript segment for {student} in {detected_language}")
       
        # If no current grade, start with a neutral score
        if current_grade is None:
            current_grade = "B"  # Start with B grade
       
        # Convert letter grade to numeric if needed
        grade_mapping = {"A": 95, "B": 85, "C": 75, "D": 65, "F": 55}
        if current_grade in grade_mapping:
            numeric_grade = grade_mapping[current_grade]
        else:
            try:
                numeric_grade = float(current_grade)
            except:
                numeric_grade = 85  # Default to B
       
        # Use HuggingFace API for grading - no fallback
        try:
            # Updated prompt for better results
            prompt = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a language learning assessment expert. Grade this {detected_language} conversation segment.

Current grade: {current_grade}
Student transcript: "{transcript}"

Evaluate fluency, grammar, vocabulary, and engagement. Respond with ONLY a single letter: A, B, C, D, or F.
<|end_header_id|><|start_header_id|>assistant<|end_header_id|>"""

            HF_API_URL = "https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-8B-Instruct"
            HF_API_KEY = os.getenv("HF_API_KEY")
            
            if not HF_API_KEY:
                raise ValueError("HF_API_KEY not found in environment variables")
            
            # Make HuggingFace API request
            headers = {
                "Authorization": f"Bearer {HF_API_KEY}",
                "Content-Type": "application/json"
            }

            payload = {
                "inputs": prompt,
                "parameters": {
                    "max_new_tokens": 10,
                    "temperature": 0.1,
                    "return_full_text": False
                }
            }

            hf_response = requests.post(
                HF_API_URL,
                headers=headers,
                json=payload,
                timeout=15
            )

            if hf_response.status_code == 200:
                result = hf_response.json()
                
                # Handle different response formats
                if isinstance(result, list) and len(result) > 0:
                    generated_text = result[0].get("generated_text", "").strip()
                else:
                    generated_text = str(result).strip()
                
                # Extract letter grade from response
                import re
                grade_match = re.search(r'\b([ABCDF])\b', generated_text.upper())
                if grade_match:
                    grade_result = grade_match.group(1)
                else:
                    raise ValueError(f"Could not extract valid grade from HF response: {generated_text}")
                    
                print(f"🤖 HF API response: {generated_text}")
                
            elif hf_response.status_code == 503:
                raise RuntimeError("Hugging Face model is currently loading. Please try again in a few minutes.")
            else:
                print("HF error", flush=True)
                raise RuntimeError(f"Hugging Face API error {hf_response.status_code}: {hf_response.text}")
                    
        except Exception as e:
            print(f"❌ HF API error: {e}")
            # Re-raise the exception instead of using fallback
            raise e
       
        # Update context
        if call_id in transcription_context:
            transcription_context[call_id]["current_grade"] = grade_result
            transcription_context[call_id]["segment_count"] = segment_count + 1
       
        print(f"📈 Final grade for {student}: {grade_result}")
       
        # Emit grade update to teachers
        socketio.emit("transcript_grade", {
            "callId": call_id,
            "student": student,
            "grade": grade_result,
            "transcript": transcript,
            "timestamp": time.time()
        }, namespace="/teacher")

        return jsonify({
            "success": True,
            "grade": grade_result,
            "segment_count": segment_count + 1
        })

    except Exception as e:
        print(f"❌ Error grading transcript: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/vapi-webhook", methods=["POST"])
def webhook():
    try:
        evt = request.json
        message = evt.get("message", {})
        message_type = message.get("type")
        call_data = message.get("call", {})
       
        call_id = call_data.get("id")
       
        print(f"📨 Webhook received: {message_type} for call {call_id}")
       
        if message_type == "status-update":
            status = message.get("status")
           
            if status == "ended":
                if call_id and call_id in active_calls:
                    student_name = active_calls[call_id]["student"]
                    duration = time.time() - active_calls[call_id]["startTime"]
                    print(f"📞 Call ended for {student_name} after {duration:.1f} seconds")
                   
                    # Mark as ended but keep the data for the report
                    active_calls[call_id]["ended"] = True
                    active_calls[call_id]["endTime"] = time.time()
                    active_calls[call_id]["duration"] = duration
                   
                    # Emit event to notify teachers
                    socketio.emit("call_ended", {
                        "callId": call_id,
                        "student": student_name,
                        "duration": duration,
                        "endTime": time.time()
                    }, namespace="/teacher")
                   
        # Handle end-of-call report
        elif message_type == "end-of-call-report":
            recording_url = message.get("recordingUrl")
            summary = message.get("summary")
            transcript = message.get("transcript")
            messages = message.get("messages", [])
            ended_reason = message.get("endedReason")
           
            student_name = None
           
            # Try to get student name from active_calls first
            if call_id and call_id in active_calls:
                student_name = active_calls[call_id]["student"]
               
                # Include transcription context in the report
                transcription_data = transcription_context.get(call_id, {})
               
                # Emit detailed call report to teachers
                socketio.emit("call_report", {
                    "callId": call_id,
                    "student": student_name,
                    "recordingUrl": recording_url,
                    "summary": summary,
                    "transcript": transcript,
                    "messages": messages,
                    "endedReason": ended_reason,
                    "timestamp": time.time(),
                    "transcriptionData": {
                        "finalGrade": transcription_data.get("current_grade"),
                        "segmentCount": transcription_data.get("segment_count", 0),
                        "segments": transcription_data.get("segments", [])
                    }
                }, namespace="/teacher")
               
                print(f"📊 Call report sent for {student_name}")
               
                # Clean up both active calls and transcription context
                del active_calls[call_id]
                if call_id in transcription_context:
                    del transcription_context[call_id]
               
            else:
                # Fallback: try to extract student info from call data if available
                if call_data:
                    student_name = call_data.get("customer", {}).get("name") or "Unknown Student"
               
                socketio.emit("call_report", {
                    "callId": call_id,
                    "student": student_name,
                    "recordingUrl": recording_url,
                    "summary": summary,
                    "transcript": transcript,
                    "messages": messages,
                    "endedReason": ended_reason,
                    "timestamp": time.time(),
                    "transcriptionData": None
                }, namespace="/teacher")
               
                print(f"📊 Call report sent for {student_name} (recovered from call data)")
               
                # Clean up transcription context if it exists
                if call_id in transcription_context:
                    del transcription_context[call_id]
           
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        traceback.print_exc()
   
    return "", 200


@app.route("/active-calls", methods=["GET"])
def get_active_calls():
    """Endpoint for teachers to get current active calls when they first connect"""
    return jsonify(list(active_calls.values()))


@app.route("/call-transcription/<call_id>", methods=["GET"])
def get_call_transcription(call_id):
    """Get transcription data for a specific call"""
    try:
        if call_id not in transcription_context:
            return jsonify({"error": "Call not found"}), 404
       
        transcription_data = transcription_context[call_id]
        return jsonify({
            "callId": call_id,
            "currentGrade": transcription_data.get("current_grade"),
            "segmentCount": transcription_data.get("segment_count", 0),
            "segments": transcription_data.get("segments", [])
        })
       
    except Exception as e:
        print(f"❌ Error getting transcription: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@socketio.on('connect', namespace='/teacher')
def teacher_connect():
    print("👨‍🏫 Teacher connected to dashboard")
    # Send current active calls to newly connected teacher
    emit("active_calls", list(active_calls.values()))


@socketio.on('disconnect', namespace='/teacher')
def teacher_disconnect():
    print("👨‍🏫 Teacher disconnected from dashboard")


if __name__ == "__main__":
    print("🚀 Starting Language Learning Hub backend...")
    print(f"📱 Using phone ID: {PHONE_ID}")
    print("🎙️ Transcription with OpenAI Whisper enabled")
    socketio.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))