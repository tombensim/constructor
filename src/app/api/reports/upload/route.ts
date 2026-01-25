import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import { 
  isValidPdfBuffer, 
  validateExtractedData, 
  createFullValidationResult,
  ExtractedReportData as ValidationExtractedData,
} from '@/lib/upload-validation';
import { createSnapshot, cleanupOldSnapshots } from '@/lib/snapshot';

const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Status mapping
const hebrewStatusMap: Record<string, string> = {
  'בוצע': 'COMPLETED',
  'בוצע - תקין': 'COMPLETED_OK',
  'תקין': 'COMPLETED_OK',
  'לא תקין': 'NOT_OK',
  'ליקוי': 'DEFECT',
  'בטיפול': 'IN_PROGRESS',
  'טופל': 'HANDLED',
  'ממתין': 'PENDING',
  'לא התחיל': 'NOT_STARTED',
  'בביצוע': 'IN_PROGRESS',
  'הושלם': 'COMPLETED',
  'נמצא ליקוי': 'DEFECT',
  'תוקן': 'HANDLED',
  'קיימים אי תאומים': 'DEFECT',
  'קיימים אי תיאומים': 'DEFECT',
  'אי תאומים': 'DEFECT',
  'אי תיאומים': 'DEFECT',
  'יש הערות': 'DEFECT',
  'בוצע - יש הערות': 'DEFECT',
  'בוצע - יש ליקויים': 'DEFECT',
  'בוצע - נמצאו אי תאומים': 'DEFECT',
  'בוצע - נמצאו אי תיאומים': 'DEFECT',
  'נמצאו אי תאומים': 'DEFECT',
  'נמצאו אי תיאומים': 'DEFECT',
  'בוצע חלקי': 'IN_PROGRESS',
  'לטיפול': 'PENDING',
  'נדרש מעקב': 'PENDING',
  'נדרש ביצוע': 'PENDING',
  'בוצע עם הערות': 'DEFECT',
};

// Category mapping
const hebrewCategoryMap: Record<string, string> = {
  'חשמל': 'ELECTRICAL',
  'אינסטלציה': 'PLUMBING',
  'מיזוג': 'AC',
  'מיזוג אויר': 'AC',
  'ריצוף': 'FLOORING',
  'חיפוי': 'FLOORING',
  'ספרינקלרים': 'SPRINKLERS',
  'ספרינקלר': 'SPRINKLERS',
  'כיבוי': 'SPRINKLERS',
  'כיבוי אש': 'SPRINKLERS',
  'גבס': 'DRYWALL',
  'הנמכות': 'DRYWALL',
  'איטום': 'WATERPROOFING',
  'צביעה': 'PAINTING',
  'צבע': 'PAINTING',
  'מטבח': 'KITCHEN',
  'חלונות': 'OTHER',
  'דלת כניסה': 'OTHER',
  'כללי': 'OTHER',
  'סניטריה': 'OTHER',
  'פיתוח': 'OTHER',
  'עבודות פיתוח': 'OTHER',
  'אחר': 'OTHER',
};

// Defect keywords
const DEFECT_KEYWORDS = [
  'אי תיאומים', 'אי תאומים', 'נמצאו אי', 'קיימים אי',
  'יש הערות', 'יש ליקויים', 'ליקוי', 'ליקויים',
  'לא תקין', 'חסר', 'חסרה', 'חסרות', 'חסרים',
  'שבור', 'שבורה', 'שבורים', 'סדוק', 'סדוקה', 'סדוקים',
  'פגם', 'פגמים', 'בעיה', 'בעיות', 'לתקן', 'תיקון',
  'לא בוצע', 'לא הותקן', 'לא הותקנו', 'חתוך', 'חתוכים',
  'להחליף', 'החלפה', 'נזק', 'נזקים', 'לא הושלם', 'טעון',
];

const PARTIAL_KEYWORDS = ['חלקי', 'חלקית', 'בביצוע', 'בטיפול'];

