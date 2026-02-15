import sqlite3
import uuid

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

def generate_cuid():
    return 'cj' + str(uuid.uuid4()).replace('-', '')[:23]

print("--- Applying Fixes for Jan 2026 Data ---")

# Target items to split (The "Missing LAN" generic items)
# Jan 11: cml6t2uiq001px8lvs0ia9l39
# Jan 30: cml6t56ae0051x8lvmwpw5hgl
target_ids = ['cml6t2uiq001px8lvs0ia9l39', 'cml6t56ae0051x8lvmwpw5hgl']

# New items descriptions
new_items_desc = [
    "בדיקת תוכנית חשמל - חסרות נקודות תקשורת LAN - חדר שינה 1",
    "בדיקת תוכנית חשמל - חסרות נקודות תקשורת LAN - ממ\"ד",
    "בדיקת תוכנית חשמל - חסרות נקודות תקשורת LAN - סלון"
]

for item_id in target_ids:
    # Check if exists
    cursor.execute("SELECT reportId, apartmentId, location, description FROM WorkItem WHERE id=?", (item_id,))
    res = cursor.fetchone()
    if res:
        rep_id, apt_id, loc, old_desc = res
        print(f"Processing Item {item_id}...")
        
        # Rename original to Kitchen
        new_desc_main = "בדיקת תוכנית חשמל - חסרות נקודות תקשורת LAN - מטבח (דרוש חור)"
        cursor.execute("UPDATE WorkItem SET description=? WHERE id=?", (new_desc_main, item_id))
        print(f"  Updated original item description")
        
        # Create 3 new items
        for desc in new_items_desc:
            nid = generate_cuid()
            cursor.execute("""
                INSERT INTO WorkItem (id, reportId, apartmentId, category, status, location, description, notes, createdAt, updatedAt)
                VALUES (?, ?, ?, 'ELECTRICAL', 'DEFECT', ?, ?, 'פוצל מסעיף בדיקת תוכנית חשמל (תיקון ינואר)', 1767225600000, 1767225600000)
            """, (nid, rep_id, apt_id, loc, desc))
            print(f"  Created new item: {desc}")
    else:
        print(f"Item {item_id} not found (maybe already fixed?)")

conn.commit()
conn.close()
print("--- Fixes Applied Successfully ---")
