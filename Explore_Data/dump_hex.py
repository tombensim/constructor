import sqlite3
import pandas as pd
import binascii
import sys

# Force UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

print("--- Dumping Hex of Descriptions for Sept 17 ---")
query = """
    SELECT id, category, description, notes, status
    FROM WorkItem 
    WHERE reportId=(SELECT id FROM Report WHERE reportDate=1758067200000) 
    AND apartmentId=(SELECT id FROM Apartment WHERE number='7')
"""
df = pd.read_sql_query(query, conn)

for index, row in df.iterrows():
    print(f"\nID: {row['id']}")
    print(f"  Category: {row['category']}")
    print(f"  Status: {row['status']}")
    
    # Safe printing using repr
    desc = row['description'] if row['description'] else ""
    print(f"  Desc Repr: {repr(desc)}")
    
    # Check for keywords before hex (manual search logic)
    if "חלקית" in desc or "sockets" in desc:
        print("  !!! FOUND KEYPHRASE !!!")

conn.close()
