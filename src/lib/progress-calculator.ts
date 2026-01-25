/**
 * Progress Calculator
 * 
 * This file re-exports from progress-calculator-v2.ts which contains:
 * - V1: Original simple progress calculation (for backward compatibility)
 * - V2: Industry-weighted progress with scope-based regression
 * 
 * To switch between models, set the PROGRESS_MODEL environment variable:
 * - PROGRESS_MODEL=v1  -> Use original simple calculation
 * - PROGRESS_MODEL=v2  -> Use industry-weighted calculation (default)
 * 
 * All exports maintain backward compatibility with existing code.
 */

// Re-export everything from V2 (which includes V1 compatibility)
export {
  // Configuration
  PROGRESS_MODEL,
  CATEGORY_WEIGHTS,
  STRUCTURAL_BASELINE,
  PROGRESS_THRESHOLDS,
  
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
  
  // Core calculation functions (unified interface - uses V1 or V2 based on config)
  calculateItemProgress,
  calculateCategoryProgress,
  calculateOverallProgress,
  calculateOverallProgressWithAllCategories,
  calculateProgressByCategory,
  calculateDetailedProgress,
  calculateWeightedOverallProgress,
  
  // V2-specific functions
  calculateItemProgressV2,
  calculateItemProgressDetailed,
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
  
  // V1 original function (for explicit use)
  calculateItemProgressV1,
} from './progress-calculator-v2';

// Legacy imports for backward compatibility
import { WorkStatus, isNegativeStatus, hasNegativeNotes } from './status-mapper';
import { 
  calculateProgressByCategory as calcProgressByCategory,
  calculateOverallProgress as calcOverallProgress,
  type WorkItemForProgress 
} from './progress-calculator-v2';

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
