import sqlite3
import pandas as pd
import sys

# Force UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

print("--- Searching via SQL LIKE ---")
# Using SQL LIKE to search for substring
query = """
    SELECT id, description, notes, status
    FROM WorkItem 
    WHERE reportId=(SELECT id FROM Report WHERE reportDate=1758067200000) 
    AND apartmentId=(SELECT id FROM Apartment WHERE number='7')
    AND (
        description LIKE '%חלקית%' 
        OR notes LIKE '%חלקית%'
        OR description LIKE '%sockets%'
        OR notes LIKE '%sockets%'
    )
"""
df = pd.read_sql_query(query, conn)

if not df.empty:
    print(df.to_string())
else:
    print("No matches found via SQL either.")
    
# Let's print ALL items descriptions again to be absolutely sure what text we have to match
print("\n--- ALL ITEMS DUMP ---")
query_all = """
    SELECT id, description, notes, status
    FROM WorkItem 
    WHERE reportId=(SELECT id FROM Report WHERE reportDate=1758067200000) 
    AND apartmentId=(SELECT id FROM Apartment WHERE number='7')
"""
df_all = pd.read_sql_query(query_all, conn)
for i, row in df_all.iterrows():
    print(f"ID: {row['id']}")
    print(f"  Desc: {repr(row['description'])}")
    print(f"  Notes: {repr(row['notes'])}")

conn.close()
