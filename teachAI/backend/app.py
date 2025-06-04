import eventlet
eventlet.monkey_patch()

import logging
import logging.handlers
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
import os, requests, time, traceback, base64, io
from flask_cors import CORS
from datetime import datetime

# Configure logging
def setup_logging():
    # Check if running on Render (or similar cloud platform)
    is_production = os.getenv('RENDER') or os.getenv('RAILWAY_ENVIRONMENT') or os.getenv('HEROKU')
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
    )
    
    # Create root logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Console handler (always present - shows in Render logs)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Only create file handlers if not in production or if explicitly requested
    if not is_production or os.getenv('ENABLE_FILE_LOGGING') == 'true':
        # Create logs directory if it doesn't exist
        os.makedirs('logs', exist_ok=True)
        
        # File handler with rotation
        file_handler = logging.handlers.RotatingFileHandler(
            'logs/app.log',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.INFO)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        # Error file handler
        error_handler = logging.handlers.RotatingFileHandler(
            'logs/errors.log',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(formatter)
        logger.addHandler(error_handler)
        
        # API calls handler (separate log for API interactions)
        api_handler = logging.handlers.RotatingFileHandler(
            'logs/api_calls.log',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        api_handler.setLevel(logging.INFO)
        api_handler.setFormatter(formatter)
        
        # Create separate logger for API calls
        api_logger = logging.getLogger('api_calls')
        api_logger.setLevel(logging.INFO)
        api_logger.addHandler(api_handler)
        api_logger.propagate = False
    else:
        # In production, API logger just writes to console
        api_logger = logging.getLogger('api_calls')
        api_logger.setLevel(logging.INFO)
        # Will use root logger's console handler
    
    return logger

# Setup logging
logger = setup_logging()
api_logger = logging.getLogger('api_calls')

load_dotenv()
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Log Flask app startup
logger.info("Flask application initializing...")

VAPI_KEY = os.getenv("VAPI_API_KEY")
API_URL = "https://api.vapi.ai"
PHONE_ID = os.getenv("VAPI_PHONE_NUMBER_ID")

# OpenAI API key for Whisper transcription
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Log configuration
logger.info(f"VAPI API URL: {API_URL}")
logger.info(f"Phone ID configured: {'Yes' if PHONE_ID else 'No'}")
logger.info(f"OpenAI API Key configured: {'Yes' if OPENAI_API_KEY else 'No'}")
logger.info(f"VAPI Key configured: {'Yes' if VAPI_KEY else 'No'}")

# Store active calls for better tracking
active_calls = {}
# Store transcription context for each call
transcription_context = {}

def create_assistant(cfg):
    logger.info("Creating new assistant...")
    api_logger.info(f"POST {API_URL}/assistant - Creating assistant")
    
    try:
        r = requests.post(
            f"{API_URL}/assistant",
            headers={"Authorization": VAPI_KEY, "Content-Type": "application/json"},
            json=cfg, timeout=15
        )
        
        api_logger.info(f"Assistant creation response: {r.status_code}")
        r.raise_for_status()
        
        assistant_data = r.json()
        assistant_id = assistant_data["id"]
        
        logger.info(f"Assistant created successfully with ID: {assistant_id}")
        api_logger.info(f"Assistant created: {assistant_id}")
        
        return assistant_id
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to create assistant: {e}")
        api_logger.error(f"Assistant creation failed: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating assistant: {e}")
        raise

def start_call(assistant_id, student_name, student_number):
    logger.info(f"Starting call for student: {student_name} at {student_number}")
    api_logger.info(f"POST {API_URL}/call - Starting call for {student_name}")
    
    try:
        call_payload = {
            "phoneNumberId": PHONE_ID,
            "assistantId": assistant_id,
            "customer": {"name": student_name, "number": student_number},
        }
        
        r = requests.post(
            f"{API_URL}/call",
            headers={"Authorization": VAPI_KEY, "Content-Type": "application/json"},
            json=call_payload, timeout=15
        )
        
        api_logger.info(f"Call start response: {r.status_code}")
        r.raise_for_status()
        
        call_data = r.json()
        call_id = call_data["id"]
        
        logger.info(f"Call started successfully with ID: {call_id}")
        api_logger.info(f"Call started: {call_id} for {student_name}")
        
        return call_id
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to start call for {student_name}: {e}")
        api_logger.error(f"Call start failed for {student_name}: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error starting call for {student_name}: {e}")
        raise

def poll_listen_url(call_id, retries=30, delay=2):
    logger.info(f"Polling for listenUrl for call {call_id} (max {retries} attempts)")
    
    for attempt in range(retries):
        try:
            api_logger.info(f"GET {API_URL}/call/{call_id} - Attempt {attempt + 1}")
            
            r = requests.get(
                f"{API_URL}/call/{call_id}",
                headers={"Authorization": VAPI_KEY},
                timeout=10
            )
            r.raise_for_status()
            s = r.json()
           
            url = s.get("monitor", {}).get("listenUrl")
            if url:
                logger.info(f"Got listenUrl on attempt {attempt + 1}: {url}")
                api_logger.info(f"ListenUrl obtained for call {call_id} on attempt {attempt + 1}")
                return url
           
            logger.debug(f"Attempt {attempt + 1}/{retries} - no listenUrl yet, retrying in {delay}s...")
            time.sleep(delay)
            
        except Exception as e:
            logger.warning(f"Error on attempt {attempt + 1}: {e}")
            api_logger.warning(f"Poll attempt {attempt + 1} failed for call {call_id}: {e}")
            
            if attempt == retries - 1:
                logger.error(f"Failed to get listenUrl after {retries} attempts")
                raise
            time.sleep(delay)
   
    error_msg = f"listenUrl not ready after {retries} attempts"
    logger.error(error_msg)
    raise RuntimeError(error_msg)

def transcribe_audio_with_whisper(audio_data):
    """
    Transcribe audio using OpenAI's Whisper API
    """
    logger.info("Starting audio transcription with Whisper")
    api_logger.info("POST https://api.openai.com/v1/audio/transcriptions - Whisper transcription")
    
    try:
        # Convert audio data to bytes
        audio_bytes = bytes(audio_data)
        logger.debug(f"Audio data size: {len(audio_bytes)} bytes")
       
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
       
        api_logger.info(f"Whisper API response: {response.status_code}")
        
        if response.status_code == 200:
            transcript = response.text.strip()
            logger.info(f"Transcription successful: {len(transcript)} characters")
            logger.debug(f"Transcript preview: {transcript[:100]}...")
            return transcript
        else:
            logger.error(f"Whisper API error: {response.status_code} - {response.text}")
            api_logger.error(f"Whisper API failed: {response.status_code} - {response.text}")
            return None
           
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        api_logger.error(f"Whisper transcription error: {e}")
        return None

@app.route("/start-call", methods=["POST"])
def start_phone_call():
    logger.info("Received start-call request")
    
    try:
        data = request.get_json()
        logger.debug(f"Request data keys: {list(data.keys()) if data else 'None'}")
        
        cfg = data["assistantConfig"]
        student_name = data["studentName"]
        student_number = data["studentNumber"]

        logger.info(f"Starting call for {student_name} at {student_number}")
       
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
        
        logger.info(f"Call {call_id} added to active calls. Total active: {len(active_calls)}")
       
        # Initialize transcription context
        transcription_context[call_id] = {
            "segments": [],
            "current_grade": None,
            "segment_count": 0,
            "language": cfg.get("model", {}).get("messages", [{}])[0].get("content", "").lower()
        }
        
        logger.info(f"Transcription context initialized for call {call_id}")

        # Notify all teacher dashboards
        socketio.emit("new_call", call_info, namespace="/teacher")
        logger.info(f"Emitted new_call event for {student_name}")

        return jsonify({"success": True, "callId": call_id}), 201

    except KeyError as e:
        logger.error(f"Missing required field in request: {e}")
        return jsonify({"error": f"Missing required field: {e}"}), 400
    except Exception as e:
        logger.error(f"Error starting call: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route("/transcribe-audio", methods=["POST"])
def transcribe_audio():
    """
    Endpoint to handle audio transcription requests
    """
    logger.info("Received transcribe-audio request")
    
    try:
        data = request.get_json()
        call_id = data.get("callId")
        audio_data = data.get("audioData")  # Array of bytes
        sample_rate = data.get("sampleRate", 16000)
        
        logger.debug(f"Transcription request - Call ID: {call_id}, Sample rate: {sample_rate}")
       
        if not call_id or not audio_data:
            logger.warning("Missing callId or audioData in transcription request")
            return jsonify({"error": "Missing callId or audioData"}), 400
       
        logger.info(f"Transcribing audio for call {call_id}")
       
        # Transcribe using Whisper
        transcript = transcribe_audio_with_whisper(audio_data)
       
        if transcript:
            logger.info(f"Transcription successful for call {call_id}: {len(transcript)} characters")
           
            # Store in context
            if call_id in transcription_context:
                transcription_context[call_id]["segments"].append({
                    "timestamp": time.time(),
                    "transcript": transcript
                })
                logger.debug(f"Transcript segment added to context for call {call_id}")
            else:
                logger.warning(f"Call {call_id} not found in transcription context")
           
            return jsonify({
                "success": True,
                "transcript": transcript
            })
        else:
            logger.warning(f"Transcription failed for call {call_id}")
            return jsonify({
                "success": False,
                "transcript": "",
                "error": "Transcription failed"
            })
           
    except Exception as e:
        logger.error(f"Error in transcribe_audio: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route("/grade-transcript", methods=["POST"])
def grade_transcript():
    logger.info("Received grade-transcript request")
    
    try:
        data = request.get_json()
        call_id = data.get("callId")
        transcript = data.get("transcript", "").strip()
        current_grade = data.get("currentGrade")
        student = data.get("student", "Student")
        
        logger.debug(f"Grading request - Call ID: {call_id}, Student: {student}, Current grade: {current_grade}")
       
        if not call_id or not transcript:
            logger.warning("Missing callId or transcript in grading request")
            return jsonify({"error": "Missing callId or transcript"}), 400
       
        # Get context for this call
        context = transcription_context.get(call_id, {})
        language = context.get("language", "english")
        segment_count = context.get("segment_count", 0)
        
        logger.debug(f"Context - Language: {language}, Segment count: {segment_count}")
       
        # Detect language from context if possible
        if "spanish" in language or "español" in language:
            detected_language = "Spanish"
        elif "french" in language or "français" in language:
            detected_language = "French"
        elif "german" in language or "deutsch" in language:
            detected_language = "German"
        else:
            detected_language = "English"
       
        logger.info(f"Grading transcript segment for {student} in {detected_language}")
       
        # If no current grade, start with a neutral score
        if current_grade is None:
            current_grade = "B"  # Start with B grade
            logger.debug("No current grade provided, starting with B")
       
        # Convert letter grade to numeric if needed
        grade_mapping = {"A": 95, "B": 85, "C": 75, "D": 65, "F": 55}
        if current_grade in grade_mapping:
            numeric_grade = grade_mapping[current_grade]
        else:
            try:
                numeric_grade = float(current_grade)
            except:
                numeric_grade = 85  # Default to B
                logger.warning(f"Invalid grade format: {current_grade}, defaulting to 85")
       
        # Use HuggingFace API for grading - no fallback
        try:
            # Updated prompt for better results
            prompt = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a language learning assessment expert. Grade this {detected_language} conversation segment.

Current grade: {current_grade}
Student transcript: "{transcript}"

Evaluate fluency, grammar, vocabulary, and engagement. Respond with ONLY a single letter: A, B, C, D, or F.
<|end_header_id|><|start_header_id|>assistant<|end_header_id|>"""
            
            logger.info("Sending request to HuggingFace API for grading")
            api_logger.info(f"POST HuggingFace API - Grading request for call {call_id}")

            HF_API_URL = "https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-8B-Instruct"
            HF_API_KEY = os.getenv("HF_API_KEY")
            
            if not HF_API_KEY:
                logger.error("HF_API_KEY not found in environment variables")
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

            api_logger.info(f"HuggingFace API response: {hf_response.status_code}")

            if hf_response.status_code == 200:
                result = hf_response.json()
                logger.debug(f"HF API raw response: {result}")
                
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
                    logger.info(f"Extracted grade: {grade_result} from response: {generated_text}")
                else:
                    logger.error(f"Could not extract valid grade from HF response: {generated_text}")
                    raise ValueError(f"Could not extract valid grade from HF response: {generated_text}")
                    
                api_logger.info(f"Grading successful: {grade_result} for call {call_id}")
                
            elif hf_response.status_code == 503:
                logger.warning("Hugging Face model is currently loading")
                api_logger.warning("HuggingFace model loading - service unavailable")
                raise RuntimeError("Hugging Face model is currently loading. Please try again in a few minutes.")
            else:
                logger.error(f"HuggingFace API error {hf_response.status_code}: {hf_response.text}")
                api_logger.error(f"HuggingFace API failed: {hf_response.status_code} - {hf_response.text}")
                raise RuntimeError(f"Hugging Face API error {hf_response.status_code}: {hf_response.text}")
                    
        except Exception as e:
            logger.error(f"HF API error: {e}")
            # Re-raise the exception instead of using fallback
            raise e
       
        # Update context
        if call_id in transcription_context:
            transcription_context[call_id]["current_grade"] = grade_result
            transcription_context[call_id]["segment_count"] = segment_count + 1
            logger.debug(f"Updated context for call {call_id}: grade={grade_result}, segments={segment_count + 1}")
        else:
            logger.warning(f"Call {call_id} not found in transcription context during grade update")
       
        logger.info(f"Final grade for {student}: {grade_result}")
       
        # Emit grade update to teachers
        socketio.emit("transcript_grade", {
            "callId": call_id,
            "student": student,
            "grade": grade_result,
            "transcript": transcript,
            "timestamp": time.time()
        }, namespace="/teacher")
        
        logger.info(f"Emitted transcript_grade event for {student}")

        return jsonify({
            "success": True,
            "grade": grade_result,
            "segment_count": segment_count + 1
        })

    except Exception as e:
        logger.error(f"Error grading transcript: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route("/vapi-webhook", methods=["POST"])
def webhook():
    logger.info("Received VAPI webhook")
    
    try:
        evt = request.json
        message = evt.get("message", {})
        message_type = message.get("type")
        call_data = message.get("call", {})
       
        call_id = call_data.get("id")
        
        logger.info(f"Webhook - Type: {message_type}, Call ID: {call_id}")
        api_logger.info(f"VAPI webhook received: {message_type} for call {call_id}")
       
        if message_type == "status-update":
            status = message.get("status")
            logger.info(f"Status update for call {call_id}: {status}")
           
            if status == "ended":
                if call_id and call_id in active_calls:
                    student_name = active_calls[call_id]["student"]
                    duration = time.time() - active_calls[call_id]["startTime"]
                    logger.info(f"Call ended for {student_name} after {duration:.1f} seconds")
                   
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
                    
                    logger.info(f"Emitted call_ended event for {student_name}")
                else:
                    logger.warning(f"Call {call_id} not found in active calls during end status")
                   
        # Handle end-of-call report
        elif message_type == "end-of-call-report":
            logger.info(f"Processing end-of-call report for call {call_id}")
            
            recording_url = message.get("recordingUrl")
            summary = message.get("summary")
            transcript = message.get("transcript")
            messages = message.get("messages", [])
            ended_reason = message.get("endedReason")
            
            logger.debug(f"Report details - Recording: {'Yes' if recording_url else 'No'}, "
                        f"Summary: {'Yes' if summary else 'No'}, "
                        f"Transcript: {'Yes' if transcript else 'No'}, "
                        f"Messages: {len(messages)}, "
                        f"Ended reason: {ended_reason}")
           
            student_name = None
           
            # Try to get student name from active_calls first
            if call_id and call_id in active_calls:
                student_name = active_calls[call_id]["student"]
                logger.info(f"Found student name from active calls: {student_name}")
               
                # Include transcription context in the report
                transcription_data = transcription_context.get(call_id, {})
                logger.debug(f"Transcription data available: {bool(transcription_data)}")
               
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
               
                logger.info(f"Call report sent for {student_name}")
               
                # Clean up both active calls and transcription context
                del active_calls[call_id]
                if call_id in transcription_context:
                    del transcription_context[call_id]
                    
                logger.info(f"Cleaned up data for call {call_id}. Remaining active calls: {len(active_calls)}")
               
            else:
                logger.warning(f"Call {call_id} not found in active calls, using fallback")
                
                # Fallback: try to extract student info from call data if available
                if call_data:
                    student_name = call_data.get("customer", {}).get("name") or "Unknown Student"
                    logger.info(f"Recovered student name from call data: {student_name}")
               
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
               
                logger.info(f"Call report sent for {student_name} (recovered from call data)")
               
                # Clean up transcription context if it exists
                if call_id in transcription_context:
                    del transcription_context[call_id]
                    logger.debug(f"Cleaned up transcription context for call {call_id}")
        else:
            logger.debug(f"Unhandled webhook message type: {message_type}")
           
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        logger.error(traceback.format_exc())
   
    return "", 200

@app.route("/active-calls", methods=["GET"])
def get_active_calls():
    """Endpoint for teachers to get current active calls when they first connect"""
    logger.info(f"Active calls requested - returning {len(active_calls)} calls")
    return jsonify(list(active_calls.values()))

@app.route("/call-transcription/<call_id>", methods=["GET"])
def get_call_transcription(call_id):
    """Get transcription data for a specific call"""
    logger.info(f"Transcription data requested for call {call_id}")
    
    try:
        if call_id not in transcription_context:
            logger.warning(f"Call {call_id} not found in transcription context")
            return jsonify({"error": "Call not found"}), 404
       
        transcription_data = transcription_context[call_id]
        logger.info(f"Returning transcription data for call {call_id}")
        
        return jsonify({
            "callId": call_id,
            "currentGrade": transcription_data.get("current_grade"),
            "segmentCount": transcription_data.get("segment_count", 0),
            "segments": transcription_data.get("segments", [])
        })
       
    except Exception as e:
        logger.error(f"Error getting transcription for call {call_id}: {e}")
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@socketio.on('connect', namespace='/teacher')
def teacher_connect():
    logger.info("Teacher connected to dashboard")
    # Send current active calls to newly connected teacher
    emit("active_calls", list(active_calls.values()))
    logger.info(f"Sent {len(active_calls)} active calls to newly connected teacher")

@socketio.on('disconnect', namespace='/teacher')
def teacher_disconnect():
    logger.info("Teacher disconnected from dashboard")

# Add request logging middleware
@app.before_request
def log_request_info():
    logger.debug(f"Request: {request.method} {request.path} from {request.remote_addr}")

@app.after_request
def log_response_info(response):
    logger.debug(f"Response: {response.status_code} for {request.method} {request.path}")
    return response

if __name__ == "__main__":
    logger.info("🚀 Starting Language Learning Hub backend...")
    logger.info(f"📱 Using phone ID: {PHONE_ID}")
    logger.info("🎙️ Transcription with OpenAI Whisper enabled")
    logger.info("📝 Comprehensive logging enabled")
    
    # Check environment and log accordingly
    is_production = os.getenv('RENDER') or os.getenv('RAILWAY_ENVIRONMENT') or os.getenv('HEROKU')
    if is_production:
        logger.info("🌐 Running in production mode - logs visible in platform dashboard")
    else:
        logger.info("📁 Development mode - logs written to: logs/app.log, logs/errors.log, logs/api_calls.log")
    
    # Log system info
    logger.info(f"Working directory: {os.getcwd()}")
    logger.info(f"Python version: {os.sys.version}")
    logger.info(f"Environment: {'Production' if is_production else 'Development'}")
    
    port = int(os.environ.get("PORT", 5000))
    logger.info(f"Starting server on port {port}")
    
    socketio.run(app, host="0.0.0.0", port=port)