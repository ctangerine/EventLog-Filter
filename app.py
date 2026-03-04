from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import uuid
import os
import re
import threading
import time
from werkzeug.utils import secure_filename
from be.db_creator import SessionDatabaseHandler
from be.event_query_handler import EventLogQueryHandler
from be.dictionary_db import DictionaryDB

app = Flask(__name__)
CORS(app)

app.config['MAX_CONTENT_LENGTH'] = None

UPLOAD_FOLDER = 'be/temp/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

def _validate_session_id(sid: str) -> bool:
    """Ensure session_id is a valid UUID to prevent path traversal."""
    return bool(sid and _UUID_RE.match(sid))

dict_db = DictionaryDB()

def _cleanup_loop():
    while True:
        time.sleep(300)
        try:
            SessionDatabaseHandler.cron_check_expired_sessions('./be/temp')
        except Exception as e:
            print(f'[cleanup-error] {e}')

_cleanup_thread = threading.Thread(target=_cleanup_loop, daemon=True)
_cleanup_thread.start()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_session', methods=['GET'])
def get_session():
    session_id = str(uuid.uuid4())
    return jsonify({"session_id": session_id})

@app.route('/upload', methods=['POST'])
def upload_files():
    session_id = request.form.get('session_id', '').strip()
    if not _validate_session_id(session_id):
        return jsonify({"error": "session_id không hợp lệ"}), 400

    if 'files' not in request.files:
        return jsonify({"error": "Không có tệp được chọn"}), 400

    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({"error": "Không có tệp được chọn"}), 400

    db_handler = SessionDatabaseHandler(session_id, db_path='./be/temp')
    
    for file in files:
        if file.filename.endswith('.evtx'):
            filename = secure_filename(file.filename)
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(file_path)
            
            try:
                db_handler.import_evtx(file_path)
            except Exception as e:
                print(f"Lỗi khi import file {filename}: {e}")
            finally:
                if os.path.exists(file_path):
                    os.remove(file_path)

    query_handler = EventLogQueryHandler()
    dictionary = query_handler.fetch_dictionary(db_handler.db_file)
    
    return jsonify({
        "message": "Upload và xử lý thành công",
        "dictionary": dictionary
    })

@app.route('/filter', methods=['POST'])
def filter_events():
    data = request.json
    if not data:
        return jsonify({"error": "Thiếu dữ liệu json"}), 400
        
    session_id = data.get('session_id', '').strip()
    filters = data.get('filters', {})
    
    if not _validate_session_id(session_id):
        return jsonify({"error": "session_id không hợp lệ"}), 400
        
    db_file_path = os.path.join('./be/temp', f'{session_id}.db')
    if not os.path.exists(db_file_path):
        return jsonify({"error": f"Session DB không tồn tại: {session_id}"}), 404
        
    query_handler = EventLogQueryHandler()
    events = query_handler.filter_event(db_file_path, filters)

    SessionDatabaseHandler.touch_session(db_file_path, session_id)
    
    return jsonify({
        "events": events
    })

# ── System Dictionary endpoints ──────────────────────────────────

@app.route('/dictionary/system', methods=['GET'])
def get_system_dictionary():
    try:
        return jsonify({"entries": dict_db.get_all()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/dictionary/add', methods=['POST'])
def add_dictionary_entry():
    data = request.json
    if not data:
        return jsonify({"error": "Thiếu dữ liệu"}), 400
    event_id = data.get('event_id')
    description = str(data.get('description', '')).strip()
    if event_id is None:
        return jsonify({"error": "Thiếu event_id"}), 400
    try:
        dict_db.insert_dictionary(int(event_id), description)
        return jsonify({"ok": True, "entry": {"event_id": int(event_id), "description": description}})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/dictionary/delete/<int:event_id>', methods=['DELETE'])
def delete_dictionary_entry(event_id):
    try:
        dict_db.delete_dictionary(event_id)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/dictionary/edit/<int:event_id>', methods=['PUT'])
def edit_dictionary_entry(event_id):
    data = request.json
    if not data:
        return jsonify({"error": "Thiếu dữ liệu"}), 400
    new_description = str(data.get('description', '')).strip()
    try:
        dict_db.edit_dictionary(event_id, new_description)
        return jsonify({"ok": True, "entry": {"event_id": event_id, "description": new_description}})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', '0') in ('1', 'true', 'True')
    port = int(os.environ.get('FLASK_PORT', 5000))
    app.run(host='0.0.0.0', debug=debug_mode, port=port)
