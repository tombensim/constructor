/**
 * Upload Validation Utilities
 * Validates PDF files and extracted data before processing
 */

// PDF magic bytes - all PDFs start with "%PDF-"
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2D]; // %PDF-

/**
 * Validates that a buffer contains a valid PDF file
 * Checks magic bytes at the start of the file
 */
export function isValidPdfBuffer(buffer: Buffer): { valid: boolean; error?: string } {
  if (buffer.length < 5) {
    return { valid: false, error: 'קובץ קטן מדי - לא יכול להיות PDF תקין' };
  }

  // Check magic bytes
  for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
    if (buffer[i] !== PDF_MAGIC_BYTES[i]) {
      return { valid: false, error: 'הקובץ אינו PDF תקין - חתימת הקובץ שגויה' };
    }
  }

  // Check for PDF EOF marker (should contain %%EOF somewhere near the end)
  const last1024 = buffer.slice(-1024).toString('latin1');
  if (!last1024.includes('%%EOF')) {
    return { valid: false, error: 'הקובץ אינו PDF תקין - חסר סימן סיום קובץ' };
  }

  return { valid: true };
}

/**
 * Expected project identifiers for validation
 */
const VALID_PROJECT_IDENTIFIERS = [
  'מוסינזון 5',
  'מוסינזון',
  'mosinzon',
  'מוסינסון', // Common typo
  'מוסנזון',  // Another typo variant
];

const VALID_CITY_IDENTIFIERS = [
  'תל אביב',
  'תל-אביב',
  'tel aviv',
  'ת"א',
  'תא',
];

/**
 * Extracted data structure for validation
 */
export interface ExtractedReportData {
  reportDate?: string;
  inspector?: string;
  projectName?: string;
  apartments?: Array<{
    apartmentNumber: string;
    workItems?: Array<{
      category: string;
      description: string;
      status: string;
      notes?: string;
    }>;
  }>;
  developmentItems?: Array<{
    category: string;
    description: string;
    status: string;
  }>;
  progressTracking?: Array<{
    apartmentNumber: string;
    category: string;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  confidence: 'high' | 'medium' | 'low' | 'invalid';
}

/**
 * Validates extracted report data structure and content
 */
export function validateExtractedData(data: ExtractedReportData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check basic structure
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['מבנה הנתונים המחולצים שגוי'],
      warnings: [],
      confidence: 'invalid',
    };
  }

  // 2. Check for report date
  if (!data.reportDate) {
    warnings.push('לא נמצא תאריך דוח');
  } else {
    const date = new Date(data.reportDate);
    if (isNaN(date.getTime())) {
      errors.push('תאריך הדוח אינו תקין');
    }
  }

  // 3. Validate project name matches expected project
  const projectName = data.projectName?.toLowerCase() || '';
  const hasValidProject = VALID_PROJECT_IDENTIFIERS.some(id => 
    projectName.includes(id.toLowerCase())
  );
  const hasValidCity = VALID_CITY_IDENTIFIERS.some(id => 
    projectName.includes(id.toLowerCase())
  );

  if (!hasValidProject && projectName.length > 0) {
    errors.push(`הדוח אינו שייך לפרויקט מוסינזון 5 - נמצא: "${data.projectName}"`);
  } else if (!hasValidProject && projectName.length === 0) {
    warnings.push('לא נמצא שם פרויקט בדוח');
  }

  if (hasValidProject && !hasValidCity && projectName.length > 0) {
    warnings.push('לא נמצאה עיר בשם הפרויקט');
  }

  // 4. Check for apartments data
  const apartments = data.apartments || [];
  if (apartments.length === 0 && (!data.developmentItems || data.developmentItems.length === 0)) {
    errors.push('לא נמצאו נתוני דירות או פריטי פיתוח בדוח');
  }

  // 5. Validate apartment numbers match expected apartments
  const validApartments = ['1', '3', '5', '6', '7', '10', '11', '14'];
  const foundApartments = apartments.map(a => a.apartmentNumber);
  const unknownApartments = foundApartments.filter(apt => !validApartments.includes(apt));
  
  if (unknownApartments.length > 0) {
    warnings.push(`נמצאו מספרי דירות לא צפויים: ${unknownApartments.join(', ')}`);
  }

  if (foundApartments.length === 0 && apartments.length > 0) {
    errors.push('לא נמצאו מספרי דירות תקינים');
  }

  // 6. Check for work items
  let totalWorkItems = 0;
  for (const apt of apartments) {
    totalWorkItems += (apt.workItems?.length || 0);
  }
  totalWorkItems += (data.developmentItems?.length || 0);

  if (totalWorkItems === 0) {
    errors.push('לא נמצאו פריטי עבודה בדוח');
  } else if (totalWorkItems < 5) {
    warnings.push(`נמצאו רק ${totalWorkItems} פריטי עבודה - ייתכן שהחילוץ חלקי`);
  }

  // 7. Validate work items have required fields
  let itemsWithMissingFields = 0;
  for (const apt of apartments) {
    for (const item of apt.workItems || []) {
      if (!item.category || !item.status) {
        itemsWithMissingFields++;
      }
    }
  }
  for (const item of data.developmentItems || []) {
    if (!item.category || !item.status) {
      itemsWithMissingFields++;
    }
  }

  if (itemsWithMissingFields > 0) {
    warnings.push(`${itemsWithMissingFields} פריטי עבודה עם שדות חסרים`);
  }

  // Calculate confidence
  let confidence: 'high' | 'medium' | 'low' | 'invalid';
  if (errors.length > 0) {
    confidence = 'invalid';
  } else if (warnings.length === 0 && totalWorkItems >= 10 && hasValidProject) {
    confidence = 'high';
  } else if (warnings.length <= 2 && totalWorkItems >= 5) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    confidence,
  };
}

/**
 * Full validation pipeline for uploaded files
 */
export interface FullValidationResult {
  pdfValid: boolean;
  pdfError?: string;
  dataValid: boolean;
  dataErrors: string[];
  dataWarnings: string[];
  confidence: 'high' | 'medium' | 'low' | 'invalid';
  canProceed: boolean;
  requiresConfirmation: boolean;
}

export function createFullValidationResult(
  pdfValidation: { valid: boolean; error?: string },
  dataValidation: ValidationResult | null
): FullValidationResult {
  if (!pdfValidation.valid) {
    return {
      pdfValid: false,
      pdfError: pdfValidation.error,
      dataValid: false,
      dataErrors: [],
      dataWarnings: [],
      confidence: 'invalid',
      canProceed: false,
      requiresConfirmation: false,
    };
  }

  if (!dataValidation) {
    return {
      pdfValid: true,
      dataValid: false,
      dataErrors: ['שגיאה בחילוץ נתונים מהקובץ'],
      dataWarnings: [],
      confidence: 'invalid',
      canProceed: false,
      requiresConfirmation: false,
    };
  }

  // Can proceed if no critical errors
  // Requires confirmation if there are warnings or low confidence
  const canProceed = dataValidation.valid;
  const requiresConfirmation = dataValidation.warnings.length > 0 || 
                                dataValidation.confidence === 'low';

  return {
    pdfValid: true,
    dataValid: dataValidation.valid,
    dataErrors: dataValidation.errors,
    dataWarnings: dataValidation.warnings,
    confidence: dataValidation.confidence,
    canProceed,
    requiresConfirmation,
  };
}
