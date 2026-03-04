import os 
import sqlite3
from be.constant import *


class DictionaryDB:
    def __init__(self):
        # make path to current directory
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.db_file = os.path.join(self.current_dir, "dictionary.db")
        self.create_db()

    def create_db(self):        
        if not os.path.exists(self.db_file):
            conn = sqlite3.connect(self.db_file)
            cursor = conn.cursor()

            cursor.executescript(DICTIONARY_SCHEMA)

            conn.commit()
            conn.close()

            dictionaries = self.extract_from_file()
            self.inser_bulk_dictionary(dictionaries)

    def get_all(self):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        cursor.execute("SELECT event_id, description FROM event_dictionary")
        rows = cursor.fetchall()

        conn.close()
        return {event_id: desc for event_id, desc in rows}

    def insert_dictionary(self, event_id: str, description: str):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        cursor.execute(INSERT_DICTIONARY, (event_id, description))

        conn.commit()
        conn.close() 

    def inser_bulk_dictionary(self, event_dict: dict):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        cursor.executemany(INSERT_DICTIONARY, [(event_id, desc) for event_id, desc in event_dict.items()])

        conn.commit()
        conn.close()

    def edit_dictionary(self, event_id: str, new_description: str):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        cursor.execute(EDIT_DICTIONARY, (new_description, event_id))

        conn.commit()
        conn.close()

    def delete_dictionary(self, event_id: str):
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        cursor.execute(DELETE_DICTIONARY, (event_id,))

        conn.commit()
        conn.close()


    def extract_from_file(self, file_path=None):
        import re
        if file_path is None:
            file_path = os.path.join(self.current_dir, "dictionary.txt")
        events = {}

        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        for line in lines:
            line = line.strip()

            if not line or line.lower().startswith("event id"):
                continue

            match = re.match(r"^(\d+)\s+(.*)", line)
            if match:
                event_id = int(match.group(1))
                description = match.group(2).strip()
                events[event_id] = description

        return events