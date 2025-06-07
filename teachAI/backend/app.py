import eventlet

eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
import os, requests, time, traceback, mimetypes
from flask_cors import CORS
from supabase import create_client

load_dotenv()

app = Flask(__name__)
CORS(app, origins="*", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "Authorization"])
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')


VAPI_KEY = os.getenv("VAPI_API_KEY")
API_URL = "https://api.vapi.ai"
PHONE_ID = os.getenv("VAPI_PHONE_NUMBER_ID")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def current_teacher(request) -> str:
    try:
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip()
        if not token:
            raise PermissionError("Missing bearer token")
        
        response = supabase.auth.get_user(token)
        if not response.user:
            raise PermissionError("Invalid token")
        return response.user.id
    except Exception as e:
        app.logger.warning(f"Auth failed: {e}")
        raise PermissionError("Authentication failed")

def db_exec(query, *, context: str = ""):
    """Execute Supabase‑py v2 call, raise on error, return payload."""
    res = query.execute()
    api_error = getattr(res, "error", None)
    if api_error is None and isinstance(res, dict):
        api_error = res.get("error")
    if api_error:
        app.logger.error(f"Supabase {context} error → {api_error}")
        raise RuntimeError(api_error)
    return res.data if hasattr(res, "data") else res.get("data", res)

def create_assistant(cfg: dict) -> str:
    r = requests.post(f"{API_URL}/assistant", headers={"Authorization": VAPI_KEY, "Content-Type": "application/json"}, json=cfg, timeout=15)
    r.raise_for_status()
    return r.json()["id"]


def start_call(assistant_id: str, student_name: str, student_number: str) -> str:
    r = requests.post(
        f"{API_URL}/call",
        headers={"Authorization": VAPI_KEY, "Content-Type": "application/json"},
        json={"phoneNumberId": PHONE_ID, "assistantId": assistant_id, "customer": {"name": student_name, "number": student_number}},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["id"]


def upload_file_to_vapi(file_storage) -> dict:
    filename = file_storage.filename
    content_type = file_storage.mimetype or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    files = {"file": (filename, file_storage.stream, content_type)}
    r = requests.post(f"{API_URL}/file", headers={"Authorization": f"Bearer {VAPI_KEY}"}, files=files, timeout=60)
    r.raise_for_status()
    return r.json()


def poll_listen_url(call_id: str, *, retries: int = 30, delay: int = 2) -> str:
    for _ in range(retries):
        r = requests.get(f"{API_URL}/call/{call_id}", headers={"Authorization": VAPI_KEY}, timeout=10)
        r.raise_for_status()
        url = r.json().get("monitor", {}).get("listenUrl")
        if url:
            return url
        time.sleep(delay)
    raise RuntimeError("listenUrl not ready in time")

active_calls: dict[str, dict] = {}

@app.route("/upload-file", methods=["POST", "OPTIONS"])
def upload_file():
    """Teachers upload knowledge‑base files ➜ get Vapi fileId.
    Returns: { provider: "google", name: "...", description: "...", fileIds: ["..."] }
    """
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
        response.headers.add("Access-Control-Allow-Methods", "POST,OPTIONS")
        return response

    try:
        if "file" not in request.files:
            return jsonify({"error": "No file field"}), 400
        f = request.files["file"]
        if not f.filename:
            return jsonify({"error": "Empty filename"}), 400

        # Grab name and description from the form
        name = request.form.get("name", f.filename)
        description = request.form.get("description", "")

        # Upload to Vapi using existing helper
        vapi_resp = upload_file_to_vapi(f)
        file_id = vapi_resp.get("id") or vapi_resp.get("fileId")
        if not file_id:
            return jsonify({"error": "Unexpected Vapi response"}), 502

        # Return expected structure
        return jsonify({
            "provider": "google",
            "name": name,
            "description": description,
            "fileIds": [file_id]
        }), 200

    except Exception as exc:
        app.logger.exception("File upload error")
        return jsonify({"error": str(exc)}), 500

@app.route("/create-assistant", methods=["POST", "OPTIONS"])
def create_assistant_endpoint():
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "POST,OPTIONS")
        return response
        

    teacher_id = current_teacher(request) 

    try:
        cfg = request.get_json(silent=True) or {}
        if not cfg.get("model"):
            return jsonify({"error": "'model' is required in assistant config"}), 400
        vapi_id = create_assistant(cfg)

        system_prompt = cfg.get('model', {}).get('messages', [{}])[0].get('content')
        first_message = cfg.get('firstMessage')
        assistant_name = cfg.get('name')

        db_exec(
            supabase.table("assistants").insert({
                "teacher_id": teacher_id,
                "vapi_id": vapi_id,
                "system_prompt": system_prompt,
                "first_message": first_message,
                "assistant_name": assistant_name

            }),
            context="insert assistant"
        )
        
        response = jsonify({"success": True, "assistantId": vapi_id})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 201
        
    except Exception as exc:
        app.logger.exception("Error creating assistant")
        response = jsonify({"error": str(exc)})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 500

