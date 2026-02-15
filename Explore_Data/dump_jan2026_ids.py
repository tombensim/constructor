import sqlite3
import pandas as pd
import binascii
import sys

# Force UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

print("--- Dumping IDs and Categories for Jan 2026 ---")
# Query for reports >= Jan 1 2026
query = """
    SELECT r.reportDate, wi.id, wi.category, wi.description, wi.status
    FROM WorkItem wi
    JOIN Report r ON wi.reportId = r.id
    JOIN Apartment a ON wi.apartmentId = a.id
    WHERE a.number = '7' 
    AND r.reportDate >= 1767225600000
    ORDER BY r.reportDate, wi.category
"""
df = pd.read_sql_query(query, conn)
df['reportDate_dt'] = pd.to_datetime(df['reportDate'], unit='ms')

# Write to file directly to avoid terminal encoding hell
with open('jan2026_data.txt', 'w', encoding='utf-8') as f:
    for index, row in df.iterrows():
        f.write(f"\nDate: {row['reportDate_dt']}\n")
        f.write(f"ID: {row['id']}\n")
        f.write(f"  Category: {row['category']}\n")
        f.write(f"  Status: {row['status']}\n")
        f.write(f"  Desc: {row['description']}\n")
        
        # Check for keywords
        desc = str(row['description'])
        if "חלקית" in desc or "sockets" in desc or "LAN" in desc:
            f.write("  !!! FOUND KEYPHRASE !!!\n")
            
conn.close()
print("Data dumped to jan2026_data.txt")
