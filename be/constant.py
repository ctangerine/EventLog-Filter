SYSTEM_INFO_SCHEMA = """
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    session_id TEXT NOT NULL,

    event_id INTEGER NOT NULL,
    event_log_name TEXT,
    event_description TEXT,
    version INTEGER,
    level INTEGER,
    task INTEGER,
    opcode INTEGER,
    keywords TEXT,

    time_created TEXT NOT NULL,
    record_id INTEGER,
    activity_id TEXT,

    process_id INTEGER,
    thread_id INTEGER,

    channel TEXT,
    computer TEXT,
    security_sid TEXT,
    provider TEXT,

    FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_events_eventid
ON events(session_id, event_id);

CREATE INDEX idx_events_time
ON events(session_id, time_created);
"""


EVENT_DATA_SCHEMA = """
CREATE TABLE event_data (
    event_fk INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    value TEXT,

    PRIMARY KEY(event_fk, field_name, value),
    FOREIGN KEY(event_fk) REFERENCES events(id)
);

CREATE INDEX idx_data ON event_data(field_name, value);
CREATE INDEX idx_data_eventfk ON event_data(event_fk);
"""

SESSION_SCHEMA = """
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,               
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    source_filename TEXT,
    total_events INTEGER DEFAULT 0
);
"""

INSERT_SESSION = """
INSERT INTO sessions (id, created_at, expires_at, source_filename, total_events) VALUES (?, ?, ?, ?, ?);
"""

TOUCH_SESSION = """
UPDATE sessions SET expires_at = ? WHERE id = ?;
"""

INSERT_SYSTEM_INFO = """
INSERT INTO events (
    session_id, event_id, version, level, task, opcode, keywords,
    time_created, record_id, activity_id,
    process_id, thread_id,
    channel, computer, security_sid, provider, event_log_name, event_description
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
""" 

INSERT_EVENT_DATA = """
INSERT INTO event_data (event_fk, field_name, value) VALUES (?, ?, ?);
"""


DICTIONARY_SCHEMA = """
CREATE TABLE IF NOT EXISTS event_dictionary (
    event_id INTEGER PRIMARY KEY,
    description TEXT NOT NULL
);
"""

INSERT_DICTIONARY = """
INSERT INTO event_dictionary (event_id, description) VALUES (?, ?);
"""

EDIT_DICTIONARY = """
UPDATE event_dictionary SET description = ? WHERE event_id = ?;
"""

DELETE_DICTIONARY = """
DELETE FROM event_dictionary WHERE event_id = ?;
"""