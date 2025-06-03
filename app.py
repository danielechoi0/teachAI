import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
import os, requests, time, traceback
from flask_cors import CORS

load_dotenv()
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")
VAPI_KEY = os.getenv("VAPI_API_KEY")
API_URL = "https://api.vapi.ai"
PHONE_ID = os.getenv("VAPI_PHONE_NUMBER_ID")

# Store active calls for better tracking
active_calls = {}

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

        # Notify all teacher dashboards
        socketio.emit("new_call", call_info, namespace="/teacher")

        return jsonify({"success": True, "callId": call_id}), 201

    except Exception as e:
        print(f"❌ Error starting call: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    
@app.route("/get-grade", methods=["POST"])
def get_grade():
    try:
        data = request.get_json()
        tool_calls = data.get("message", {}).get("toolCallList", [])
        if not tool_calls or not isinstance(tool_calls, list):
            return jsonify({"error": "Invalid tool call format"}), 400

        tool_call = tool_calls[0]
        tool_call_id = tool_call.get("id")
        args = tool_call.get("function", {}).get("arguments", {})

        user_response = args.get("response", "").strip()
        current_grade = args.get("grade", "").strip()
        language = args.get("language", "").strip()
        question = args.get("question", "").strip()
        num_response = args.get("num_response", "").strip()

        prompt = f"""You are grading this user response in a conversation in {language}

                    Here is the current grade the user has been assigned based off their performance so far in this conversation: {current_grade}
                     
                    Given this response: {user_response} to this question/statement: {question}, assign scores from 0-100 for clarity, response quality, pronunciation, and grammar.
                    Then average the scores.
                    Calculate final score using this formula: [({current_grade} * {num_response}) + calculate averaged score] / ({num_response} + 1)
                      
                    Here's how to assign a final grade:
                    If final score is <60: assign final grade of F
                    If final score is >60 and <70: assign final grade of D
                    If final score is >70 and <80: assign final grade of C
                    If final score is >80 and <90: assign final grade of B
                    If final score is >90 and <=100: assign final grade of A

                    Your output should be solely the letter of the final grade. DO NOT RETURN ANYTHING ELSE -- no reasoning, no extra words.
                    """

        ollama_response = requests.post("http://localhost:11434/api/generate", json={
            "model": "llama3",  # Or another model you've pulled
            "prompt": prompt,
            "stream": False
        })

        if ollama_response.status_code != 200:
            return jsonify({"error": "Ollama call failed", "details": ollama_response.text}), 500

        result_text = ollama_response.json()["response"]

        return jsonify({
            "tool_call_id": tool_call_id,
            "grade_result": result_text
        })

    except Exception as e:
        print("Error:", e)
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/vapi-webhook", methods=["POST"])
def webhook():
    try:
        evt = request.json
        message = evt.get("message", {})
        message_type = message.get("type")
        call_data = message.get("call", {})
        
        # Extract call ID from the call object
        call_id = call_data.get("id")
        
        print(f"📨 Webhook received: {message_type} for call {call_id}")
        
        # Handle status updates
        if message_type == "status-update":
            status = message.get("status")
            
            if status == "ended":
                # Handle call ended - but DON'T remove from active_calls yet
                # We'll remove it after processing the end-of-call-report
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
                
                # Emit detailed call report to teachers
                socketio.emit("call_report", {
                    "callId": call_id,
                    "student": student_name,
                    "recordingUrl": recording_url,
                    "summary": summary,
                    "transcript": transcript,
                    "messages": messages,
                    "endedReason": ended_reason,
                    "timestamp": time.time()
                }, namespace="/teacher")
                
                print(f"📊 Call report sent for {student_name}")
                
                # Now remove from active calls since we've processed the report
                del active_calls[call_id]
                
            else:
                # Fallback: try to extract student info from call data if available
                # This depends on what's in your call object
                if call_data:
                    # You might need to adjust this based on your call object structure
                    # For example, if you store student info in call metadata
                    student_name = call_data.get("customer", {}).get("name") or "Unknown Student"
                
                socketio.emit("call_report", {
                    "callId": call_id,
                    "student": student_name,
                    "recordingUrl": recording_url,
                    "summary": summary,
                    "transcript": transcript,
                    "messages": messages,
                    "endedReason": ended_reason,
                    "timestamp": time.time()
                }, namespace="/teacher")
                
                print(f"📊 Call report sent for {student_name} (recovered from call data)")
            
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        traceback.print_exc()
    
    return "", 200

@app.route("/active-calls", methods=["GET"])
def get_active_calls():
    """Endpoint for teachers to get current active calls when they first connect"""
    return jsonify(list(active_calls.values()))

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
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)