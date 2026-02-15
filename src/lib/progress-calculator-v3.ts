/**
 * Progress Calculator V3 - Refactored Verification-Based Progress
 * 
 * IMPROVEMENT OVER V2: Uses getEffectiveStatus() for cleaner code organization.
 * Logic is IDENTICAL to V2 - this is a code refactoring, not a calculation change.
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
 * 
 * V3 Changes:
 * - Uses getEffectiveStatus() from status-mapper for defect detection
 * - Better code organization and maintainability
 * - Explicitly aligned with defect history chart approach
 * 
 * NOTE: Configuration is now dynamic and can be modified via Admin page.
 * Use getConfig() to get current settings.
 */

import { WorkStatus, isNegativeStatus, hasNegativeNotes, getEffectiveStatus } from './status-mapper';
import { getConfig, DEFAULT_CONFIG, type ProgressConfig } from './progress-config';

// Configuration
export const PROGRESS_MODEL = process.env.PROGRESS_MODEL || 'v2';

// Get dynamic configuration (with fallback to defaults)
function getConfigSafe(): ProgressConfig {
  try {
    return getConfig();
  } catch {
    // Fallback for client-side or when config can't be loaded
    return DEFAULT_CONFIG;
  }
}

// Dynamic getters for configuration values
export function getCategoryWeights(): Record<string, number> {
  return getConfigSafe().categoryWeights;
}

export function getProgressThresholds() {
  return getConfigSafe().progressThresholds;
}

