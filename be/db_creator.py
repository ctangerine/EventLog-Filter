import sqlite3
import os
from datetime import datetime, timezone, timedelta
from be.evtx_parser import EvtxParser
from be.constant import *

class SessionDatabaseHandler: 
    def __init__(self, session_id: str, db_path: str = "./temp"):
        self.session_id = session_id
        self.db_path = db_path
        self.db_file = os.path.join(db_path, f"{session_id}.db")

        if not os.path.exists(db_path):
            os.makedirs(db_path)

        if not os.path.exists(self.db_file):
            self.create_database()

    def create_database(self):
        db_file = self.db_file
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()

        cursor.executescript(SESSION_SCHEMA)
        cursor.executescript(SYSTEM_INFO_SCHEMA)
        cursor.executescript(EVENT_DATA_SCHEMA)

        now = datetime.now(timezone.utc).isoformat()
        expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        cursor.execute(INSERT_SESSION, (self.session_id, now, expires, None, 0))

        conn.commit()
        conn.close()

    def import_evtx(self, file_path: str):
        parser = EvtxParser(file_path)
        parser.parse()
        events = parser.get_events()

        conn = sqlite3.connect(self.db_file)
        for event in events:
            self.insert_event(conn, self.session_id, event)

        conn.commit()
        conn.close()    

    def insert_event(self, conn, session_id: str, event: dict):
        cursor = conn.cursor()

        system_info = event["system_info"]
        event_data = event["event_data"]

        self.__insert_system_info(cursor, session_id, system_info)
        self.__insert_event_data(cursor, cursor.lastrowid, event_data)  

    def __insert_system_info(self, cursor, session_id: str, system_info: dict):
        cursor.execute(INSERT_SYSTEM_INFO, (
            session_id,
            system_info.get("event_id"),
            system_info.get("version"),            
            system_info.get("level"),
            system_info.get("task"),
            system_info.get("opcode"),
            system_info.get("keywords"),
            system_info.get("time_created"),
            system_info.get("record_id"),
            system_info.get("activity_id"),
            system_info.get("process_id"),
            system_info.get("thread_id"),
            system_info.get("channel"),
            system_info.get("computer"),
            system_info.get("security_sid"),
            system_info.get("provider"),
            system_info.get("event_log_name"),
            system_info.get("event_description", "")
        ))

    def __insert_event_data(self, cursor, event_fk: int, event_data: dict):
        data_rows = [(event_fk, key, value) for key, value in event_data.items()]
        cursor.executemany(INSERT_EVENT_DATA, data_rows)

    def cleanup(self, session_id: str):
        db_file = f"./temp/{session_id}.db"
        if os.path.exists(db_file):
            os.remove(db_file)

    @staticmethod
    def touch_session(db_file: str, session_id: str):
        """Update expires_at to now + 1 hour on each query."""
        if not os.path.exists(db_file):
            return
        expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        try:
            conn = sqlite3.connect(db_file)
            conn.execute(TOUCH_SESSION, (expires, session_id))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[touch_session] Error: {e}")

    @staticmethod
    def cron_check_expired_sessions(db_path: str = './be/temp'):
        """Delete session DBs whose expires_at has passed."""
        if not os.path.exists(db_path):
            return
        now = datetime.now(timezone.utc).isoformat()
        for fname in os.listdir(db_path):
            if not fname.endswith('.db'):
                continue
            fpath = os.path.join(db_path, fname)
            try:
                conn = sqlite3.connect(fpath)
                cursor = conn.cursor()
                cursor.execute("SELECT expires_at FROM sessions LIMIT 1")
                row = cursor.fetchone()
                conn.close()
                if row and row[0] < now:
                    os.remove(fpath)
                    print(f"[cleanup] Deleted expired session DB: {fname}")
            except Exception as e:
                print(f"[cleanup] Could not check {fname}: {e}")
        

    