// Extract date from filename - supports multiple formats
function extractDateFromFilename(filename: string): Date | null {
  // Format 1: YYYY-MM-DD at the start (e.g., "2024-11-03 - מוסינזון...")
  const isoMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    const date = new Date(isoMatch[1]);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Format 2: DD.MM.YY or DD.MM.YYYY at the end (e.g., "...18.9.23.pdf")
  const ddmmyyMatch = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\.pdf)?$/i);
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1]);
    const month = parseInt(ddmmyyMatch[2]) - 1;
    let year = parseInt(ddmmyyMatch[3]);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Format 3: DD.MM.YY anywhere in the filename
  const middleMatch = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (middleMatch) {
    const day = parseInt(middleMatch[1]);
    const month = parseInt(middleMatch[2]) - 1;
    let year = parseInt(middleMatch[3]);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function normalizeStatus(hebrewStatus: string, notes: string | null = null): string {
  const trimmed = hebrewStatus.trim().toLowerCase();
  const combinedText = [hebrewStatus, notes].filter(Boolean).join(' ').toLowerCase();
  
  for (const keyword of DEFECT_KEYWORDS) {
    if (combinedText.includes(keyword.toLowerCase())) {
      return 'DEFECT';
    }
  }
  
  for (const keyword of PARTIAL_KEYWORDS) {
    if (trimmed.includes(keyword.toLowerCase())) {
      return 'IN_PROGRESS';
    }
  }
  
  if (hebrewStatusMap[hebrewStatus.trim()]) {
    return hebrewStatusMap[hebrewStatus.trim()];
  }
  
  const sortedEntries = Object.entries(hebrewStatusMap).sort((a, b) => b[0].length - a[0].length);
  for (const [hebrew, status] of sortedEntries) {
    if (trimmed.includes(hebrew.toLowerCase())) {
      return status;
    }
  }
  
  return 'IN_PROGRESS';
}

function normalizeCategory(hebrewCategory: string): string {
  const trimmed = hebrewCategory.trim();
  
  if (hebrewCategoryMap[trimmed]) return hebrewCategoryMap[trimmed];
  
  for (const [hebrew, category] of Object.entries(hebrewCategoryMap)) {
    if (trimmed.includes(hebrew)) return category;
  }
  
  return 'OTHER';
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const trimmed = dateStr.trim();
  
  if (trimmed.includes('תקין') || trimmed.includes('לא תקין') || trimmed.includes('קיימים')) {
    return null;
  }
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
  }
  
  const ddmmyy = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (ddmmyy) {
    let year = parseInt(ddmmyy[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, parseInt(ddmmyy[2]) - 1, parseInt(ddmmyy[1]));
    if (!isNaN(date.getTime())) return date;
  }
  
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) return date;
  
  return null;
}

const EXTRACTION_PROMPT = `You are analyzing a Hebrew construction progress report PDF for a TAMA 38/2 urban renewal project at Mosinzon 5, Tel Aviv.

Extract the following information and return it as a valid JSON object:

1. **Report Metadata**:
   - reportDate: The date of the report in YYYY-MM-DD format
   - inspector: The name of the inspector if mentioned
   - projectName: The project name/address

2. **Apartments Data**: For each apartment mentioned (typically apartments 1, 3, 5, 6, 7, 10, 11, 14):
   - apartmentNumber: The apartment number as a string
   - workItems: Array of work items with:
     - category: Work category in Hebrew (חשמל, אינסטלציה, מיזוג, דלת כניסה, סניטריה, ריצוף, חיפוי, ספרינקלרים, איטום, etc.)
     - location: Specific location within the apartment if mentioned
     - description: Description of the work item
     - status: Status in Hebrew (בוצע, בוצע - תקין, לא תקין, ליקוי, בטיפול, טופל, etc.)
     - notes: Any additional notes
     - hasPhoto: true if there's a photo associated with this item
   - inspectionDates: Object mapping category to inspection date if available

3. **Development Items**: Site-level work not specific to an apartment:
   - Same structure as workItems but for general/building-level work

4. **Progress Tracking Table**: If there's a tracking table showing inspection dates by apartment and category:
   - apartmentNumber
   - category
   - inspectionDate
   - status

Return ONLY valid JSON, no explanations.`;

interface ExtractedWorkItem {
  category: string;
  location?: string;
  description: string;
  status: string;
  notes?: string;
  hasPhoto?: boolean;
}

interface ExtractedApartmentData {
  apartmentNumber: string;
  workItems: ExtractedWorkItem[];
  inspectionDates?: Record<string, string>;
}

interface ExtractedReportData {
  reportDate: string;
  inspector?: string;
  projectName?: string;
  apartments: ExtractedApartmentData[];
  developmentItems?: ExtractedWorkItem[];
  progressTracking?: {
    apartmentNumber: string;
    category: string;
    inspectionDate?: string;
    status?: string;
  }[];
}

async function extractPdfData(pdfBuffer: Buffer): Promise<ExtractedReportData> {
  const base64Pdf = pdfBuffer.toString('base64');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let extractedData: ExtractedReportData;
  try {
    const codeBlockMatch = textContent.text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      extractedData = JSON.parse(codeBlockMatch[1]);
    } else {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      extractedData = JSON.parse(jsonMatch[0]);
    }
  } catch (parseError) {
    throw new Error(`Failed to parse extraction result: ${parseError}`);
  }

  return extractedData;
}

