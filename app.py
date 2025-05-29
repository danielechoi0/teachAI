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
        print(f"🤖 Created assistant: {assistant_id}")
        
        call_id = start_call(assistant_id, student_name, student_number)
        print(f"📱 Started call: {call_id}")
        
        # Get streaming URL
        listen_url = poll_listen_url(call_id)
        print(f"🎧 Got streaming URL: {listen_url}")

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
        print(f"✅ Notified teachers about new call for {student_name}")

        return jsonify({"success": True, "callId": call_id}), 201

    except Exception as e:
        print(f"❌ Error starting call: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/vapi-webhook", methods=["POST"])
def webhook():
    try:
        evt = request.json
        print(f"📨 Webhook received: {evt.get('type')} for call {evt.get('callId')}")
        
        if evt.get("type") == "call-end":
            call_id = evt.get("callId")
            if call_id in active_calls:
                student_name = active_calls[call_id]["student"]
                duration = time.time() - active_calls[call_id]["startTime"]
                print(f"📞 Call ended for {student_name} after {duration:.1f} seconds")
                
                # First emit the event to notify teachers
                socketio.emit("call_ended", {"callId": call_id, "student": student_name}, namespace="/teacher")
                
                # Then remove from active calls
                del active_calls[call_id]
            
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