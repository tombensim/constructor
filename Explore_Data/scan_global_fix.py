import sqlite3
import pandas as pd
import sys

# Force UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

print("--- Scanning for 'Partially Done' (חלקית) items marked COMPLETED ---")

query = """
    SELECT 
        wi.id,
        wi.description,
        wi.notes,
        wi.status,
        a.number as apartment_number
    FROM WorkItem wi
    JOIN Apartment a ON wi.apartmentId = a.id
    WHERE wi.status IN ('COMPLETED', 'COMPLETED_OK')
    AND (
        wi.description LIKE '%חלקית%' OR 
        wi.notes LIKE '%חלקית%'
    )
"""

df = pd.read_sql_query(query, conn)

if not df.empty:
    print(f"Found {len(df)} candidate items to fix.")
    print(df[['apartment_number', 'status', 'description', 'notes']].to_string())
else:
    print("No additional 'Partially Done' items found in COMPLETED status.")

conn.close()
