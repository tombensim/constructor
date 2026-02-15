# 2. Data Processing
if 'df_progress' in locals():
    # Define what counts as "Complete" (Positive progress)
    # Adjust this list based on the actual statuses found above
    COMPLETED_STATUSES = ['COMPLETED', 'DONE', 'OK', 'בוצע', 'תקין', 'בוצע - תקין'] 
    
    # Create a binary 'is_completed' column
    # Note: 'status' in DB might be English Enum or Hebrew text. 
    # Let's assume standard ones or add logic to check containment.
    def is_done(status):
        if not isinstance(status, str):
            return 0
        return 1 if status in COMPLETED_STATUSES or 'COMPLETED' in status.upper() or 'DONE' in status.upper() else 0

    df_progress['is_completed'] = df_progress['status'].apply(is_done)
    
    # Group by Apartment, Category, Date
    # We want Cumulative Sum over time.
    
    # First, pivot or group to get counts per day
    df_grouped = df_progress.groupby(['apartment_number', 'category', 'reportDate'])['is_completed'].sum().reset_index()
    
    # Sort properly
    df_grouped.sort_values(['apartment_number', 'category', 'reportDate'], inplace=True)
    
    # Calculate Cumulative Sum per Group
    df_grouped['cumulative_completed'] = df_grouped.groupby(['apartment_number', 'category'])['is_completed'].transform(pd.Series.cumsum)
    
    display_scrollable_dataframe(df_grouped)