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

def save_assistant_to_db(vapi_id: str, cfg: dict):
    res = db_exec(
        supabase.table("assistants")
        .upsert({"vapi_id": vapi_id, "cfg": cfg}, on_conflict="vapi_id", returning="id,vapi_id"),
        context="upsert assistants",
    )
    if not res or not isinstance(res, list) or not res[0]:
        raise RuntimeError("Upsert returned no data for assistant")
    return res[0]


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
        
    try:
        cfg = request.get_json(silent=True) or {}
        if not cfg.get("model"):
            return jsonify({"error": "'model' is required in assistant config"}), 400
        vapi_id = create_assistant(cfg)
        save_assistant_to_db(vapi_id, cfg)
        
        response = jsonify({"success": True, "assistantId": vapi_id})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 201
        
    except Exception as exc:
        app.logger.exception("Error creating assistant")
        response = jsonify({"error": str(exc)})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 500


@app.route("/api/assistants", methods=["GET", "OPTIONS"])
def list_assistants():
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "GET,OPTIONS")
        return response
        
    try:
        rows = db_exec(supabase.table("assistants").select("vapi_id,cfg").order("created_at", desc=True), context="select assistants")
        out = []
        for row in rows:
            cfg = row.get("cfg") or {}
            name = cfg.get("name") or cfg.get("firstMessage", "Assistant")
            if len(name) > 30:
                name = name[:27] + "…"
            out.append({"id": row["vapi_id"], "name": name})
        
        response = jsonify(out)
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 200
        
    except Exception as exc:
        app.logger.exception("Error listing assistants")
        response = jsonify({"error": str(exc)})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 500


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
        assistant_id = body.get("assistantId")
        student_name = body.get("studentName")
        student_number = body.get("studentNumber")
        if not all([assistant_id, student_name, student_number]):
            return jsonify({"error": "assistantId, studentName, studentNumber are required"}), 400

        call_id = start_call(assistant_id, student_name, student_number)
        listen_url = poll_listen_url(call_id)

        call_info = {
            "callId": call_id,
            "student": student_name,
            "listenUrl": listen_url,
            "startTime": time.time(),
            "assistantId": assistant_id,
        }
        active_calls[call_id] = call_info

        # Insert call record without relying on return data
        try:
            supabase.table("calls").insert({
                "id": call_id,
                "assistant_id": assistant_id,
                "student_name": student_name,
                "listen_url": listen_url,
                "started_at": "now()",
            }).execute()
        except Exception as db_error:
            app.logger.warning(f"Failed to save call to database: {db_error}")
            # Don't fail the entire request if database insert fails

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

            # Update call record without relying on return data
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