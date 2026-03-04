import re
import sqlite3

_SAFE_FIELD_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]{0,63}$')


class EventLogQueryHandler:
    def __init__(self):
        self.SYSTEM_FIELDS = [
            "event_id", "version", "level", "task",
            "opcode", "keywords", "time_created",
            "record_id", "activity_id",
            "process_id", "thread_id",
            "channel", "computer",
            "security_sid", "provider",
            "event_log_name"
        ]
        self.SYSTEM_FIELDS_SET = frozenset(self.SYSTEM_FIELDS)

    @staticmethod
    def _is_safe_field(name: str) -> bool:
        """Only allow simple alphanumeric+underscore identifiers."""
        return bool(_SAFE_FIELD_RE.match(name))

    def fetch_dictionary(self, db_path: str):
        result = []

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT DISTINCT event_id FROM events")
        event_ids = [row[0] for row in cursor.fetchall()]

        for event_id in event_ids:

            cursor.execute("""
                SELECT id, event_description FROM events
                WHERE event_id = ?
                LIMIT 1
            """, (event_id,))

            row = cursor.fetchone()
            if not row:
                continue

            event_fk = row[0]
            event_description = row[1]

            cursor.execute("""
                SELECT DISTINCT field_name
                FROM event_data
                WHERE event_fk = ?
            """, (event_fk,))

            props = [r[0] for r in cursor.fetchall()]

            result.append({
                "event_id": event_id,
                "event_description": event_description,
                "system_fields": list(self.SYSTEM_FIELDS),
                "props": props
            })

        conn.close()
        return result
    
    def filter_event(self, db_path: str, filters: dict):
        if not filters:
            return []

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        base_query = """
            SELECT e.*, ed.field_name, ed.value
            FROM events e
            LEFT JOIN event_data ed ON e.id = ed.event_fk
        """

        where_clauses = []
        params = []

        if "search_any" in filters and filters["search_any"]:
            raw = str(filters['search_any']).strip()
            if raw:
                # Escape LIKE wildcards already present in user input
                escaped = raw.replace('%', '\\%').replace('_', '\\_')
                search_any_val = f"%{escaped}%"
                any_clauses = []

                # Hardcoded safe column list for system table
                searchable_cols = list(self.SYSTEM_FIELDS) + ["event_description"]
                for col in searchable_cols:
                    any_clauses.append(f"e.{col} LIKE ? ESCAPE '\\'")
                    params.append(search_any_val)

                # Dynamic data search
                any_clauses.append("""
                    EXISTS (
                        SELECT 1 FROM event_data ed_any
                        WHERE ed_any.event_fk = e.id
                        AND (ed_any.field_name LIKE ? ESCAPE '\\' OR ed_any.value LIKE ? ESCAPE '\\')
                    )
                """)
                params.append(search_any_val)
                params.append(search_any_val)

                where_clauses.append(f"({' OR '.join(any_clauses)})")

        for field, values in filters.items():
            if values is None or field == "search_any":
                continue

            # Reject field names that aren't safe identifiers
            if not self._is_safe_field(field):
                continue

            if isinstance(values, dict) and ("gte" in values or "lte" in values):
                if field in self.SYSTEM_FIELDS_SET:
                    if "gte" in values:
                        where_clauses.append(f"e.{field} >= ?")
                        params.append(str(values["gte"]))
                    if "lte" in values:
                        where_clauses.append(f"e.{field} <= ?")
                        params.append(str(values["lte"]))
                else:
                    if "gte" in values:
                        where_clauses.append("""
                            EXISTS (
                                SELECT 1
                                FROM event_data ed2
                                WHERE ed2.event_fk = e.id
                                AND ed2.field_name = ?
                                AND ed2.value >= ?
                            )
                        """)
                        params.append(field)
                        params.append(str(values["gte"]))

                    if "lte" in values:
                        where_clauses.append("""
                            EXISTS (
                                SELECT 1
                                FROM event_data ed2
                                WHERE ed2.event_fk = e.id
                                AND ed2.field_name = ?
                                AND ed2.value <= ?
                            )
                        """)
                        params.append(field)
                        params.append(str(values["lte"]))

            elif isinstance(values, list) and values:
                placeholders = ",".join(["?"] * len(values))
                str_values = [str(v) for v in values]

                if field in self.SYSTEM_FIELDS_SET:
                    where_clauses.append(f"e.{field} IN ({placeholders})")
                    params.extend(str_values)
                else:
                    where_clauses.append(f"""
                        EXISTS (
                            SELECT 1
                            FROM event_data ed2
                            WHERE ed2.event_fk = e.id
                            AND ed2.field_name = ?
                            AND ed2.value IN ({placeholders})
                        )
                    """)
                    params.append(field)
                    params.extend(str_values)

        if where_clauses:
            base_query += " WHERE " + " AND ".join(where_clauses)

        # Safety limit to avoid returning huge datasets
        base_query += " LIMIT 10000"

        cursor.execute(base_query, params)
        rows = cursor.fetchall()

        results = {}

        for row in rows:
            event_internal_id = row["id"]

            if event_internal_id not in results:
                event_dict = dict(row)
                event_dict.pop("field_name", None)
                event_dict.pop("value", None)
                event_dict["event_data"] = {}
                results[event_internal_id] = event_dict

            if row["field_name"] is not None:
                results[event_internal_id]["event_data"][row["field_name"]] = row["value"]

        conn.close()
        return list(results.values())
    

    def generate_test_cases(self):
        """
        Trả về danh sách các test case filter để kiểm thử filter_event().
        Mỗi phần tử là một dict filter.
        """

        test_cases = [

            # 1️⃣ Không filter (lấy toàn bộ)
            {},

            # 2️⃣ Chỉ 1 system field
            # {
            #     "event_id": [4624]
            # },

            # # 3️⃣ System field với OR nội bộ
            # {
            #     "event_id": [4624, 4625]
            # },

            # 4️⃣ Nhiều system field (AND giữa field)
            {
                "event_id": [4624, 4625],
                "LogonType": [10]
            },

            # 5️⃣ Chỉ dynamic field
            {
                "IpAddress": ["192.168.1.10"]
            },

            # 6️⃣ Dynamic field OR nội bộ
            {
                "IpAddress": ["192.168.1.10", "10.0.0.5"]
            },

            # 7️⃣ Nhiều dynamic field (AND giữa field)
            {
                "IpAddress": ["192.168.1.10"],
                "TargetUserName": ["admin"]
            },

            # 8️⃣ Kết hợp system + dynamic
            {
                "event_id": [4624],
                "IpAddress": ["192.168.1.10"]
            },

            # 9️⃣ Field không tồn tại (dynamic)
            {
                "NonExistField": ["abc"]
            },

            # 🔟 Giá trị rỗng trong field
            {
                "event_id": []
            },

            # 11️⃣ Nhiều giá trị + nhiều field phức tạp
            {
                "event_id": [4624, 4625, 4688],
                "IpAddress": ["192.168.1.10", "10.0.0.5"],
                "TargetUserName": ["admin", "guest"]
            },

            # 12️⃣ Mixed kiểu dữ liệu
            {
                "event_id": [4624],
                "process_id": [1234, 5678]
            }

        ]

        return test_cases
    
# handler = EventLogQueryHandler()
# for test in handler.generate_test_cases():
#     print(test)
#     result = handler.filter_event("./temp/test_session.db", test) 

#     # append result to results.txt
#     with open("results.txt", "a") as f:
#         f.write(f"Filter: {test}\n")
#         f.write(f"Result count: {len(result)}\n")
#         for event in result:
#             f.write(f"{event}\n")
#         f.write("-" * 50 + "\n")