/**
 * Progress Calculator
 * 
 * This file re-exports from progress-calculator-v3.ts which contains:
 * - V1: Original simple progress calculation (for backward compatibility)
 * - V2: Industry-weighted progress (for backward compatibility)
 * - V3: Refactored with getEffectiveStatus() for cleaner code (default)
 * 
 * V3 produces identical results to V2 - it's a code organization improvement.
 * 
 * To switch between models, set the PROGRESS_MODEL environment variable:
 * - PROGRESS_MODEL=v1  -> Use original simple calculation
 * - PROGRESS_MODEL=v2  -> Use industry-weighted calculation
 * - PROGRESS_MODEL=v3  -> Use refactored calculation (default)
 * 
 * All exports maintain backward compatibility with existing code.
 */

// Re-export everything from V3 (which includes V1 and V2 compatibility)
export {
  // Configuration
  PROGRESS_MODEL,
  CATEGORY_WEIGHTS,
  STRUCTURAL_BASELINE,
  PROGRESS_THRESHOLDS,
  getCategoryWeights,
  getProgressThresholds,

  // Types
  type DefectScope,
  type DefectImpact,
  type ProgressContext,
  type ProgressResult,
  type WorkItemForProgress,
  type CategoryProgressDetail,
  type ApartmentCategory,

  // Constants
  STANDARD_APARTMENT_CATEGORIES,
  CATEGORY_HEBREW_NAMES,

  // Core calculation functions (unified interface - uses V1/V2/V3 based on config)
  calculateItemProgress,
  calculateCategoryProgress,
  calculateOverallProgress,
  calculateOverallProgressWithAllCategories,
  calculateProgressByCategory,
  calculateDetailedProgress,
  calculateWeightedOverallProgress,

  // Versioned functions
  calculateItemProgressV1,
  calculateItemProgressV2,
  calculateItemProgressV3,
  calculateItemProgressDetailed,

  // Helper functions
  detectDefectScope,
  requiresTearOut,
  isVerified,
  isTrulyVerified,
  hasDefect,
  getCascadeCategories,
  calculateScopedRegression,
  calculateDefectPenalty,
  calculateCascadeImpact,
  calculateProjectBaseline,
} from './progress-calculator-v3';

// Legacy imports for backward compatibility
import { WorkStatus, isNegativeStatus, hasNegativeNotes } from './status-mapper';
import {
  calculateProgressByCategory as calcProgressByCategory,
  calculateOverallProgress as calcOverallProgress,
  type WorkItemForProgress
} from './progress-calculator-v3';

/**
 * Progress data for a single report
 */
export interface ReportProgress {
  reportDate: Date;
  reportId: string;
  overallProgress: number;
  categoryProgress: Map<string, number>;
  totalIssues: number;
}

/**
 * Calculate progress timeline across multiple reports
 * (Maintains original signature for backward compatibility)
 */
export function calculateProgressTimeline(
  reportItems: Array<{
    reportId: string;
    reportDate: Date;
    items: WorkItemForProgress[];
  }>
): ReportProgress[] {
  return reportItems.map(report => {
    const categoryProgress = calcProgressByCategory(report.items);
    const overallProgress = calcOverallProgress(categoryProgress, true);

    // Count items with issues
    const totalIssues = report.items.filter(item =>
      hasNegativeNotes(item.notes) || isNegativeStatus(item.status as WorkStatus)
    ).length;

    return {
      reportDate: report.reportDate,
      reportId: report.reportId,
      overallProgress,
      categoryProgress,
      totalIssues,
    };
  });
}