@app.route("/assistants/by-key/<student_key>", methods=["GET"])
def assistants_for_student(student_key):
    try:
        # Step 1: Look up teacher_id from the student key
        teacher_row = (
            supabase.table("teachers")
            .select("id")
            .eq("student_key", student_key)
            .maybe_single()
            .execute()
        )
        teacher_id = teacher_row.data["id"]

        # Step 2: Get assistant names for that teacher
        assistants = db_exec(
            supabase.table("assistants")
            .select("id, assistant_name")
            .eq("teacher_id", teacher_id)
            .order("created_at", desc=True),
            context="assistants by student key"
        )

        return jsonify(assistants), 200

    except Exception as exc:
        app.logger.exception("Failed to fetch assistants for student")
        return jsonify({"error": "Invalid student key or no assistants found"}), 404

@app.route("/teacher/assistants", methods=["GET"])
def list_teacher_assistants():
    try:
        teacher_id = current_teacher(request)

        assistants = db_exec(
            supabase.table("assistants")
            .select("id, vapi_id, assistant_name, system_prompt, first_message")
            .eq("teacher_id", teacher_id)
            .order("created_at", desc=True),
            context="teacher assistants"
        )

        return jsonify(assistants), 200

    except Exception as exc:
        app.logger.exception("Failed to fetch teacher assistants")
        return jsonify({"error": str(exc)}), 500

@app.route("/start-call", methods=["POST", "OPTIONS"])
def start_phone_call():
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "POST,OPTIONS")
        return response
        
    try:
        body = request.get_json(silent=True) or {}
        vapi_assistant_id = body.get("assistantId")  # This is the Vapi ID
        student_name = body.get("studentName")
        student_number = body.get("studentNumber")
        if not all([vapi_assistant_id, student_name, student_number]):
            return jsonify({"error": "assistantId, studentName, studentNumber are required"}), 400

        assistant_row = db_exec(
            supabase.table("assistants")
            .select("id")
            .eq("vapi_id", vapi_assistant_id)
            .single(),
            context="lookup assistant by vapi_id"
        )
        db_assistant_id = assistant_row["id"]  # This is the UUID we need

        call_id = start_call(vapi_assistant_id, student_name, student_number)
        listen_url = poll_listen_url(call_id)

        call_info = {
            "callId": call_id,
            "student": student_name,
            "listenUrl": listen_url,
            "startTime": time.time(),
            "assistantId": vapi_assistant_id,  # Keep Vapi ID for frontend
        }
        active_calls[call_id] = call_info

        # Insert call record with the correct database UUID
        try:
            supabase.table("calls").insert({
                "id": call_id,
                "assistant_id": db_assistant_id,
                "student_name": student_name,
            }).execute()
        except Exception as db_error:
            app.logger.warning(f"Failed to save call to database: {db_error}")

        socketio.emit("new_call", call_info, namespace="/teacher")
        
        response = jsonify({"success": True, "callId": call_id})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 201
        
    except Exception as exc:
        app.logger.exception("Error starting call")
        response = jsonify({"error": str(exc)})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 500


@app.route("/vapi-webhook", methods=["POST"])
def vapi_webhook():
    """Handle status updates and end‑of‑call reports from Vapi."""
    try:
        evt = request.json or {}
        msg = evt.get("message", {})
        mtype = msg.get("type")
        call = msg.get("call", {})
        call_id = call.get("id")

        if mtype == "status-update" and msg.get("status") == "ended":
            if call_id in active_calls:
                info = active_calls[call_id]
                info["duration"] = time.time() - info["startTime"]
                socketio.emit("call_ended", {**info, "endTime": time.time()}, namespace="/teacher")

        elif mtype == "end-of-call-report":
            recording_url = msg.get("recordingUrl")
            summary = msg.get("summary")
            transcript = msg.get("transcript")
            duration = active_calls.get(call_id, {}).get("duration")

            socketio.emit(
                "call_report",
                {
                    "callId": call_id,
                    "student": active_calls.get(call_id, {}).get("student", "Unknown"),
                    "recordingUrl": recording_url,
                    "summary": summary,
                    "transcript": transcript,
                    "endedReason": msg.get("endedReason"),
                    "timestamp": time.time(),
                },
                namespace="/teacher",
            )

            # Update call record - this should work since call_id is the primary key
            try:
                supabase.table("calls").update({
                    "recording_url": recording_url,
                    "summary": summary,
                    "transcript": transcript,
                    "duration_sec": duration,
                }).eq("id", call_id).execute()
            except Exception as db_error:
                app.logger.warning(f"Failed to update call in database: {db_error}")

            active_calls.pop(call_id, None)
        return "", 200
    except Exception as exc:
        app.logger.exception("Webhook error")
        return "", 200  # keep Vapi happy even on failure


@app.route("/active-calls", methods=["GET", "OPTIONS"])
def get_active_calls():
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "GET,OPTIONS")
        return response
        
    response = jsonify(list(active_calls.values()))
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response

@socketio.on("connect", namespace="/teacher")
def teacher_connect():
    emit("active_calls", list(active_calls.values()))


@socketio.on("disconnect", namespace="/teacher")
def teacher_disconnect():
    pass

if __name__ == "__main__":
    app.logger.info("🚀 Language Learning Hub backend starting…")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)