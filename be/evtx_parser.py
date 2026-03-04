import Evtx.Evtx as evtx
import re
import xmltodict
import json
from datetime import datetime
import xml.etree.ElementTree as ET


class EvtxParser:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.events = []
        self.dictionary = {}
        self.load_dictionary()

    def load_dictionary(self, db_path = None):
        if db_path is None:
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(current_dir, "dictionary.db")
        try:
            import sqlite3
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT event_id, description FROM event_dictionary")
            rows = cursor.fetchall()
            self.dictionary = {str(row[0]): row[1] for row in rows}
            conn.close()
        except Exception as e:
            print(f"Failed to load dictionary: {e}")
            self.dictionary = {}

    def parse(self):
        with evtx.Evtx(self.file_path) as log:
            count = 0
            for record in log.records():
                record_xml = record.xml()
                record_dict = xmltodict.parse(record_xml)
                self.events.append(self.parse_single_event(record_dict))
                count += 1
            print(f"Parsed {count} events from {self.file_path}")

    def get_events(self):
        return self.events
    
    def parse_single_event(self, event: dict):
        parse_result = {}
        log_name = self.file_path.split("/")[-1]
        system_part = event.get("Event", {}).get("System", {})
        event_part = event.get("Event", {}).get("EventData", {}) or {}

        def format_if_datetime(val):
            if not isinstance(val, str):
                return val
            # Common ISO formats: 2024-03-04T12:34:56.789Z or 2024-03-04 12:34:56
            try:
                # Try parsing with fromisoformat (handles many ISO-like formats)
                dt = datetime.fromisoformat(val.replace('Z', '+00:00'))
                return dt.strftime("%Y-%m-%d %H:%M:%S")
            except (ValueError, TypeError):
                # Try more specific patterns if needed, but fromisoformat is quite robust in Python 3.11+
                return val

        system_info = {}
        system_info["event_id"] = system_part.get("EventID", {}).get("#text")
        system_info["provider"] = system_part.get("Provider", {}).get("@Name", "Unknown") + " with GUID " + system_part.get("Provider", {}).get("@Guid", "Unknown")
        system_info["time_created"] = system_part.get("TimeCreated", {}).get("@SystemTime")
        dt = datetime.fromisoformat(system_info["time_created"])
        system_info["time_created"] = dt.strftime("%Y-%m-%d %H:%M:%S")
        system_info["activity_id"] = system_part.get("Correlation", {}).get("@ActivityID")
        system_info["process_id"] = system_part.get("Execution", {}).get("@ProcessID")
        system_info["thread_id"] = system_part.get("Execution", {}).get("@ThreadID")
        system_info["computer"] = system_part.get("Computer", {})
        system_info["security_sid"] = system_part.get("Security", {}).get("@UserID")
        system_info["version"] = system_part.get("Version", {})
        system_info["level"] = system_part.get("Level", {})
        system_info["task"] = system_part.get("Task", {})
        system_info["opcode"] = system_part.get("Opcode", {})
        system_info["keywords"] = system_part.get("Keywords", {})
        system_info["channel"] = system_part.get("Channel", {})
        system_info["record_id"] = system_part.get("EventRecordID", {})
        system_info["event_log_name"] = log_name
        system_info["event_description"] = self.dictionary.get(str(system_info["event_id"]), "No description available")

        event_data = {}
        if event_part.get("Data") and isinstance(event_part.get("Data"), list):
            for data in event_part.get("Data", []):
                name = data.get("@Name")
                value = data.get("#text")
                value = format_if_datetime(value)
                event_data[name] = value

        elif isinstance(event_part.get("Data"), str):
            unxml = self.handle_unxml_form(event_part.get("Data"))
            for k, v in unxml.items():
                event_data[k] = format_if_datetime(v)

        if event_part.get("Binary", {}) and event_part['Binary'] != None:
            event_data["Binary"] = event_part.get("Binary", {})

        parse_result["system_info"] = system_info
        parse_result["event_data"] = event_data

        return parse_result

    def handle_unxml_form(self, data_str: str):
        result = {}
        try: 
            decoded = data_str.encode().decode("unicode_escape")
            root = ET.fromstring(f"<root>{decoded}</root>")
            strings = [elem.text for elem in root.findall("string")]

            if len(strings) >= 3 and strings[2]:
                block = strings[2]

                pattern = re.compile(
                    r"\n\t([A-Za-z0-9_]+)=(.*?)(?=\n\t[A-Za-z0-9_]+=|\Z)",
                    re.DOTALL
                )

                for match in pattern.finditer("\n" + block):
                    key = match.group(1).strip()
                    value = match.group(2).strip()
                    result[key] = value
            return result
        except Exception as e:
            return {}

