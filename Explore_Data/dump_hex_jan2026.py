import sqlite3
import pandas as pd
import binascii
import sys

# Force UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

print("--- Dumping Hex of Descriptions for Jan 2026 ---")
# Query for reports >= Jan 1 2026
query = """
    SELECT r.reportDate, wi.id, wi.category, wi.description, wi.notes, wi.status
    FROM WorkItem wi
    JOIN Report r ON wi.reportId = r.id
    JOIN Apartment a ON wi.apartmentId = a.id
    WHERE a.number = '7' 
    AND r.reportDate >= 1767225600000
    ORDER BY r.reportDate
"""
df = pd.read_sql_query(query, conn)
df['reportDate_dt'] = pd.to_datetime(df['reportDate'], unit='ms')

for index, row in df.iterrows():
    print(f"\nDate: {row['reportDate_dt']}")
    print(f"ID: {row['id']}")
    print(f"  Category: {row['category']}")
    print(f"  Status: {row['status']}")
    
    # Safe printing using repr
    desc = row['description'] if row['description'] else ""
    print(f"  Desc Repr: {repr(desc)}")
    
    if "חלקית" in desc or "sockets" in desc or "LAN" in desc:
        print("  !!! FOUND KEYPHRASE !!!")

conn.close()
