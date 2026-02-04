// Status enums and Hebrew mapping for construction progress tracking

export enum WorkStatus {
  COMPLETED = 'COMPLETED',
  COMPLETED_OK = 'COMPLETED_OK',
  NOT_OK = 'NOT_OK',
  DEFECT = 'DEFECT',
  IN_PROGRESS = 'IN_PROGRESS',
  HANDLED = 'HANDLED',
  PENDING = 'PENDING',
  NOT_STARTED = 'NOT_STARTED',
}

// Hebrew to English status mapping
const hebrewStatusMap: Record<string, WorkStatus> = {
  'בוצע': WorkStatus.COMPLETED,
  'בוצע - תקין': WorkStatus.COMPLETED_OK,
  'תקין': WorkStatus.COMPLETED_OK,
  'לא תקין': WorkStatus.NOT_OK,
  'ליקוי': WorkStatus.DEFECT,
  'בטיפול': WorkStatus.IN_PROGRESS,
  'טופל': WorkStatus.HANDLED,
  'ממתין': WorkStatus.PENDING,
  'לא התחיל': WorkStatus.NOT_STARTED,
  'בביצוע': WorkStatus.IN_PROGRESS,
  'הושלם': WorkStatus.COMPLETED,
  'נמצא ליקוי': WorkStatus.DEFECT,
  'תוקן': WorkStatus.HANDLED,
  // Additional statuses found in PDFs
  'קיימים אי תאומים': WorkStatus.DEFECT,
  'קיימים אי תיאומים': WorkStatus.DEFECT,
  'אי תאומים': WorkStatus.DEFECT,
  'אי תיאומים': WorkStatus.DEFECT,
  'יש הערות': WorkStatus.DEFECT,
  'בוצע - יש הערות': WorkStatus.DEFECT,
  'בוצע - יש ליקויים': WorkStatus.DEFECT,
  'בוצע - נמצאו אי תאומים': WorkStatus.DEFECT,
  'בוצע - נמצאו אי תיאומים': WorkStatus.DEFECT,
  'נמצאו אי תאומים': WorkStatus.DEFECT,
  'נמצאו אי תיאומים': WorkStatus.DEFECT,
  'בוצע חלקי': WorkStatus.DEFECT,  // Partially completed = defect (work not finished)
  'בוצע חלקית': WorkStatus.DEFECT, // Partially completed = defect (work not finished)
  'לטיפול': WorkStatus.PENDING,
  'נדרש מעקב': WorkStatus.PENDING,
  'נדרש ביצוע': WorkStatus.PENDING,
  'בוצע עם הערות': WorkStatus.DEFECT,
};

export function normalizeStatus(hebrewStatus: string): WorkStatus {
  const trimmed = hebrewStatus.trim();

  // Direct match
  if (hebrewStatusMap[trimmed]) {
    return hebrewStatusMap[trimmed];
  }

  // Partial match - check if any key is contained in the status
  for (const [hebrew, status] of Object.entries(hebrewStatusMap)) {
    if (trimmed.includes(hebrew)) {
      return status;
    }
  }

  // Default to IN_PROGRESS if unknown
  console.warn(`Unknown status: "${hebrewStatus}", defaulting to IN_PROGRESS`);
  return WorkStatus.IN_PROGRESS;
}

// English display names for statuses
export const statusDisplayNames: Record<WorkStatus, string> = {
  [WorkStatus.COMPLETED]: 'Completed',
  [WorkStatus.COMPLETED_OK]: 'Completed OK',
  [WorkStatus.NOT_OK]: 'Not OK',
  [WorkStatus.DEFECT]: 'Defect',
  [WorkStatus.IN_PROGRESS]: 'In Progress',
  [WorkStatus.HANDLED]: 'Handled',
  [WorkStatus.PENDING]: 'Pending',
  [WorkStatus.NOT_STARTED]: 'Not Started',
};

// Hebrew display names for statuses
export const statusHebrewNames: Record<WorkStatus, string> = {
  [WorkStatus.COMPLETED]: 'בוצע',
  [WorkStatus.COMPLETED_OK]: 'בוצע - תקין',
  [WorkStatus.NOT_OK]: 'לא תקין',
  [WorkStatus.DEFECT]: 'ליקוי',
  [WorkStatus.IN_PROGRESS]: 'בטיפול',
  [WorkStatus.HANDLED]: 'טופל',
  [WorkStatus.PENDING]: 'ממתין',
  [WorkStatus.NOT_STARTED]: 'לא התחיל',
};

