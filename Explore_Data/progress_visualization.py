import sqlite3
import pandas as pd
import os

# STATUS MAP
STATUS_MAP = {
    'COMPLETED': 'OK',
    'COMPLETED_OK': 'OK',
    'DEFECT': 'DEFECT',
    'NOT_OK': 'DEFECT',
    'IN_PROGRESS': 'PENDING',
    'PENDING': 'PENDING',
}

def get_db_connection():
    # Hardcoded for reliability in this specific environment content
    db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
    return sqlite3.connect(db_path)

def get_readiness_data():
    """
    Fetches WorkItem data, determines the latest state for each item,
    and returns a summary DataFrame with counts and Health Score per apartment.
    """
    conn = get_db_connection()
    
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
        conn.close()
        
        if df.empty:
            return pd.DataFrame()

        # 1. Map Status
        df['State'] = df['status'].map(STATUS_MAP).fillna('INFO')
        df = df[df['State'] != 'INFO'].copy()
        
        # 2. Get Latest State
        df = df.sort_values('reportDate')
        latest = df.drop_duplicates(subset=['apartmentNumber', 'category', 'location'], keep='last')
        
        # 3. Create Summary
        summary = latest.groupby(['apartmentNumber', 'State']).size().unstack(fill_value=0)
        
        # Ensure all columns exist
        for col in ['OK', 'DEFECT', 'PENDING']:
            if col not in summary.columns:
                summary[col] = 0
                
        # Calculate Metrics
        summary['Total'] = summary[['OK', 'DEFECT', 'PENDING']].sum(axis=1)
        summary['Health_Score'] = (summary['OK'] / summary['Total'] * 100).round(1)
        
        # Reorder columns
        return summary[['OK', 'DEFECT', 'PENDING', 'Total', 'Health_Score']]
        
    except Exception as e:
        print(f"Error in get_readiness_data: {e}")
        if conn: conn.close()
        return pd.DataFrame()

def display_readiness_heatmap():
    """
    Returns a styled DataFrame suitable for display in Jupyter Notebook.
    """
    df = get_readiness_data()
    
    if df.empty:
        print("No data available for readiness heatmap.")
        return None
        
    # Simple gradient styling for Health Score
    return df.style.background_gradient(subset=['Health_Score'], cmap='RdYlGn', vmin=0, vmax=100)\
             .background_gradient(subset=['DEFECT'], cmap='Reds')\
             .format({'Health_Score': '{:.1f}%'})