// Legacy exports for backward compatibility (use getters for dynamic values)
export const CATEGORY_WEIGHTS: Record<string, number> = DEFAULT_CONFIG.categoryWeights;
export const STRUCTURAL_BASELINE = DEFAULT_CONFIG.baselineProgress;
export const PROGRESS_THRESHOLDS = DEFAULT_CONFIG.progressThresholds;

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function detectDefectScope(_notes: string | null): DefectScope {
  return 'minor';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function requiresTearOut(_notes: string | null): boolean {
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
 * V3: Uses getEffectiveStatus for cleaner code
 */
export function hasDefect(status: string, notes: string | null): boolean {
  const workStatus = status as WorkStatus;
  const effectiveStatus = getEffectiveStatus(workStatus, notes);
  return isNegativeStatus(effectiveStatus);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getCascadeCategories(_category: string, _notes: string | null): string[] {
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function calculateDefectPenalty(_scope: DefectScope, _needsTearOut: boolean): number {
  return 0;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function calculateScopedRegression(_prev: number, _scope: DefectScope, _tearOut: boolean): number {
  return 0;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function calculateCascadeImpact(cat: string, _notes: string | null, _prog: Map<string, number>) {
  return { primaryCategory: cat, primaryRegression: 0, cascadeEffects: [] };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function calculateProjectBaseline(_prog: Map<string, number>): number {
  return getConfigSafe().baselineProgress;
}

/**
 * V1 Progress Calculation - Simple status-based (uses same thresholds as V3)
 */
export function calculateItemProgressV1(status: string, notes: string | null): number {
  // Delegate to V3 for consistency
  return calculateItemProgressV3(status, notes).progress;
}

/**
 * V2 Progress Calculation - Status-based with proper thresholds (uses same logic as V3)
 * Kept for backward compatibility
 */
export function calculateItemProgressV2(
  status: string,
  notes: string | null,
  context: ProgressContext = {}
): ProgressResult {
  // V2 and V3 have identical logic, V3 just has cleaner implementation
  return calculateItemProgressV3(status, notes, context);
}

/**
 * V3 Progress Calculation - Status-based with proper thresholds
 * Uses getEffectiveStatus() for cleaner logic
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
export function calculateItemProgressV3(
  status: string,
  notes: string | null,
  context: ProgressContext = {}
): ProgressResult {
  const workStatus = status as WorkStatus;
  const effectiveStatus = getEffectiveStatus(workStatus, notes);
  const isFirstTime = context.isFirstTimeSeen !== false; // Default to first time if not specified

  // Get dynamic thresholds
  const thresholds = getProgressThresholds();

  let progress: number;
  let reason: string;

  // Use effective status for all calculations
  // This accounts for both explicit status and notes-based overrides

  // 1. COMPLETED_OK (תקין) - verified complete
  if (effectiveStatus === WorkStatus.COMPLETED_OK) {
    // No issues by definition (effective status handles this)
    progress = thresholds.VERIFIED_NO_DEFECTS;
    reason = 'verified_no_defects';
  }
  // 2. COMPLETED (בוצע) - work completed, check notes and timing
  else if (effectiveStatus === WorkStatus.COMPLETED) {
    // If effective status is COMPLETED, notes don't have issues
    // (otherwise effective status would be DEFECT)
    if (isVerified(notes)) {
      // Notes indicate verification (תקין in notes)
      progress = thresholds.VERIFIED_NO_DEFECTS;
      reason = 'verified_via_notes';
    } else if (isFirstTime) {
      // First time seeing this item - lower progress
      progress = thresholds.COMPLETED_OK_FIRST;
      reason = 'completed_ok_first_time';
    } else {
      // Seen before, still completed - higher progress
      progress = thresholds.COMPLETED_OK_LATER;
      reason = 'completed_ok_later';
    }
  }
  // 3. HANDLED (טופל) - defect was fixed
  else if (effectiveStatus === WorkStatus.HANDLED) {
    progress = thresholds.HANDLED;
    reason = 'handled';
  }
  // 4. DEFECT or NOT_OK (ליקוי, לא תקין) - work done but has defect
  else if (effectiveStatus === WorkStatus.DEFECT || effectiveStatus === WorkStatus.NOT_OK) {
    progress = thresholds.DEFECT_WORK_DONE;
    reason = 'defect_work_done';
  }
  // 5. IN_PROGRESS (בטיפול) - work in progress
  else if (effectiveStatus === WorkStatus.IN_PROGRESS) {
    progress = thresholds.IN_PROGRESS;
    reason = 'in_progress';
  }
  // 6. PENDING (ממתין) - pending
  else if (effectiveStatus === WorkStatus.PENDING) {
    progress = thresholds.PENDING;
    reason = 'pending';
  }
  // 7. NOT_STARTED (לא התחיל)
  else if (effectiveStatus === WorkStatus.NOT_STARTED) {
    progress = thresholds.NOT_STARTED;
    reason = 'not_started';
  }
  // 8. Unknown/unrecognized status
  else {
    progress = thresholds.UNKNOWN;
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
 * Main entry point - calculates item progress (V3 - refactored verification-based)
 */
export function calculateItemProgress(
  status: string,
  notes: string | null,
  context?: ProgressContext
): number {
  return calculateItemProgressV3(status, notes, context || {}).progress;
}

export function calculateItemProgressDetailed(
  status: string,
  notes: string | null,
  context?: ProgressContext
): ProgressResult {
  return calculateItemProgressV3(status, notes, context || {});
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

  // Get dynamic thresholds
  const thresholds = getProgressThresholds();

  let totalProgress = 0;
  let verifiedCount = 0;
  let defectCount = 0;

  for (const item of items) {
    // Calculate individual item progress using V3 logic
    const itemResult = calculateItemProgressV3(item.status, item.notes);
    totalProgress += itemResult.progress;

    // Count verified and defect items for stats
    if (itemResult.progress >= thresholds.VERIFIED_NO_DEFECTS) {
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _onlyTrackedCategories: boolean = false
): number {
  if (categoryProgress.size === 0) return 0;

  // Get dynamic weights
  const weights = getCategoryWeights();
  const config = getConfigSafe();

  // Use weighted average based on category importance
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [category, progress] of Array.from(categoryProgress.entries())) {
    const weight = weights[category] || config.defaultCategoryWeight;
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

  // Get dynamic weights and thresholds
  const weights = getCategoryWeights();
  const thresholds = getProgressThresholds();
  const config = getConfigSafe();

  let weightedSum = 0;
  let totalWeight = 0;

  // Only consider categories that have EVER been seen for this apartment
  for (const category of Array.from(categoriesEverSeen)) {
    const weight = weights[category] || config.defaultCategoryWeight;
    totalWeight += weight;

    if (currentCategoryProgress.has(category)) {
      // Category has items - use calculated progress
      weightedSum += (currentCategoryProgress.get(category) || 0) * weight;
    } else {
      // Category was seen before but has no items now = all items graduated/verified
      weightedSum += thresholds.CATEGORY_GRADUATED * weight;
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

  // Get dynamic weights
  const weights = getCategoryWeights();
  const config = getConfigSafe();

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
      weight: weights[category] || config.defaultCategoryWeight,
    });
  }

  return details;
}
