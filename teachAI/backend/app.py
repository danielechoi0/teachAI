import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
import os, requests, time, traceback
from flask_cors import CORS
from supabase import create_client


load_dotenv()
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")
VAPI_KEY = os.getenv("VAPI_API_KEY")
API_URL = "https://api.vapi.ai"
PHONE_ID = os.getenv("VAPI_PHONE_NUMBER_ID")

# Store active calls for better tracking
active_calls = {}

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")     # service role → full insert rights
)

def db_exec(query, context=""):
    res = query.execute()
    if res.error:
        app.logger.error(f"Supabase error {context}: {res.error}")
        raise RuntimeError(res.error)      # bubble a 500
    return res.data

def save_assistant_to_db(vapi_id: str, cfg: dict, teacher_id: str | None = None):
    return db_exec(
        supabase.table("assistants")
        .upsert(
            {
                "vapi_id": vapi_id,
                "cfg": cfg,
                "teacher_id": teacher_id
            },
            on_conflict="vapi_id",      # ignore duplicates, update cfg if it changes
            returning="id,vapi_id"
        ),
        context="upsert assistants"
    )

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

@app.route("/create-assistant", methods=["POST"])
def create_assistant_endpoint():
    """Create a new assistant and return its ID"""
    try:
        cfg = request.get_json()
        
        # Validate required fields
        if not cfg or not cfg.get("model"):
            return jsonify({"error": "Missing assistant configuration"}), 400
        
        print(f"🤖 Creating assistant with config: {cfg}")
        
        # Create the assistant using the existing create_assistant function
        assistant_id = create_assistant(cfg)
        save_assistant_to_db(assistant_id, cfg, teacher_id=cfg.get("teacherId"))
        
        print(f"✅ Assistant created with ID: {assistant_id}")
        
        return jsonify({
            "success": True, 
            "assistantId": assistant_id,
            "message": "Assistant created successfully"
        }), 201
        
    except Exception as e:
        print(f"❌ Error creating assistant: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/assistants", methods=["GET"])
def list_assistants():
    try:
        res = (
            supabase
            .table("assistants")
            .select("id, vapi_id, cfg")  # Include cfg to extract name
            .order("created_at", desc=True)
            .execute()
        )

        if res.error:
            app.logger.error(f"Supabase error: {res.error}")
            return jsonify({"error": "Database error"}), 500

        # Format the response to include assistant names
        assistants = []
        for assistant in res.data:
            # Extract name from cfg or use a default
            name = "Unnamed Assistant"
            if assistant.get("cfg"):
                # Try to get name from various possible locations in cfg
                cfg = assistant["cfg"]
                if isinstance(cfg, dict):
                    name = (cfg.get("name") or 
                           cfg.get("firstMessage", "Assistant")[:30] + "..." if len(cfg.get("firstMessage", "")) > 30 
                           else cfg.get("firstMessage", "Assistant"))
            
            assistants.append({
                "id": assistant["vapi_id"],  # Use vapi_id as the ID for calls
                "name": name
            })

        return jsonify(assistants), 200

    except Exception as e:
        app.logger.exception("Unhandled error listing assistants")
        return jsonify({"error": str(e)}), 500

# Updated /start-call endpoint to accept assistantId instead of assistantConfig
@app.route("/start-call", methods=["POST"])
def start_phone_call():
    try:
        data = request.get_json()
        
        # Now expecting assistantId instead of assistantConfig
        assistant_id = data.get("assistantId")
        student_name = data.get("studentName")
        student_number = data.get("studentNumber")
        
        # Validate required fields
        if not assistant_id:
            return jsonify({"error": "Assistant ID is required"}), 400
        if not student_name:
            return jsonify({"error": "Student name is required"}), 400
        if not student_number:
            return jsonify({"error": "Student number is required"}), 400

        print(f"📞 Starting call for {student_name} at {student_number} with assistant {assistant_id}")
                
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

        # Insert call record into database
        supabase.table("calls").insert({
            "id": call_id,
            "assistant_id": assistant_id,  # This should match the vapi_id from assistants table
            "student_name": student_name,
            "listen_url": listen_url,
        }).execute()

        # Notify all teacher dashboards
        socketio.emit("new_call", call_info, namespace="/teacher")

        return jsonify({"success": True, "callId": call_id}), 201

    except Exception as e:
        print(f"❌ Error starting call: {e}")
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

                supabase.table("calls").update({
                    "summary": summary,
                    "recording_url": recording_url,
                    "transcript": transcript,
                    "duration_sec": active_calls[call_id]["duration"],
                }).eq("id", call_id).execute()
           
                
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

                supabase.table("calls").update({
                    "summary": summary,
                    "recording_url": recording_url,
                    "transcript": transcript,
                    "duration_sec": active_calls[call_id]["duration"],
                }).eq("id", call_id).execute()
                
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