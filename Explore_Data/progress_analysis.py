
import sqlite3
import pandas as pd
import os

# Connect to DB
# Hardcoded for reliability in this specific environment content
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'

conn = sqlite3.connect(db_path)


STATUS_MAP = {
    'COMPLETED': 'OK',
    'COMPLETED_OK': 'OK',
    'DEFECT': 'DEFECT',
    'NOT_OK': 'DEFECT',
    'IN_PROGRESS': 'PENDING',
    'PENDING': 'PENDING',
}

query = """
    SELECT 
        a.number as apartmentNumber,
        w.category, 
        w.location, 
        w.status,
        r.reportDate
    FROM WorkItem w
    JOIN Report r ON w.reportId = r.id
    LEFT JOIN Apartment a ON w.apartmentId = a.id
    WHERE w.apartmentId IS NOT NULL
    ORDER BY r.reportDate ASC
"""

try:
    df = pd.read_sql_query(query, conn)
    
    if df.empty:
        print("No work items found matching criteria.")
        exit()

    # 1. Map Status
    df['State'] = df['status'].map(STATUS_MAP).fillna('INFO')
    # Filter out INFO if any (unexpected statuses)
    df = df[df['State'] != 'INFO'].copy()
    
    # 2. Get Latest State
    # Sort by date
    df = df.sort_values('reportDate')
    
    # Group by Unique Scope (Apt + Category + Location) and take Last
    # treating null location as a distinct "general" location for that category
    latest = df.drop_duplicates(subset=['apartmentNumber', 'category', 'location'], keep='last')
    
    print("\n--- Latest State Summary ---")
    print(latest['State'].value_counts())
    
    print("\n--- Readiness by Apartment ---")
    summary = latest.groupby(['apartmentNumber', 'State']).size().unstack(fill_value=0)
    
    # Calculate Health Score
    if 'OK' not in summary.columns: summary['OK'] = 0
    if 'DEFECT' not in summary.columns: summary['DEFECT'] = 0
    if 'PENDING' not in summary.columns: summary['PENDING'] = 0
    
    summary['Total'] = summary.sum(axis=1)
    summary['Health_Score'] = (summary['OK'] / summary['Total'] * 100).round(1)
    
    print(summary[['OK', 'DEFECT', 'PENDING', 'Total', 'Health_Score']])
    
except Exception as e:
    print(e)
