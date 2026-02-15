import sqlite3
import pandas as pd

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

# 1. Get all reports for Apt 7 in late 2025 to see dates
query_dates = """
    SELECT DISTINCT r.reportDate
    FROM Report r
    JOIN WorkItem wi ON wi.reportId = r.id
    JOIN Apartment a ON wi.apartmentId = a.id
    WHERE a.number = '7' 
    AND r.reportDate >= 1756684800000 -- Sept 1 2025
    AND r.reportDate <= 1764547200000 -- Dec 1 2025
    ORDER BY r.reportDate
"""

df_dates = pd.read_sql_query(query_dates, conn)
df_dates['reportDate_dt'] = pd.to_datetime(df_dates['reportDate'], unit='ms')
print("--- Report Dates for Apt 7 (Sept-Dec 2025) ---")
print(df_dates)

# 2. Check closest report to Oct 5 (2025-10-05)
# If user says "October 5 report", maybe there is one. 
# Or maybe they mean the status *on* Oct 5 (which would be the status from the previous report, or the next one if that's how they think).
# But the user said "as shown in the chart for this date". Chart points are at `reportDate`.

# Let's calculate the values for *all* these reports so we can match what the user sees.

query_data = """
    SELECT 
        r.reportDate,
        wi.category,
        wi.status,
        wi.location,
        wi.description
    FROM WorkItem wi
    JOIN Report r ON wi.reportId = r.id
    JOIN Apartment a ON wi.apartmentId = a.id
    WHERE a.number = '7' 
    AND r.reportDate >= 1756684800000 -- Sept 1 2025
    AND r.reportDate <= 1764547200000 -- Dec 1 2025
    ORDER BY r.reportDate
"""

df = pd.read_sql_query(query_data, conn)
df['reportDate_dt'] = pd.to_datetime(df['reportDate'], unit='ms')

# Status Map
STATUS_MAP = {
    'COMPLETED': 'OK',
    'COMPLETED_OK': 'OK',
    'DEFECT': 'DEFECT',
    'NOT_OK': 'DEFECT',
    'IN_PROGRESS': 'PENDING',
    'PENDING': 'PENDING',
}
df['state'] = df['status'].map(STATUS_MAP).fillna('INFO')

# Identify defects
defects_only = df[df['state'] == 'DEFECT'].copy()

# Count per report
counts = defects_only.groupby(['reportDate_dt', 'category']).size().reset_index(name='pending_defects')

print("\n--- Defect Counts per Report (Chart Values) ---")
print(counts.to_string())

conn.close()
