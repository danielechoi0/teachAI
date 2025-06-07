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

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def db_exec(query, *, context: str = ""):
    """Execute a Supabase query with proper error handling."""
    try:
        res = query.execute()
        return res.data if hasattr(res, 'data') else res
    except Exception as e:
        app.logger.error(f"Supabase {context} error → {str(e)}")
        raise RuntimeError(f"Database {context} failed: {str(e)}")

def save_assistant_to_db(vapi_id: str, cfg: dict):
    """Upsert assistant row keyed on Vapi's text ID (vapi_id)."""
    return db_exec(
        supabase.table("assistants")
        .upsert(
            {"vapi_id": vapi_id, "cfg": cfg},
            on_conflict="vapi_id",
            returning="id,vapi_id",
        ),
        context="upsert assistants",
    )[0]


def create_assistant(cfg: dict) -> str:
    """Create an assistant via Vapi and return its vapi_id."""
    r = requests.post(
        f"{API_URL}/assistant",
        headers={"Authorization": VAPI_KEY, "Content-Type": "application/json"},
        json=cfg,
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["id"]


def start_call(assistant_id: str, student_name: str, student_number: str) -> str:
    r = requests.post(
        f"{API_URL}/call",
        headers={"Authorization": VAPI_KEY, "Content-Type": "application/json"},
        json={
            "phoneNumberId": PHONE_ID,
            "assistantId": assistant_id,
            "customer": {"name": student_name, "number": student_number},
        },
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["id"]


def poll_listen_url(call_id: str, *, retries: int = 30, delay: int = 2) -> str:
    """Poll Vapi until the call has a listenUrl or time‑out."""
    for attempt in range(retries):
        try:
            r = requests.get(
                f"{API_URL}/call/{call_id}",
                headers={"Authorization": VAPI_KEY},
                timeout=10,
            )
            r.raise_for_status()
            url = r.json().get("monitor", {}).get("listenUrl")
            if url:
                app.logger.info(f"listenUrl ready for {call_id} → {url}")
                return url
            time.sleep(delay)
        except Exception as exc:
            app.logger.warning(f"Polling error (attempt {attempt+1}/{retries}): {exc}")
            if attempt == retries - 1:
                raise
            time.sleep(delay)
    raise RuntimeError(f"listenUrl not ready after {retries} attempts")

active_calls: dict[str, dict] = {}

@app.route("/create-assistant", methods=["POST"])
def create_assistant_endpoint():
    """Create assistant on Vapi, persist to Supabase, return vapi_id."""
    try:
        cfg = request.get_json(silent=True) or {}
        if not cfg.get("model"):
            return jsonify({"error": "'model' is required in assistant config"}), 400

        vapi_id = create_assistant(cfg)
        save_assistant_to_db(vapi_id, cfg)
        return jsonify({"success": True, "assistantId": vapi_id}), 201
    except Exception as exc:
        app.logger.exception("Error creating assistant")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/assistants", methods=["GET"])
def list_assistants():
    """Return simplified assistant list for the React UI."""
    try:
        rows = db_exec(
            supabase.table("assistants")
            .select("vapi_id,cfg")
            .order("created_at", desc=True),
            context="select assistants",
        )

        assistants = []
        for row in rows:
            cfg = row.get("cfg") or {}
            name = cfg.get("name") or cfg.get("firstMessage", "Assistant")
            if len(name) > 30:
                name = name[:27] + "…"
            assistants.append({"id": row["vapi_id"], "name": name})
        return jsonify(assistants), 200
    except Exception as exc:
        app.logger.exception("Error listing assistants")
        return jsonify({"error": str(exc)}), 500


@app.route("/start-call", methods=["POST"])
def start_phone_call():
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

        db_exec(
            supabase.table("calls").insert(
                {
                    "id": call_id,
                    "assistant_id": assistant_id,
                    "student_name": student_name,
                    "listen_url": listen_url,
                    "started_at": "now()",
                }
            ),
            context="insert calls",
        )

        socketio.emit("new_call", call_info, namespace="/teacher")
        return jsonify({"success": True, "callId": call_id}), 201
    except Exception as exc:
        app.logger.exception("Error starting call")
        return jsonify({"error": str(exc)}), 500


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

            db_exec(
                supabase.table("calls")
                .update(
                    {
                        "recording_url": recording_url,
                        "summary": summary,
                        "transcript": transcript,
                        "duration_sec": duration,
                    }
                )
                .eq("id", call_id),
                context="update calls",
            )
            active_calls.pop(call_id, None)
        return "", 200
    except Exception as exc:
        app.logger.exception("Webhook error")
        return "", 200  # keep Vapi happy even on failure


@app.route("/active-calls", methods=["GET"])
def get_active_calls():
    return jsonify(list(active_calls.values()))

@socketio.on("connect", namespace="/teacher")
def teacher_connect():
    emit("active_calls", list(active_calls.values()))


@socketio.on("disconnect", namespace="/teacher")
def teacher_disconnect():
    pass

if __name__ == "__main__":
    app.logger.info("🚀 Language Learning Hub backend starting…")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
