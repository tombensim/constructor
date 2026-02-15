import sqlite3
import pandas as pd
import sys

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

# Query specifically for records on Sept 17 2025 (1758067200000)
query = """
    SELECT 
        wi.id,
        wi.category,
        wi.location,
        wi.status,
        wi.description,
        wi.notes,
        wi.hasPhoto
    FROM WorkItem wi
    JOIN Report r ON wi.reportId = r.id
    JOIN Apartment a ON wi.apartmentId = a.id
    WHERE a.number = '7' 
    AND r.reportDate = 1758067200000
"""

df = pd.read_sql_query(query, conn)

with open('debug_sept17_result.txt', 'w', encoding='utf-8') as f:
    f.write(f"--- WorkItems for Apt 7 on Sept 17, 2025 (Total: {len(df)}) ---\n")
    if not df.empty:
        for index, row in df.iterrows():
            f.write(f"\nItem {index + 1}:\n")
            f.write(f"  Category: {row['category']}\n")
            f.write(f"  Location: {row['location']}\n")
            f.write(f"  Status: {row['status']}\n")
            f.write(f"  Description: {row['description']}\n")
            f.write(f"  Notes: {row['notes']}\n")
            f.write(f"  Has Photo: {row['hasPhoto']}\n")
    else:
        f.write("No items found for this date.\n")

conn.close()
