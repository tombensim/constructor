import sqlite3
import pandas as pd

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

query = """
    SELECT 
        r.reportDate,
        a.number as apartment_number,
        wi.category,
        wi.status,
        wi.location,
        wi.description
    FROM WorkItem wi
    JOIN Report r ON wi.reportId = r.id
    JOIN Apartment a ON wi.apartmentId = a.id
    WHERE a.number = '7'
    ORDER BY r.reportDate ASC
"""

df = pd.read_sql_query(query, conn)
df['reportDate_dt'] = pd.to_datetime(df['reportDate'], unit='ms')

# Filter for reports in Late 2025 (Sept, Oct, Nov)
start_date = '2025-09-01'
end_date = '2025-11-30'
mask = (df['reportDate_dt'] >= start_date) & (df['reportDate_dt'] <= end_date)
df_oct = df.loc[mask]

print(f"--- Unique Descriptions Analysis for Apt 7 ({start_date} to {end_date}) ---")

if not df_oct.empty:
    # Check for multiple descriptions per (Category, Location)
    grouped = df_oct.groupby(['category', 'location'])['description'].nunique()
    multi_desc = grouped[grouped > 1]
    
    if not multi_desc.empty:
        print("\nFound (Category, Location) pairs with multiple unique descriptions:")
        print(multi_desc)
        
        # Show details for one example
        example_cat, example_loc = multi_desc.index[0]
        print(f"\nExample Details for Category='{example_cat}', Location='{example_loc}':")
        details = df_oct[(df_oct['category'] == example_cat) & (df_oct['location'] == example_loc)]
        print(details[['reportDate_dt', 'status', 'description']].to_string())
    else:
        print("\nNo (Category, Location) pairs have multiple unique descriptions in this period.")

    print("\n--- Total Items per Category (by Description) ---")
    # If we group by Description as well, what are the counts?
    # Assuming Description + Location + Category defines a unique defect
    unique_defects = df_oct.groupby(['category', 'location', 'description']).size().reset_index(name='count')
    print(unique_defects.groupby('category').size())

conn.close()