// Status colors for UI
export const statusColors: Record<WorkStatus, string> = {
  [WorkStatus.COMPLETED]: '#22c55e', // green-500
  [WorkStatus.COMPLETED_OK]: '#22c55e', // green-500
  [WorkStatus.NOT_OK]: '#ef4444', // red-500
  [WorkStatus.DEFECT]: '#f97316', // orange-500
  [WorkStatus.IN_PROGRESS]: '#3b82f6', // blue-500
  [WorkStatus.HANDLED]: '#a855f7', // purple-500
  [WorkStatus.PENDING]: '#6b7280', // gray-500
  [WorkStatus.NOT_STARTED]: '#9ca3af', // gray-400
};

// Check if status is considered "positive" (completed successfully)
export function isPositiveStatus(status: WorkStatus): boolean {
  return status === WorkStatus.COMPLETED ||
         status === WorkStatus.COMPLETED_OK ||
         status === WorkStatus.HANDLED;
}

// Check if status is considered "negative" (has issues)
export function isNegativeStatus(status: WorkStatus): boolean {
  return status === WorkStatus.NOT_OK || status === WorkStatus.DEFECT;
}

// Negative keywords that indicate issues even if status says "completed"
const NEGATIVE_KEYWORDS = [
  'אי תיאומים',
  'אי תאומים',
  'נמצאו אי',
  'קיימים אי',
  'יש הערות',
  'יש ליקויים',
  'ליקוי',
  'ליקויים',
  'לא תקין',
  'חסר',
  'חסרות',
  'חסרים',
  'חסרה',
  'שבור',
  'שבורים',
  'שבורה',
  'סדוק',
  'סדוקים',
  'פגם',
  'פגמים',
  'בעיה',
  'בעיות',
  'לתקן',
  'תיקון',
  'תיקונים',
  'לא בוצע',
  'לא הותקן',
  'לא הותקנו',
  'לא הושלם',
  'נזק',
  'נזקים',
  'missing',
  'defect',
  'חתוך',
  'להחליף',
];

// Check if notes contain negative keywords indicating issues
export function hasNegativeNotes(notes: string | null | undefined): boolean {
  if (!notes) return false;
  const lowerNotes = notes.toLowerCase();
  return NEGATIVE_KEYWORDS.some(keyword => lowerNotes.includes(keyword.toLowerCase()));
}

// Determine effective status considering both status and notes
export function getEffectiveStatus(status: WorkStatus, notes: string | null | undefined): WorkStatus {
  // If status is already negative, keep it
  if (isNegativeStatus(status)) {
    return status;
  }
  
  // If status is positive but notes indicate issues, override to DEFECT
  if (isPositiveStatus(status) && hasNegativeNotes(notes)) {
    return WorkStatus.DEFECT;
  }
  
  return status;
}

// Check if item is truly completed (positive status AND no negative notes)
export function isTrulyCompleted(status: WorkStatus, notes: string | null | undefined): boolean {
  return isPositiveStatus(status) && !hasNegativeNotes(notes);
}

// Work categories
export enum WorkCategory {
  ELECTRICAL = 'ELECTRICAL',
  PLUMBING = 'PLUMBING',
  AC = 'AC',
  FLOORING = 'FLOORING',       // Includes ריצוף, חיפוי, מישק, פנלים
  SPRINKLERS = 'SPRINKLERS',   // Includes כיבוי אש, תוכניות כיבוי
  DRYWALL = 'DRYWALL',         // הנמכות, גבס, סינרים, קונסטרוקציה
  WATERPROOFING = 'WATERPROOFING',
  PAINTING = 'PAINTING',       // צבע, יד ראשונה/שניה
  KITCHEN = 'KITCHEN',
  OTHER = 'OTHER',             // אחר - includes סניטריה, חלונות, דלת כניסה, פיתוח, כללי
}

// Fixed display order for categories - OTHER always last
export const CATEGORY_DISPLAY_ORDER: WorkCategory[] = [
  WorkCategory.ELECTRICAL,
  WorkCategory.PLUMBING,
  WorkCategory.AC,
  WorkCategory.FLOORING,
  WorkCategory.SPRINKLERS,
  WorkCategory.DRYWALL,
  WorkCategory.WATERPROOFING,
  WorkCategory.PAINTING,
  WorkCategory.KITCHEN,
  WorkCategory.OTHER,  // Always last
];

