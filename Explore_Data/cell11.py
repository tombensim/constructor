# 1. Data Extraction
if 'conn' in locals():
    query = """
    SELECT 
        r.reportDate,
        a.number as apartment_number,
        wi.category,
        wi.status
    FROM WorkItem wi
    JOIN Report r ON wi.reportId = r.id
    JOIN Apartment a ON wi.apartmentId = a.id
    WHERE wi.apartmentId IS NOT NULL
    ORDER BY r.reportDate ASC
    """
    
    try:
        df_progress = pd.read_sql_query(query, conn)
        # Convert reportDate from timestamp (ms) to datetime
        df_progress['reportDate'] = pd.to_datetime(df_progress['reportDate'], unit='ms')
        
        print(f"Loaded {len(df_progress)} work items for analysis")
        display_scrollable_dataframe(df_progress)
        
        # Check unique statuses to define 'Completed'
        print("Unique Data Statuses:", df_progress['status'].unique())
    except Exception as e:
        print(f"Error extracting data: {e}")