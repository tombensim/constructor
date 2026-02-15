import sqlite3
import pandas as pd
import sys

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

# Query specifically for records on Sept 17 2025
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

print(f"--- WorkItems for Apt 7 on Sept 17, 2025 (Total: {len(df)}) ---")
if not df.empty:
    for index, row in df.iterrows():
        print(f"\nItem {index + 1}:")
        print(f"  Category: {row['category']}")
        print(f"  Location: {row['location']}")
        print(f"  Status: {row['status']}")
        # Print representation of string to see content without rendering
        desc = row['description']
        print(f"  Description (repr): {repr(desc)}")
else:
    print("No items found for this date.")

conn.close()