// Hebrew to English category mapping
const hebrewCategoryMap: Record<string, WorkCategory> = {
  // חשמל
  'חשמל': WorkCategory.ELECTRICAL,
  // אינסטלציה
  'אינסטלציה': WorkCategory.PLUMBING,
  // מיזוג
  'מיזוג': WorkCategory.AC,
  'מיזוג אויר': WorkCategory.AC,
  // ריצוף (includes חיפוי, מישק, פנלים)
  'ריצוף': WorkCategory.FLOORING,
  'חיפוי': WorkCategory.FLOORING,
  'מישק': WorkCategory.FLOORING,
  'פנלים': WorkCategory.FLOORING,
  // ספרינקלרים (includes כיבוי אש)
  'ספרינקלרים': WorkCategory.SPRINKLERS,
  'ספרינקלר': WorkCategory.SPRINKLERS,
  'כיבוי': WorkCategory.SPRINKLERS,
  'כיבוי אש': WorkCategory.SPRINKLERS,
  // גבס
  'גבס': WorkCategory.DRYWALL,
  'הנמכות': WorkCategory.DRYWALL,
  'הנמכה': WorkCategory.DRYWALL,
  'סינרים': WorkCategory.DRYWALL,
  'קונסטרוקציה': WorkCategory.DRYWALL,
  // איטום
  'איטום': WorkCategory.WATERPROOFING,
  // צבע
  'צביעה': WorkCategory.PAINTING,
  'צבע': WorkCategory.PAINTING,
  // מטבח
  'מטבח': WorkCategory.KITCHEN,
  // אחר (OTHER) - includes חלונות, דלת כניסה, סניטריה, פיתוח, כללי
  'חלונות': WorkCategory.OTHER,
  'דלת כניסה': WorkCategory.OTHER,
  'כללי': WorkCategory.OTHER,
  'סניטריה': WorkCategory.OTHER,
  'פיתוח': WorkCategory.OTHER,
  'עבודות פיתוח': WorkCategory.OTHER,
  'אחר': WorkCategory.OTHER,
};

export function normalizeCategory(hebrewCategory: string): WorkCategory {
  const trimmed = hebrewCategory.trim();

  // Direct match
  if (hebrewCategoryMap[trimmed]) {
    return hebrewCategoryMap[trimmed];
  }

  // Partial match
  for (const [hebrew, category] of Object.entries(hebrewCategoryMap)) {
    if (trimmed.includes(hebrew)) {
      return category;
    }
  }

  // Default to OTHER if unknown
  console.warn(`Unknown category: "${hebrewCategory}", defaulting to OTHER`);
  return WorkCategory.OTHER;
}

// English display names for categories
export const categoryDisplayNames: Record<WorkCategory, string> = {
  [WorkCategory.ELECTRICAL]: 'Electrical',
  [WorkCategory.PLUMBING]: 'Plumbing',
  [WorkCategory.AC]: 'Air Conditioning',
  [WorkCategory.FLOORING]: 'Flooring & Tiling',
  [WorkCategory.SPRINKLERS]: 'Sprinklers & Fire',
  [WorkCategory.DRYWALL]: 'Drywall',
  [WorkCategory.WATERPROOFING]: 'Waterproofing',
  [WorkCategory.PAINTING]: 'Painting',
  [WorkCategory.KITCHEN]: 'Kitchen',
  [WorkCategory.OTHER]: 'Other',
};

// Hebrew display names for categories
export const categoryHebrewNames: Record<WorkCategory, string> = {
  [WorkCategory.ELECTRICAL]: 'חשמל',
  [WorkCategory.PLUMBING]: 'אינסטלציה',
  [WorkCategory.AC]: 'מיזוג אויר',
  [WorkCategory.FLOORING]: 'ריצוף וחיפוי',
  [WorkCategory.SPRINKLERS]: 'ספרינקלרים וכיבוי',
  [WorkCategory.DRYWALL]: 'גבס והנמכות',
  [WorkCategory.WATERPROOFING]: 'איטום',
  [WorkCategory.PAINTING]: 'צבע',
  [WorkCategory.KITCHEN]: 'מטבח',
  [WorkCategory.OTHER]: 'אחר',
};

// Category colors for UI
export const categoryColors: Record<WorkCategory, string> = {
  [WorkCategory.ELECTRICAL]: '#f59e0b', // amber-500
  [WorkCategory.PLUMBING]: '#3b82f6', // blue-500
  [WorkCategory.AC]: '#06b6d4', // cyan-500
  [WorkCategory.FLOORING]: '#a3e635', // lime-400
  [WorkCategory.SPRINKLERS]: '#ef4444', // red-500
  [WorkCategory.DRYWALL]: '#a855f7', // purple-500
  [WorkCategory.WATERPROOFING]: '#6366f1', // indigo-500
  [WorkCategory.PAINTING]: '#ec4899', // pink-500
  [WorkCategory.KITCHEN]: '#f97316', // orange-500
  [WorkCategory.OTHER]: '#6b7280', // gray-500
};

// Sort categories by fixed display order (OTHER always last)
export function sortCategoriesByDisplayOrder<T extends { category: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const indexA = CATEGORY_DISPLAY_ORDER.indexOf(a.category as WorkCategory);
    const indexB = CATEGORY_DISPLAY_ORDER.indexOf(b.category as WorkCategory);
    // If not found in order, put at end (before OTHER)
    const orderA = indexA === -1 ? CATEGORY_DISPLAY_ORDER.length - 1 : indexA;
    const orderB = indexB === -1 ? CATEGORY_DISPLAY_ORDER.length - 1 : indexB;
    return orderA - orderB;
  });
}
