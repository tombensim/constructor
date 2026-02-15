import sqlite3
import pandas as pd

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

# Check Schema
print("--- Schema of WorkItem ---")
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(WorkItem)")
columns = [row[1] for row in cursor.fetchall()]
print(columns)

# Search for text
print("\n--- Searching for 'partially done' or 'sockets' ---")
query = """
    SELECT id, description, notes, status, category, location
    FROM WorkItem 
    WHERE reportId=(SELECT id FROM Report WHERE reportDate=1758067200000) 
    AND apartmentId=(SELECT id FROM Apartment WHERE number='7')
"""
df = pd.read_sql_query(query, conn)

# Simple text search
for index, row in df.iterrows():
    text_blob = str(row['description']) + " " + str(row['notes'])
    # Check for "בוצע חלקית" or variants
    if "חלקית" in text_blob or "sockets" in text_blob:
         print(f"FOUND MATCH in Item {row['id']}:")
         print(f"  Desc: {row['description']}")
         print(f"  Notes: {row['notes']}")
         print(f"  Status: {row['status']}")

conn.close()
