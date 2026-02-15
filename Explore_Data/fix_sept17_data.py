import sqlite3
import uuid

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

def generate_cuid():
    return 'cj' + str(uuid.uuid4()).replace('-', '')[:23] # Mock CUID-like string

print("--- Applying Fixes for Sept 17 Data ---")

# 1. Update Item 2 (Flooring) to DEFECT
item2_id = 'cmkpajlja00cp13u5rrhoqkek'
cursor.execute("UPDATE WorkItem SET status='DEFECT' WHERE id=?", (item2_id,))
print(f"Updated Item 2 ({item2_id}) status to DEFECT")

# 2. Create new Flooring item from Item 4 (Electrical)
item4_id = 'cmkpajljs00ct13u5uugwyf4q'
# Get attributes
cursor.execute("SELECT reportId, apartmentId, location FROM WorkItem WHERE id=?", (item4_id,))
res = cursor.fetchone()
if res:
    rep_id, apt_id, loc = res
    new_id = generate_cuid()
    desc = "נזק לריצוף/בטון עקב העברת כבל חשמל (מתוך סעיף חשמל)"
    cursor.execute("""
        INSERT INTO WorkItem (id, reportId, apartmentId, category, status, location, description, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, 'FLOORING', 'DEFECT', ?, ?, 'נוצר אוטומטית בעקבות הערה בסעיף חשמל', 1758067200000, 1758067200000)
    """, (new_id, rep_id, apt_id, loc, desc))
    print(f"Created new Flooring item ({new_id}) from Electrical Item 4")

# 3. Split Item 8 (Electrical) into 4 items
item8_id = 'cmkpalfue00kr5sxqrqze6k7l'
cursor.execute("SELECT reportId, apartmentId, location FROM WorkItem WHERE id=?", (item8_id,))
res = cursor.fetchone()
if res:
    rep_id, apt_id, loc = res
    
    # Rename original
    new_desc_main = "בדיקת תוכנית חשמל - חסרות נקודות תקשורת LAN - מטבח (דרוש חור)"
    cursor.execute("UPDATE WorkItem SET description=? WHERE id=?", (new_desc_main, item8_id))
    print(f"Updated Item 8 ({item8_id}) description")
    
    # Create 3 new items
    new_items = [
        "בדיקת תוכנית חשמל - חסרות נקודות תקשורת LAN - חדר שינה 1",
        "בדיקת תוכנית חשמל - חסרות נקודות תקשורת LAN - ממ\"ד",
        "בדיקת תוכנית חשמל - חסרות נקודות תקשורת LAN - סלון"
    ]
    
    for desc in new_items:
        nid = generate_cuid()
        cursor.execute("""
            INSERT INTO WorkItem (id, reportId, apartmentId, category, status, location, description, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, 'ELECTRICAL', 'DEFECT', ?, ?, 'פוצל מסעיף בדיקת תוכנית חשמל', 1758067200000, 1758067200000)
        """, (nid, rep_id, apt_id, loc, desc))
        print(f"Created new Electrical item ({nid}): {desc}")

conn.commit()
conn.close()
print("--- Fixes Applied Successfully ---")
