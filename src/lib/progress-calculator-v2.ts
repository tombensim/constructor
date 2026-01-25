/**
 * Progress Calculator V2 - Verification-Based Progress
 * 
 * Key insight: Supervisor's "בוצע" just means "inspected", NOT "work is done correctly"
 * Only items verified as "תקין" (OK) or with positive notes count toward progress.
 * 
 * Progress Model:
 * - Baseline: 30% (structural work done before supervision starts)
 * - Maximum: 95% (full verification)
 * - Progress = baseline + (verified_ratio × (max - baseline))
 * 
 * Item Classification:
 * - VERIFIED: תקין, or positive verification in notes → counts toward progress
 * - DEFECT: ליקוי, לא תקין, or negative notes → reduces progress  
 * - INSPECTED: בוצע without verification → neutral (just checked, not verified)
 */

import { WorkStatus, isPositiveStatus, isNegativeStatus, hasNegativeNotes } from './status-mapper';

// Configuration
export const PROGRESS_MODEL = process.env.PROGRESS_MODEL || 'v2';

// Progress range
const BASELINE_PROGRESS = 30;  // Start at 30% (pre-supervision work)
const MAX_PROGRESS = 95;       // Max achievable progress
const DEFECT_PENALTY = 5;      // Penalty per defect ratio point

// Category weights
export const CATEGORY_WEIGHTS: Record<string, number> = {
  'ELECTRICAL': 12,
  'PLUMBING': 10,
  'SPRINKLERS': 5,
  'WATERPROOFING': 5,
  'DRYWALL': 10,
  'FLOORING': 15,
  'AC': 8,
  'PAINTING': 10,
  'KITCHEN': 10,
  'OTHER': 15,
};

export const STRUCTURAL_BASELINE = BASELINE_PROGRESS;

// Progress thresholds matching user requirements
export const PROGRESS_THRESHOLDS = {
  VERIFIED_NO_DEFECTS: 90,       // תקין, verified with no issues
  CATEGORY_GRADUATED: 90,        // Category was seen before, now absent = approved
  ITEM_FIXED: 90,                // Item had defect, now disappeared = fixed
  COMPLETED_OK_LATER: 75,        // בוצע - completed OK (seen in later reports)
  COMPLETED_OK_FIRST: 50,        // בוצע - first time seen
  HANDLED: 70,                   // טופל - defect was fixed
  COMPLETED_WITH_ISSUES: 65,     // Completed but has issues in notes
  DEFECT_WORK_DONE: 55,          // ליקוי - work done but has defect
  IN_PROGRESS: 30,               // בטיפול - work in progress
  PENDING: 15,                   // ממתין - pending
  UNKNOWN: 15,                   // Unknown/unrecognized status
  NOT_STARTED: 5,                // לא התחיל - not started
  CATEGORY_NEVER_SEEN: 0,        // Category never reported = work not started
};

// Types
export type DefectScope = 'minor' | 'partial' | 'substantial' | 'full';

export interface DefectImpact {
  scope: DefectScope;
  requiresTearOut: boolean;
  affectedCategories: string[];
  estimatedRegressionPercent: number;
}

export interface ProgressContext {
  previousProgress?: number;
  previousStatus?: string | null;
  wasEverCompleted?: boolean;
  wasEverVerified?: boolean;
  defectCount?: number;
  totalItemsInCategory?: number;
  isFirstTimeSeen?: boolean;      // Is this the first report where this item appears?
  wasInPreviousReport?: boolean;  // Was this item in the previous report?
  hadDefectBefore?: boolean;      // Did this item have a defect in a previous report?
}

export interface ProgressResult {
  progress: number;
  delta: number;
  reason: string;
  hasRegression: boolean;
  scope?: DefectScope;
}

export interface WorkItemForProgress {
  category: string;
  status: string;
  notes: string | null;
  description?: string;
  previousProgress?: number;
  wasEverCompleted?: boolean;
  wasEverVerified?: boolean;
}

export interface CategoryProgressDetail {
  category: string;
  categoryHebrew: string;
  progress: number;
  itemCount: number;
  hasIssues: boolean;
  hasRegression: boolean;
  issues: string[];
  weight: number;
}

// Hebrew names for display
export const CATEGORY_HEBREW_NAMES: Record<string, string> = {
  'ELECTRICAL': 'חשמל',
  'PLUMBING': 'אינסטלציה',
  'AC': 'מיזוג אוויר',
  'FLOORING': 'ריצוף וחיפוי',
  'SPRINKLERS': 'ספרינקלרים וכיבוי',
  'DRYWALL': 'גבס והנמכות',
  'WATERPROOFING': 'איטום',
  'PAINTING': 'צבע',
  'KITCHEN': 'מטבח',
  'OTHER': 'אחר',
};

