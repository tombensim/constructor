/**
 * Progress Configuration Management
 * 
 * Stores and retrieves progress calculation parameters.
 * Allows dynamic configuration through the Admin UI.
 */

import * as fs from 'fs';
import * as path from 'path';

// Default configuration values
export const DEFAULT_CONFIG: ProgressConfig = {
  // Category weights (must sum to 100)
  categoryWeights: {
    ELECTRICAL: 12,
    PLUMBING: 10,
    SPRINKLERS: 5,
    WATERPROOFING: 5,
    DRYWALL: 10,
    FLOORING: 15,
    AC: 8,
    PAINTING: 10,
    KITCHEN: 10,
    OTHER: 15,
  },
  
  // Progress thresholds for different statuses (0-100)
  progressThresholds: {
    VERIFIED_NO_DEFECTS: 90,      // תקין, verified with no issues
    CATEGORY_GRADUATED: 90,       // Category was seen before, now absent = approved
    ITEM_FIXED: 90,               // Item had defect, now disappeared = fixed
    COMPLETED_OK_LATER: 75,       // בוצע - completed OK (seen in later reports)
    COMPLETED_OK_FIRST: 50,       // בוצע - first time seen
    HANDLED: 70,                  // טופל - defect was fixed
    COMPLETED_WITH_ISSUES: 65,    // Completed but has issues in notes
    DEFECT_WORK_DONE: 55,         // ליקוי - work done but has defect
    IN_PROGRESS: 30,              // בטיפול - work in progress
    PENDING: 15,                  // ממתין - pending
    UNKNOWN: 15,                  // Unknown/unrecognized status
    NOT_STARTED: 5,               // לא התחיל - not started
    CATEGORY_NEVER_SEEN: 0,       // Category never reported = work not started
  },
  
  // General parameters
  baselineProgress: 30,           // Starting progress (pre-supervision work)
  maxProgress: 95,                // Maximum achievable progress
  defectPenalty: 5,               // Penalty per defect ratio point
  defaultCategoryWeight: 10,      // Weight for unknown categories
  
  // Last updated timestamp
  lastUpdated: null,
};

export interface ProgressConfig {
  categoryWeights: Record<string, number>;
  progressThresholds: {
    VERIFIED_NO_DEFECTS: number;
    CATEGORY_GRADUATED: number;
    ITEM_FIXED: number;
    COMPLETED_OK_LATER: number;
    COMPLETED_OK_FIRST: number;
    HANDLED: number;
    COMPLETED_WITH_ISSUES: number;
    DEFECT_WORK_DONE: number;
    IN_PROGRESS: number;
    PENDING: number;
    UNKNOWN: number;
    NOT_STARTED: number;
    CATEGORY_NEVER_SEEN: number;
  };
  baselineProgress: number;
  maxProgress: number;
  defectPenalty: number;
  defaultCategoryWeight: number;
  lastUpdated: string | null;
}

// Hebrew names for categories (for display)
export const CATEGORY_HEBREW_NAMES: Record<string, string> = {
  ELECTRICAL: 'חשמל',
  PLUMBING: 'אינסטלציה',
  AC: 'מיזוג אוויר',
  FLOORING: 'ריצוף וחיפוי',
  SPRINKLERS: 'ספרינקלרים וכיבוי',
  DRYWALL: 'גבס והנמכות',
  WATERPROOFING: 'איטום',
  PAINTING: 'צבע',
  KITCHEN: 'מטבח',
  OTHER: 'אחר',
};

// Hebrew names for thresholds (for display)
export const THRESHOLD_HEBREW_NAMES: Record<string, string> = {
  VERIFIED_NO_DEFECTS: 'תקין / מאומת',
  CATEGORY_GRADUATED: 'קטגוריה הושלמה',
  ITEM_FIXED: 'פריט תוקן',
  COMPLETED_OK_LATER: 'בוצע (נראה שוב)',
  COMPLETED_OK_FIRST: 'בוצע (פעם ראשונה)',
  HANDLED: 'טופל',
  COMPLETED_WITH_ISSUES: 'הושלם עם הערות',
  DEFECT_WORK_DONE: 'ליקוי',
  IN_PROGRESS: 'בטיפול',
  PENDING: 'ממתין',
  UNKNOWN: 'לא ידוע',
  NOT_STARTED: 'לא התחיל',
  CATEGORY_NEVER_SEEN: 'קטגוריה לא נבדקה',
};

