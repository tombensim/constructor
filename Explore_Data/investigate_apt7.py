import sqlite3
import pandas as pd

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

# Query to get all work items for Apt 7
query = """
    SELECT 
        r.reportDate,
        w.category, 
        w.location, 
        w.status,
        w.description
    FROM WorkItem w
    JOIN Report r ON w.reportId = r.id
    JOIN Apartment a ON w.apartmentId = a.id
    WHERE a.number = '7'
    ORDER BY r.reportDate
"""


df = pd.read_sql_query(query, conn)
# Convert reportDate to datetime
df['reportDate'] = pd.to_datetime(df['reportDate'], unit='ms')

print("\n--- Report Dates and Category Counts for Apt 7 ---")
print(df.groupby(['reportDate', 'category']).size())


print("\n--- Detailed View of First Report (Jan 2025) ---")
first_report_date = df['reportDate'].min()
print(f"First Report Date: {first_report_date}")
print(df[df['reportDate'] == first_report_date][['category', 'location', 'status']])
