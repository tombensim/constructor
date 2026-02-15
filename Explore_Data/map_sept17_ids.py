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
        wi.reportId,
        wi.apartmentId
    FROM WorkItem wi
    JOIN Report r ON wi.reportId = r.id
    JOIN Apartment a ON wi.apartmentId = a.id
    WHERE a.number = '7' 
    AND r.reportDate = 1758067200000
    ORDER BY wi.id -- Ensure consistent order for reference, but we have IDs now
"""

df = pd.read_sql_query(query, conn)

with open('id_map_sept17.txt', 'w', encoding='utf-8') as f:
    f.write(f"--- ID MAP for Apt 7 on Sept 17, 2025 (Total: {len(df)}) ---\n")
    if not df.empty:
        for index, row in df.iterrows():
            f.write(f"\nItem {index + 1}:\n")
            f.write(f"  ID: {row['id']}\n")
            f.write(f"  ReportID: {row['reportId']}\n")
            f.write(f"  AptID: {row['apartmentId']}\n")
            f.write(f"  Category: {row['category']}\n")
            f.write(f"  Status: {row['status']}\n")
            f.write(f"  Description: {row['description']}\n")
            f.write(f"  Notes: {row['notes']}\n")
            
            # Auto-detect "Partially Done" candidate
            if row['category'] == 'FLOORING' and row['status'] == 'COMPLETED':
                f.write("  [TARGET CANDIDATE: Partially Done? User said 'Row 2']\n")
            
            # Auto-detect "Electrical -> Flooring" candidate
            if row['category'] == 'ELECTRICAL' and ('flooring' in str(row['notes']).lower() or 'ריצוף' in str(row['notes'])):
                 f.write("  [TARGET CANDIDATE: Electrical damaging flooring?]\n")

            # Auto-detect "Sockets" candidate
            if row['category'] == 'ELECTRICAL' and ('LAN' in str(row['description']) or 'sockets' in str(row['description'])):
                 f.write("  [TARGET CANDIDATE: 5 Sockets?]\n")

    else:
        f.write("No items found for this date.\n")

conn.close()
