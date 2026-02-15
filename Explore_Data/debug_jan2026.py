import sqlite3
import pandas as pd
import sys

# Force UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

print("--- WorkItems for Apt 7 in Jan 2026 ---")
# Query for reports in Jan 2026
# Jan 1 2026 is approx 1767225600000
query = """
    SELECT 
        r.reportDate,
        wi.id,
        wi.category,
        wi.status,
        wi.location,
        wi.description,
        wi.notes
    FROM WorkItem wi
    JOIN Report r ON wi.reportId = r.id
    JOIN Apartment a ON wi.apartmentId = a.id
    WHERE a.number = '7' 
    AND r.reportDate >= 1767225600000
    ORDER BY r.reportDate, wi.category
"""

df = pd.read_sql_query(query, conn)
df['reportDate_dt'] = pd.to_datetime(df['reportDate'], unit='ms')

if not df.empty:
    pd.set_option('display.max_colwidth', None)
    for index, row in df.iterrows():
        print(f"\nDate: {row['reportDate_dt']} | Category: {row['category']} | Status: {row['status']}")
        print(f"Desc: {row['description']}")
        print(f"Notes: {row['notes']}")
else:
    print("No items found for Jan 2026.")

conn.close()
