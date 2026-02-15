# Visualization
import matplotlib.pyplot as plt
import seaborn as sns

# Using the 'df_grouped' from previous step
if 'df_grouped' in locals() and not df_grouped.empty:
    apartments = sorted(df_grouped['apartment_number'].unique())
    
    # Define category order for consistency (optional)
    categories = sorted(df_grouped['category'].unique())
    
    # Create a separate plot for each apartment
    for apt_num in apartments:
        apt_data = df_grouped[df_grouped['apartment_number'] == apt_num]
        
        plt.figure(figsize=(12, 6))
        ax = plt.gca()
        
        # Plot each category line
        sns.lineplot(
            data=apt_data, 
            x='reportDate', 
            y='cumulative_completed', 
            hue='category',
            style='category',
            markers=True, 
            dashes=False,
            ax=ax
        )
        
        ax.set_title(f'Apartment {apt_num} - Completion Trajectory')
        ax.set_xlabel('Date')
        ax.set_ylabel('Items Completed (Cumulative)')
        plt.xticks(rotation=45)
        ax.grid(True, linestyle='--', alpha=0.7)
        
        # Move legend to outside if crowded
        plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
        
        plt.tight_layout()
        plt.show()
        
else:
    print("No data available for visualization")