export const STANDARD_APARTMENT_CATEGORIES = [
  'ELECTRICAL',
  'PLUMBING',
  'AC',
  'FLOORING',
  'SPRINKLERS',
  'DRYWALL',
  'WATERPROOFING',
  'PAINTING',
  'KITCHEN',
  'OTHER',
] as const;

export type ApartmentCategory = typeof STANDARD_APARTMENT_CATEGORIES[number];

// Verification keywords - these indicate work is ACTUALLY complete and verified
const VERIFICATION_KEYWORDS = [
  'תקין',
  'מאושר', 
  'אושר',
  'הושלם בהצלחה',
  'ללא הערות',
  'ללא ליקויים',
  'בסדר',
  'ok',
  'verified',
  'approved',
];

// Simple helper functions
export function detectDefectScope(notes: string | null): DefectScope {
  return 'minor';
}

export function requiresTearOut(notes: string | null): boolean {
  return false;
}

/**
 * Check if item is TRULY verified (not just "בוצע"/inspected)
 * Returns true only if:
 * - Status is COMPLETED_OK (תקין), OR
 * - Notes contain verification keywords
 */
export function isVerified(notes: string | null): boolean {
  if (!notes) return false;
  const lower = notes.toLowerCase();
  return VERIFICATION_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

/**
 * Check if an item is truly verified complete
 * - COMPLETED_OK status = verified
 * - COMPLETED + verification keywords in notes = verified
 * - COMPLETED alone (בוצע) = NOT verified, just inspected
 */
export function isTrulyVerified(status: string, notes: string | null): boolean {
  const workStatus = status as WorkStatus;
  
  // COMPLETED_OK (תקין) is always verified
  if (workStatus === WorkStatus.COMPLETED_OK) {
    return true;
  }
  
  // HANDLED (טופל) = defect was fixed, counts as verified
  if (workStatus === WorkStatus.HANDLED) {
    return true;
  }
  
  // COMPLETED (בוצע) + verification keywords = verified
  if (workStatus === WorkStatus.COMPLETED && isVerified(notes)) {
    return true;
  }
  
  // COMPLETED (בוצע) alone = just inspected, NOT verified
  return false;
}

/**
 * Check if item has a defect (not yet resolved)
 */
export function hasDefect(status: string, notes: string | null): boolean {
  const workStatus = status as WorkStatus;
  
  // Explicit defect status
  if (isNegativeStatus(workStatus)) {
    return true;
  }
  
  // Positive status but negative notes = has issues
  if (isPositiveStatus(workStatus) && hasNegativeNotes(notes)) {
    return true;
  }
  
  return false;
}

export function getCascadeCategories(category: string, notes: string | null): string[] {
  return [];
}

export function calculateDefectPenalty(scope: DefectScope, needsTearOut: boolean): number {
  return 0;
}

export function calculateScopedRegression(prev: number, scope: DefectScope, tearOut: boolean): number {
  return 0;
}

export function calculateCascadeImpact(cat: string, notes: string | null, prog: Map<string, number>) {
  return { primaryCategory: cat, primaryRegression: 0, cascadeEffects: [] };
}

export function calculateProjectBaseline(prog: Map<string, number>): number {
  return BASELINE_PROGRESS;
}

/**
 * V1 Progress Calculation - Simple status-based (uses same thresholds as V2)
 */
export function calculateItemProgressV1(status: string, notes: string | null): number {
  // Delegate to V2 for consistency
  return calculateItemProgressV2(status, notes).progress;
}

/**
 * V2 Progress Calculation - Status-based with proper thresholds
 * 
 * Progress values per status:
 * - Verified (תקין, no defects): 90%
 * - Completed OK first time (בוצע): 50%
 * - Completed OK later (בוצע): 75%
 * - Completed with issues: 65%
 * - Handled (טופל): 70%
 * - Defect (ליקוי - work done with issues): 55%
 * - In Progress (בטיפול): 30%
 * - Pending (ממתין): 15%
 * - Unknown: 15%
 * - Not Started: 5%
 */
export function calculateItemProgressV2(
  status: string,
  notes: string | null,
  context: ProgressContext = {}
): ProgressResult {
  const workStatus = status as WorkStatus;
  const hasIssuesInNotes = hasNegativeNotes(notes);
  const isFirstTime = context.isFirstTimeSeen !== false; // Default to first time if not specified
  let progress: number;
  let reason: string;
  
  // 1. COMPLETED_OK (תקין) - verified complete
  if (workStatus === WorkStatus.COMPLETED_OK) {
    if (hasIssuesInNotes) {
      // Status says OK but notes indicate issues
      progress = PROGRESS_THRESHOLDS.COMPLETED_WITH_ISSUES;
      reason = 'completed_ok_with_issues';
    } else {
      progress = PROGRESS_THRESHOLDS.VERIFIED_NO_DEFECTS;
      reason = 'verified_no_defects';
    }
  }
  // 2. COMPLETED (בוצע) - work completed, check notes and timing
  else if (workStatus === WorkStatus.COMPLETED) {
    if (hasIssuesInNotes) {
      progress = PROGRESS_THRESHOLDS.COMPLETED_WITH_ISSUES;
      reason = 'completed_with_issues';
    } else if (isVerified(notes)) {
      // Notes indicate verification (תקין in notes)
      progress = PROGRESS_THRESHOLDS.VERIFIED_NO_DEFECTS;
      reason = 'verified_via_notes';
    } else if (isFirstTime) {
      // First time seeing this item - lower progress
      progress = PROGRESS_THRESHOLDS.COMPLETED_OK_FIRST;
      reason = 'completed_ok_first_time';
    } else {
      // Seen before, still completed - higher progress
      progress = PROGRESS_THRESHOLDS.COMPLETED_OK_LATER;
      reason = 'completed_ok_later';
    }
  }
  // 3. HANDLED (טופל) - defect was fixed
  else if (workStatus === WorkStatus.HANDLED) {
    progress = PROGRESS_THRESHOLDS.HANDLED;
    reason = 'handled';
  }
  // 4. DEFECT or NOT_OK (ליקוי, לא תקין) - work done but has defect
  else if (workStatus === WorkStatus.DEFECT || workStatus === WorkStatus.NOT_OK) {
    progress = PROGRESS_THRESHOLDS.DEFECT_WORK_DONE;
    reason = 'defect_work_done';
  }
  // 5. IN_PROGRESS (בטיפול) - work in progress
  else if (workStatus === WorkStatus.IN_PROGRESS) {
    progress = PROGRESS_THRESHOLDS.IN_PROGRESS;
    reason = 'in_progress';
  }
  // 6. PENDING (ממתין) - pending
  else if (workStatus === WorkStatus.PENDING) {
    progress = PROGRESS_THRESHOLDS.PENDING;
    reason = 'pending';
  }
  // 7. NOT_STARTED (לא התחיל)
  else if (workStatus === WorkStatus.NOT_STARTED) {
    progress = PROGRESS_THRESHOLDS.NOT_STARTED;
    reason = 'not_started';
  }
  // 8. Unknown/unrecognized status
  else {
    progress = PROGRESS_THRESHOLDS.UNKNOWN;
    reason = 'unknown_status';
  }
  
  const previousProgress = context.previousProgress || 0;
  
  return {
    progress,
    delta: progress - previousProgress,
    reason,
    hasRegression: progress < previousProgress,
  };
}

/**
 * Main entry point - calculates item progress (V2 - verification-based)
 */
export function calculateItemProgress(
  status: string,
  notes: string | null,
  context?: ProgressContext
): number {
  return calculateItemProgressV2(status, notes, context || {}).progress;
}

export function calculateItemProgressDetailed(
  status: string,
  notes: string | null,
  context?: ProgressContext
): ProgressResult {
  return calculateItemProgressV2(status, notes, context || {});
}

/**
 * Calculate progress for a category using item-level averaging
 * 
 * Each item contributes its individual progress score, then we average.
 * This ensures progress reflects actual item statuses, not just ratios.
 */
export function calculateCategoryProgress(
  items: WorkItemForProgress[],
  previousCategoryProgress: number = 0
): { progress: number; hasRegression: boolean; itemCount: number; verifiedCount: number; defectCount: number } {
  if (items.length === 0) {
    return { progress: 0, hasRegression: false, itemCount: 0, verifiedCount: 0, defectCount: 0 };
  }
  
  let totalProgress = 0;
  let verifiedCount = 0;
  let defectCount = 0;
  
  for (const item of items) {
    // Calculate individual item progress using V2 logic
    const itemResult = calculateItemProgressV2(item.status, item.notes);
    totalProgress += itemResult.progress;
    
    // Count verified and defect items for stats
    if (itemResult.progress >= PROGRESS_THRESHOLDS.VERIFIED_NO_DEFECTS) {
      verifiedCount++;
    }
    if (hasDefect(item.status, item.notes)) {
      defectCount++;
    }
  }
  
  const progress = Math.round(totalProgress / items.length);
  
  return {
    progress,
    hasRegression: progress < previousCategoryProgress,
    itemCount: items.length,
    verifiedCount,
    defectCount,
  };
}

/**
 * Group items by category and calculate progress for each
 */
export function calculateProgressByCategory(
  items: WorkItemForProgress[]
): Map<string, number> {
  const progressMap = new Map<string, number>();
  
  // Group items by category
  const itemsByCategory = new Map<string, WorkItemForProgress[]>();
  for (const item of items) {
    const existing = itemsByCategory.get(item.category) || [];
    existing.push(item);
    itemsByCategory.set(item.category, existing);
  }
  
  // Calculate progress for each category
  for (const [category, categoryItems] of Array.from(itemsByCategory.entries())) {
    const result = calculateCategoryProgress(categoryItems);
    progressMap.set(category, result.progress);
  }
  
  return progressMap;
}

/**
 * Calculate overall progress using weighted category averages
 * This version only considers categories that have items (legacy behavior)
 */
export function calculateOverallProgress(
  categoryProgress: Map<string, number>,
  onlyTrackedCategories: boolean = false
): number {
  if (categoryProgress.size === 0) return 0;
  
  // Use weighted average based on category importance
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const [category, progress] of Array.from(categoryProgress.entries())) {
    const weight = CATEGORY_WEIGHTS[category] || 10;
    weightedSum += progress * weight;
    totalWeight += weight;
  }
  
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Calculate overall progress considering ONLY categories that have ever been seen
 * 
 * Key insight: If a category is NEVER mentioned in any report for an apartment,
 * it's probably not applicable (no kitchen, no sprinklers, etc.) - don't penalize!
 * 
 * - Categories with items in current state: calculated from items
 * - Categories seen before but no items in current state: 90% (graduated/verified)
 * - Categories never seen: IGNORED (not applicable to this apartment)
 * 
 * @param currentCategoryProgress - Progress for categories that have items
 * @param categoriesEverSeen - Set of categories that have been seen in any report
 */
export function calculateOverallProgressWithAllCategories(
  currentCategoryProgress: Map<string, number>,
  categoriesEverSeen: Set<string>
): number {
  // If no categories ever seen, return 0
  if (categoriesEverSeen.size === 0) return 0;
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  // Only consider categories that have EVER been seen for this apartment
  for (const category of Array.from(categoriesEverSeen)) {
    const weight = CATEGORY_WEIGHTS[category] || 10;
    totalWeight += weight;
    
    if (currentCategoryProgress.has(category)) {
      // Category has items - use calculated progress
      weightedSum += (currentCategoryProgress.get(category) || 0) * weight;
    } else {
      // Category was seen before but has no items now = all items graduated/verified
      weightedSum += PROGRESS_THRESHOLDS.CATEGORY_GRADUATED * weight;
    }
  }
  
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Calculate weighted overall progress (same as calculateOverallProgress now)
 */
export function calculateWeightedOverallProgress(
  categoryProgress: Map<string, number>
): number {
  return calculateOverallProgress(categoryProgress);
}

/**
 * Calculate detailed progress information for display
 */
export function calculateDetailedProgress(
  items: WorkItemForProgress[]
): CategoryProgressDetail[] {
  const details: CategoryProgressDetail[] = [];
  
  // Group items by category
  const itemsByCategory = new Map<string, WorkItemForProgress[]>();
  for (const item of items) {
    const existing = itemsByCategory.get(item.category) || [];
    existing.push(item);
    itemsByCategory.set(item.category, existing);
  }
  
  // Calculate details for each category
  for (const [category, categoryItems] of Array.from(itemsByCategory.entries())) {
    const result = calculateCategoryProgress(categoryItems);
    const issues: string[] = [];
    
    for (const item of categoryItems) {
      if (hasNegativeNotes(item.notes) && item.notes) {
        issues.push(item.notes);
      }
    }
    
    details.push({
      category,
      categoryHebrew: CATEGORY_HEBREW_NAMES[category] || category,
      progress: result.progress,
      itemCount: result.itemCount,
      hasIssues: issues.length > 0,
      hasRegression: false,
      issues,
      weight: CATEGORY_WEIGHTS[category] || 10,
    });
  }
  
  return details;
}