// Description for each threshold
export const THRESHOLD_DESCRIPTIONS: Record<string, string> = {
  VERIFIED_NO_DEFECTS: 'סטטוס "תקין" או אימות חיובי בהערות',
  CATEGORY_GRADUATED: 'קטגוריה נבדקה בעבר ולא מופיעה עוד = הושלמה',
  ITEM_FIXED: 'פריט עם ליקוי שנעלם מהדוח = תוקן',
  COMPLETED_OK_LATER: 'סטטוס "בוצע" שנראה בדוחות קודמים',
  COMPLETED_OK_FIRST: 'סטטוס "בוצע" בפעם הראשונה',
  HANDLED: 'סטטוס "טופל" - ליקוי תוקן',
  COMPLETED_WITH_ISSUES: 'סטטוס חיובי אך הערות שליליות',
  DEFECT_WORK_DONE: 'סטטוס "ליקוי" או "לא תקין"',
  IN_PROGRESS: 'סטטוס "בטיפול"',
  PENDING: 'סטטוס "ממתין"',
  UNKNOWN: 'סטטוס לא מזוהה',
  NOT_STARTED: 'סטטוס "לא התחיל"',
  CATEGORY_NEVER_SEEN: 'קטגוריה שמעולם לא נבדקה',
};

const CONFIG_FILE_PATH = path.join(process.cwd(), 'data', 'progress-config.json');

/**
 * Load configuration from file, or return defaults if not found
 */
export function loadConfig(): ProgressConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const config = JSON.parse(data) as ProgressConfig;
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_CONFIG,
        ...config,
        categoryWeights: {
          ...DEFAULT_CONFIG.categoryWeights,
          ...config.categoryWeights,
        },
        progressThresholds: {
          ...DEFAULT_CONFIG.progressThresholds,
          ...config.progressThresholds,
        },
      };
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Save configuration to file
 */
export function saveConfig(config: ProgressConfig): void {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Update timestamp
    config.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
}

/**
 * Validate configuration values
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfig(config: ProgressConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check category weights sum to 100
  const weightSum = Object.values(config.categoryWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 100) > 0.01) {
    errors.push(`משקלי הקטגוריות חייבים להסתכם ל-100% (סה"כ נוכחי: ${weightSum}%)`);
  }
  
  // Check all weights are positive
  for (const [cat, weight] of Object.entries(config.categoryWeights)) {
    if (weight < 0) {
      errors.push(`משקל קטגוריה "${CATEGORY_HEBREW_NAMES[cat] || cat}" לא יכול להיות שלילי`);
    }
    if (weight === 0) {
      warnings.push(`משקל קטגוריה "${CATEGORY_HEBREW_NAMES[cat] || cat}" הוא 0 - הקטגוריה לא תשפיע על ההתקדמות`);
    }
  }
  
  // Check thresholds are between 0 and 100
  for (const [key, value] of Object.entries(config.progressThresholds)) {
    if (value < 0 || value > 100) {
      errors.push(`ערך סף "${THRESHOLD_HEBREW_NAMES[key] || key}" חייב להיות בין 0 ל-100`);
    }
  }
  
  // Check logical ordering of thresholds
  const t = config.progressThresholds;
  
  if (t.VERIFIED_NO_DEFECTS <= t.COMPLETED_OK_LATER) {
    warnings.push('ערך "תקין" צריך להיות גבוה יותר מ"בוצע (נראה שוב)"');
  }
  if (t.COMPLETED_OK_LATER <= t.COMPLETED_OK_FIRST) {
    warnings.push('ערך "בוצע (נראה שוב)" צריך להיות גבוה יותר מ"בוצע (פעם ראשונה)"');
  }
  if (t.HANDLED <= t.DEFECT_WORK_DONE) {
    warnings.push('ערך "טופל" צריך להיות גבוה יותר מ"ליקוי"');
  }
  if (t.DEFECT_WORK_DONE <= t.IN_PROGRESS) {
    warnings.push('ערך "ליקוי" צריך להיות גבוה יותר מ"בטיפול"');
  }
  if (t.IN_PROGRESS <= t.PENDING) {
    warnings.push('ערך "בטיפול" צריך להיות גבוה יותר מ"ממתין"');
  }
  if (t.PENDING <= t.NOT_STARTED) {
    warnings.push('ערך "ממתין" צריך להיות גבוה יותר מ"לא התחיל"');
  }
  
  // Check baseline and max progress
  if (config.baselineProgress < 0 || config.baselineProgress > 100) {
    errors.push('התקדמות בסיס חייבת להיות בין 0 ל-100');
  }
  if (config.maxProgress < 0 || config.maxProgress > 100) {
    errors.push('התקדמות מקסימלית חייבת להיות בין 0 ל-100');
  }
  if (config.baselineProgress >= config.maxProgress) {
    errors.push('התקדמות בסיס חייבת להיות נמוכה מהתקדמות מקסימלית');
  }
  
  // Check default weight
  if (config.defaultCategoryWeight < 0) {
    errors.push('משקל ברירת מחדל לקטגוריה לא יכול להיות שלילי');
  }
  
  // Check defect penalty
  if (config.defectPenalty < 0) {
    errors.push('קנס ליקוי לא יכול להיות שלילי');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get current configuration for use in progress calculations
 * This is a cached version that can be imported anywhere
 */
let cachedConfig: ProgressConfig | null = null;

export function getConfig(): ProgressConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
