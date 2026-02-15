import sqlite3
import pandas as pd

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

# 1. Data Extraction (Cell 11 logic)
query = """
SELECT 
    r.reportDate,
    a.number as apartment_number,
    w.category,
    w.status
FROM WorkItem w
JOIN Report r ON w.reportId = r.id
JOIN Apartment a ON w.apartmentId = a.id
WHERE a.number = '7'
ORDER BY r.reportDate ASC
"""

df_progress = pd.read_sql_query(query, conn)
# Convert reportDate
df_progress['reportDate'] = pd.to_datetime(df_progress['reportDate'], unit='ms')

# 2. Data Processing (Cell 12 logic)
COMPLETED_STATUSES = ['COMPLETED', 'DONE', 'OK', 'בוצע', 'תקין', 'בוצע - תקין'] 

def is_done(status):
    if not isinstance(status, str):
        return 0
    return 1 if status in COMPLETED_STATUSES or 'COMPLETED' in status.upper() or 'DONE' in status.upper() else 0

df_progress['is_completed'] = df_progress['status'].apply(is_done)

# Group
df_grouped = df_progress.groupby(['apartment_number', 'category', 'reportDate'])['is_completed'].sum().reset_index()

# Sort
df_grouped.sort_values(['apartment_number', 'category', 'reportDate'], inplace=True)

# Cumulative Sum
df_grouped['cumulative_completed'] = df_grouped.groupby(['apartment_number', 'category'])['is_completed'].transform(pd.Series.cumsum)

print("--- Data for Apt 7 ---")
print(df_grouped.to_string())

conn.close()
