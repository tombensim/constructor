"""
Calculate V3 Progress for Apartments 7 and 11
Compares V2 vs V3 logic to show the impact of aligned defect detection
"""

import sqlite3
import pandas as pd
from collections import defaultdict

# Connect to DB
db_path = r'c:\Users\yoel\constructor\prisma\dev.db'
conn = sqlite3.connect(db_path)

# Category weights (from progress-calculator-v2.ts)
CATEGORY_WEIGHTS = {
    'ELECTRICAL': 1.2,
    'PLUMBING': 1.2,
    'AC': 1.0,
    'FLOORING': 1.1,
    'SPRINKLERS': 0.8,
    'DRYWALL': 0.9,
    'WATERPROOFING': 1.0,
    'PAINTING': 0.8,
    'KITCHEN': 1.0,
    'OTHER': 0.7,
}

# Progress thresholds (from progress-calculator-v2.ts)
PROGRESS_THRESHOLDS = {
    'VERIFIED_NO_DEFECTS': 90,
    'COMPLETED_OK_LATER': 75,
    'COMPLETED_WITH_ISSUES': 65,
    'COMPLETED_OK_FIRST': 50,
    'HANDLED': 70,
    'DEFECT_WORK_DONE': 55,
    'IN_PROGRESS': 30,
    'PENDING': 15,
    'NOT_STARTED': 5,
    'UNKNOWN': 15,
    'CATEGORY_GRADUATED': 90,
}

# Negative keywords (from status-mapper.ts)
NEGATIVE_KEYWORDS = [
    'אי תיאומים', 'אי תאומים', 'נמצאו אי', 'קיימים אי',
    'יש הערות', 'יש ליקויים', 'ליקוי', 'ליקויים',
    'לא תקין', 'חסר', 'חסרות', 'חסרים', 'חסרה',
    'שבור', 'שבורים', 'שבורה', 'סדוק', 'סדוקים',
    'פגם', 'פגמים', 'בעיה', 'בעיות', 'לתקן', 'תיקון', 'תיקונים',
    'לא בוצע', 'לא הותקן', 'לא הותקנו', 'לא הושלם',
    'נזק', 'נזקים', 'missing', 'defect', 'חתוך', 'להחליף',
]

def has_negative_notes_v2(notes):
    """V2 logic - check if notes contain negative keywords"""
    if not notes:
        return False
    notes_lower = notes.lower()
    return any(keyword.lower() in notes_lower for keyword in NEGATIVE_KEYWORDS)

def is_negative_status(status):
    """Check if status is explicitly negative"""
    return status in ['DEFECT', 'NOT_OK']

def is_positive_status(status):
    """Check if status is explicitly positive"""
    return status in ['COMPLETED', 'COMPLETED_OK', 'HANDLED']

def get_effective_status_v3(status, notes):
    """V3 logic - get effective status considering notes"""
    # If already negative, keep it
    if is_negative_status(status):
        return status
    
    # If positive but notes indicate issues, override to DEFECT
    if is_positive_status(status) and has_negative_notes_v2(notes):
        return 'DEFECT'
    
    return status

def has_defect_v2(status, notes):
    """V2 defect detection"""
    return is_negative_status(status) or (is_positive_status(status) and has_negative_notes_v2(notes))

def has_defect_v3(status, notes):
    """V3 defect detection - uses effective status"""
    effective_status = get_effective_status_v3(status, notes)
    return is_negative_status(effective_status)

def calculate_item_progress_v2(status, notes, is_first_time=False):
    """V2 item progress calculation"""
    has_issues = has_negative_notes_v2(notes)
    
    if status == 'COMPLETED_OK':
        if has_issues:
            return PROGRESS_THRESHOLDS['COMPLETED_WITH_ISSUES']
        else:
            return PROGRESS_THRESHOLDS['VERIFIED_NO_DEFECTS']
    elif status == 'COMPLETED':
        if has_issues:
            return PROGRESS_THRESHOLDS['COMPLETED_WITH_ISSUES']
        elif is_first_time:
            return PROGRESS_THRESHOLDS['COMPLETED_OK_FIRST']
        else:
            return PROGRESS_THRESHOLDS['COMPLETED_OK_LATER']
    elif status == 'HANDLED':
        return PROGRESS_THRESHOLDS['HANDLED']
    elif status in ['DEFECT', 'NOT_OK']:
        return PROGRESS_THRESHOLDS['DEFECT_WORK_DONE']
    elif status == 'IN_PROGRESS':
        return PROGRESS_THRESHOLDS['IN_PROGRESS']
    elif status == 'PENDING':
        return PROGRESS_THRESHOLDS['PENDING']
    elif status == 'NOT_STARTED':
        return PROGRESS_THRESHOLDS['NOT_STARTED']
    else:
        return PROGRESS_THRESHOLDS['UNKNOWN']

def calculate_item_progress_v3(status, notes, is_first_time=False):
    """V3 item progress calculation - uses effective status"""
    effective_status = get_effective_status_v3(status, notes)
    
    # Now calculate based on effective status
    if effective_status == 'COMPLETED_OK':
        return PROGRESS_THRESHOLDS['VERIFIED_NO_DEFECTS']
    elif effective_status == 'COMPLETED':
        # No negative notes by definition (would be DEFECT otherwise)
        if is_first_time:
            return PROGRESS_THRESHOLDS['COMPLETED_OK_FIRST']
        else:
            return PROGRESS_THRESHOLDS['COMPLETED_OK_LATER']
    elif effective_status == 'HANDLED':
        return PROGRESS_THRESHOLDS['HANDLED']
    elif effective_status in ['DEFECT', 'NOT_OK']:
        return PROGRESS_THRESHOLDS['DEFECT_WORK_DONE']
    elif effective_status == 'IN_PROGRESS':
        return PROGRESS_THRESHOLDS['IN_PROGRESS']
    elif effective_status == 'PENDING':
        return PROGRESS_THRESHOLDS['PENDING']
    elif effective_status == 'NOT_STARTED':
        return PROGRESS_THRESHOLDS['NOT_STARTED']
    else:
        return PROGRESS_THRESHOLDS['UNKNOWN']