export async function POST(request: NextRequest) {
  let savedFilePath: string | null = null;
  let snapshotId: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const forceUpload = formData.get('force') === 'true'; // Allow bypassing warnings

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Read file buffer for validation
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // === VALIDATION STEP 1: PDF Magic Bytes ===
    const pdfValidation = isValidPdfBuffer(buffer);
    if (!pdfValidation.valid) {
      return NextResponse.json(
        { 
          error: pdfValidation.error,
          validationFailed: true,
          validationType: 'pdf_format',
        },
        { status: 400 }
      );
    }

    // Check if file already exists by filename
    const existingByName = await prisma.report.findUnique({
      where: { fileName: file.name },
    });

    if (existingByName) {
      return NextResponse.json(
        { error: 'קובץ עם שם זה כבר קיים במערכת', duplicate: true },
        { status: 409 }
      );
    }

    // Also check by date extracted from filename
    const reportDateFromFilename = extractDateFromFilename(file.name);
    if (reportDateFromFilename) {
      const existingByDate = await prisma.report.findFirst({
        where: {
          reportDate: reportDateFromFilename,
        },
      });

      if (existingByDate) {
        return NextResponse.json(
          { 
            error: `כבר קיים דוח מתאריך ${reportDateFromFilename.toLocaleDateString('he-IL')} (${existingByDate.fileName})`,
            duplicate: true,
            existingFileName: existingByDate.fileName,
          },
          { status: 409 }
        );
      }
    }

    // === CREATE SNAPSHOT BEFORE ANY DATA CHANGES ===
    const snapshot = await createSnapshot(`pre-upload: ${file.name}`);
    snapshotId = snapshot.id;
    
    // Cleanup old snapshots (keep last 20)
    await cleanupOldSnapshots(20);

    // Ensure PDF directory exists
    if (!existsSync(PDF_DIR)) {
      await mkdir(PDF_DIR, { recursive: true });
    }

    // Save the file (track for cleanup on failure)
    const filePath = path.join(PDF_DIR, file.name);
    await writeFile(filePath, buffer);
    savedFilePath = filePath;

    // Get or create project
    let project = await prisma.project.findFirst();
    if (!project) {
      project = await prisma.project.create({
        data: {
          name: 'מוסינזון 5 תל אביב',
          address: 'מוסינזון 5, תל אביב',
        },
      });
    }

    // Ensure apartments exist
    const APARTMENTS = ['1', '3', '5', '6', '7', '10', '11', '14'];
    for (const aptNum of APARTMENTS) {
      await prisma.apartment.upsert({
        where: { projectId_number: { projectId: project.id, number: aptNum } },
        create: { projectId: project.id, number: aptNum },
        update: {},
      });
    }

    // Extract data from PDF
    let extractedData: ExtractedReportData;
    try {
      extractedData = await extractPdfData(buffer);
    } catch (extractionError) {
      // Clean up saved file on extraction failure
      if (savedFilePath) {
        try {
          await unlink(savedFilePath);
        } catch {}
      }
      return NextResponse.json(
        { 
          error: `שגיאה בחילוץ נתונים מהקובץ: ${extractionError instanceof Error ? extractionError.message : 'Unknown error'}`,
          validationFailed: true,
          validationType: 'extraction',
          snapshotId, // Return snapshot ID for potential manual rollback
        },
        { status: 400 }
      );
    }

    // === VALIDATION STEP 2: Validate extracted data ===
    const dataValidation = validateExtractedData(extractedData as ValidationExtractedData);
    const fullValidation = createFullValidationResult({ valid: true }, dataValidation);

    // If validation completely failed (critical errors), reject
    if (!fullValidation.canProceed) {
      // Clean up saved file
      if (savedFilePath) {
        try {
          await unlink(savedFilePath);
        } catch {}
      }
      return NextResponse.json(
        { 
          error: 'הקובץ לא עבר אימות - ייתכן שזהו לא דוח פיקוח או שהוא שייך לפרויקט אחר',
          validationFailed: true,
          validationType: 'content',
          validationErrors: fullValidation.dataErrors,
          validationWarnings: fullValidation.dataWarnings,
          confidence: fullValidation.confidence,
          snapshotId,
        },
        { status: 400 }
      );
    }

    // If there are warnings but user didn't force upload, return for confirmation
    if (fullValidation.requiresConfirmation && !forceUpload) {
      // Clean up saved file - will be re-uploaded if user confirms
      if (savedFilePath) {
        try {
          await unlink(savedFilePath);
        } catch {}
      }
      return NextResponse.json(
        { 
          requiresConfirmation: true,
          validationWarnings: fullValidation.dataWarnings,
          confidence: fullValidation.confidence,
          message: 'הקובץ עבר אימות בסיסי אך נמצאו אזהרות. האם להמשיך?',
        },
        { status: 202 } // 202 Accepted - needs confirmation
      );
    }

    // Determine report date - prefer extracted date from PDF, then filename date
    let reportDate: Date;
    
    if (extractedData.reportDate) {
      // Use date extracted from inside the PDF (most accurate)
      reportDate = new Date(extractedData.reportDate);
      if (isNaN(reportDate.getTime())) {
        // Fall back to filename date if extracted date is invalid
        const filenameDate = extractDateFromFilename(file.name);
        reportDate = filenameDate || new Date();
      }
    } else {
      // Fall back to filename date, then current date
      const filenameDate = extractDateFromFilename(file.name);
      reportDate = filenameDate || new Date();
    }

    // Create report
    const report = await prisma.report.create({
      data: {
        projectId: project.id,
        fileName: file.name,
        filePath,
        reportDate,
        inspector: extractedData.inspector || null,
        rawExtraction: JSON.stringify(extractedData),
        processed: false,
      },
    });

    // Get apartments
    const apartments = await prisma.apartment.findMany({ where: { projectId: project.id } });
    const apartmentMap = new Map(apartments.map((a) => [a.number, a.id]));

    let workItemsCreated = 0;
    let inspectionsCreated = 0;

    // Process apartments data
    for (const aptData of extractedData.apartments || []) {
      const apartmentId = apartmentMap.get(aptData.apartmentNumber);
      if (!apartmentId) continue;

      for (const item of aptData.workItems || []) {
        const category = normalizeCategory(item.category);
        const status = normalizeStatus(item.status, item.notes || null);

        await prisma.workItem.create({
          data: {
            reportId: report.id,
            apartmentId,
            category,
            location: item.location || null,
            description: item.description,
            status,
            notes: item.notes || null,
            hasPhoto: item.hasPhoto || false,
          },
        });
        workItemsCreated++;
      }

      if (aptData.inspectionDates) {
        for (const [category, dateStr] of Object.entries(aptData.inspectionDates)) {
          const inspectionDate = parseDate(dateStr);
          if (!inspectionDate) continue;

          await prisma.inspection.upsert({
            where: {
              reportId_apartmentId_category: {
                reportId: report.id,
                apartmentId,
                category: normalizeCategory(category),
              },
            },
            create: {
              reportId: report.id,
              apartmentId,
              category: normalizeCategory(category),
              inspectionDate,
            },
            update: { inspectionDate },
          });
          inspectionsCreated++;
        }
      }
    }

    // Process development items
    for (const item of extractedData.developmentItems || []) {
      const category = normalizeCategory(item.category);
      const status = normalizeStatus(item.status, item.notes || null);

      await prisma.workItem.create({
        data: {
          reportId: report.id,
          apartmentId: null,
          category,
          location: item.location || null,
          description: item.description,
          status,
          notes: item.notes || null,
          hasPhoto: item.hasPhoto || false,
        },
      });
      workItemsCreated++;
    }

    // Process progress tracking
    for (const tracking of extractedData.progressTracking || []) {
      const apartmentId = apartmentMap.get(tracking.apartmentNumber);
      if (!apartmentId) continue;

      const inspectionDate = parseDate(tracking.inspectionDate || null);
      if (!inspectionDate) continue;

      await prisma.inspection.upsert({
        where: {
          reportId_apartmentId_category: {
            reportId: report.id,
            apartmentId,
            category: normalizeCategory(tracking.category),
          },
        },
        create: {
          reportId: report.id,
          apartmentId,
          category: normalizeCategory(tracking.category),
          inspectionDate,
          status: tracking.status ? normalizeStatus(tracking.status) : undefined,
        },
        update: {
          inspectionDate,
          status: tracking.status ? normalizeStatus(tracking.status) : undefined,
        },
      });
      inspectionsCreated++;
    }

    // Mark as processed
    await prisma.report.update({
      where: { id: report.id },
      data: { processed: true },
    });

    return NextResponse.json({
      success: true,
      reportId: report.id,
      fileName: file.name,
      reportDate: reportDate.toISOString(),
      workItemsCreated,
      inspectionsCreated,
      snapshotId, // Include snapshot ID for potential rollback
      validation: {
        confidence: fullValidation.confidence,
        warnings: fullValidation.dataWarnings,
      },
    });
  } catch (error) {
    console.error('Error uploading report:', error);
    
    // Clean up saved file on error
    if (savedFilePath) {
      try {
        await unlink(savedFilePath);
      } catch {}
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to upload report',
        snapshotId, // Include snapshot ID for rollback if data was partially written
      },
      { status: 500 }
    );
  }
}