def calculate_apartment_progress(apt_num, version='v2'):
    """Calculate overall progress for an apartment"""
    print(f"\n{'='*80}")
    print(f"Calculating {version.upper()} Progress for Apartment {apt_num}")
    print(f"{'='*80}")
    
    # Get apartment ID first
    query_apt = """
    SELECT id FROM Apartment WHERE number = ?
    """
    apt_df = pd.read_sql_query(query_apt, conn, params=(str(apt_num),))
    
    if apt_df.empty:
        print(f"Apartment {apt_num} not found")
        return None
    
    apt_id = apt_df.iloc[0]['id']
    
    # Get all work items for the latest report of this apartment
    # Group by report and get the most recent
    query = """
    SELECT wi.category, wi.status, wi.notes, wi.description, wi.location, 
           r.reportDate, r.id as report_id
    FROM WorkItem wi
    JOIN Report r ON wi.reportId = r.id
    WHERE wi.apartmentId = ?
    ORDER BY r.reportDate DESC
    """
    all_items = pd.read_sql_query(query, conn, params=(apt_id,))
    
    if all_items.empty:
        print(f"No work items found for Apartment {apt_num}")
        return None
    
    # Get the latest report date
    latest_date = all_items['reportDate'].max()
    items = all_items[all_items['reportDate'] == latest_date].copy()
    
    print(f"\nLatest report date: {pd.to_datetime(latest_date, unit='ms').strftime('%Y-%m-%d')}")
    print(f"Total items: {len(items)}")
    
    # Calculate progress by category
    category_progress = {}
    category_details = defaultdict(lambda: {'items': 0, 'defects_v2': 0, 'defects_v3': 0, 'total_progress': 0})
    
    calc_func = calculate_item_progress_v2 if version == 'v2' else calculate_item_progress_v3
    defect_func = has_defect_v2 if version == 'v2' else has_defect_v3
    
    for _, item in items.iterrows():
        cat = item['category']
        status = item['status']
        notes = item['notes']
        
        # Calculate item progress
        item_progress = calc_func(status, notes, is_first_time=False)
        
        category_details[cat]['items'] += 1
        category_details[cat]['total_progress'] += item_progress
        
        # Count defects
        if version == 'v2' and has_defect_v2(status, notes):
            category_details[cat]['defects_v2'] += 1
        elif version == 'v3' and has_defect_v3(status, notes):
            category_details[cat]['defects_v3'] += 1
    
    # Calculate average progress per category
    for cat, details in category_details.items():
        if details['items'] > 0:
            category_progress[cat] = round(details['total_progress'] / details['items'])
    
    # Calculate weighted overall progress
    weighted_sum = 0
    total_weight = 0
    
    for cat, progress in category_progress.items():
        weight = CATEGORY_WEIGHTS.get(cat, 0.8)
        weighted_sum += progress * weight
        total_weight += weight
    
    overall_progress = round(weighted_sum / total_weight) if total_weight > 0 else 0
    
    # Print details
    print(f"\n{'Category':<20} {'Items':<8} {'Defects':<10} {'Avg Progress':<15}")
    print('-' * 80)
    for cat in sorted(category_details.keys()):
        details = category_details[cat]
        defect_count = details.get(f'defects_{version}', 0)
        avg_prog = category_progress.get(cat, 0)
        print(f"{cat:<20} {details['items']:<8} {defect_count:<10} {avg_prog}%")
    
    print(f"\n{'='*80}")
    print(f"Overall Progress ({version.upper()}): {overall_progress}%")
    print(f"{'='*80}")
    
    return {
        'overall': overall_progress,
        'by_category': category_progress,
        'details': dict(category_details)
    }

def compare_versions(apt_num):
    """Compare V2 vs V3 for an apartment"""
    v2_result = calculate_apartment_progress(apt_num, 'v2')
    v3_result = calculate_apartment_progress(apt_num, 'v3')
    
    if v2_result and v3_result:
        print(f"\n{'='*80}")
        print(f"COMPARISON: Apartment {apt_num}")
        print(f"{'='*80}")
        print(f"V2 Overall Progress: {v2_result['overall']}%")
        print(f"V3 Overall Progress: {v3_result['overall']}%")
        diff = v3_result['overall'] - v2_result['overall']
        print(f"Difference: {diff:+d} percentage points")
        
        # Show category differences
        print(f"\n{'Category':<20} {'V2 Progress':<15} {'V3 Progress':<15} {'Difference'}")
        print('-' * 80)
        all_cats = set(v2_result['by_category'].keys()) | set(v3_result['by_category'].keys())
        for cat in sorted(all_cats):
            v2_prog = v2_result['by_category'].get(cat, 0)
            v3_prog = v3_result['by_category'].get(cat, 0)
            cat_diff = v3_prog - v2_prog
            if cat_diff != 0:
                print(f"{cat:<20} {v2_prog}%{'':<12} {v3_prog}%{'':<12} {cat_diff:+d}%")

if __name__ == "__main__":
    print("Progress Calculator V2 vs V3 Comparison")
    print("=" * 80)
    
    # Compare Apartment 7
    compare_versions('7')
    
    print("\n\n")
    
    # Compare Apartment 11
    compare_versions('11')
    
    conn.close()
