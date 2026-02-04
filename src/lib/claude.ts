import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Type definitions for extracted data
export interface ExtractedWorkItem {
  category: string;
  location?: string;
  description: string;
  status: string;
  notes?: string;
  hasPhoto?: boolean;
}

export interface ExtractedApartmentData {
  apartmentNumber: string;
  workItems: ExtractedWorkItem[];
  inspectionDates?: Record<string, string>;
}

export interface ExtractedReportData {
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

const EXTRACTION_PROMPT = `You are analyzing a Hebrew construction progress report PDF for a TAMA 38/2 urban renewal project at Mosinzon 5, Tel Aviv.

IMPORTANT: This report contains APARTMENT-SPECIFIC sections AND general development sections. You MUST extract ALL of them.

The PDF structure typically includes:
1. Cover page with report date and inspector info
2. Progress tracking table (showing inspection dates by apartment)
3. General observations/photos
4. **APARTMENT SECTIONS** - Look for headers like "דירה מס X קומה Y" or "דירה X" - EXTRACT ALL ITEMS FROM EACH APARTMENT
5. Development/פיתוח sections for building-level work

Extract the following information and return it as a valid JSON object:

1. **Report Metadata**:
   - reportDate: The date of the report in YYYY-MM-DD format (look for "תאריך ביקור באתר")
   - inspector: The name of the inspector if mentioned
   - projectName: The project name/address

2. **Apartments Data**: For EACH apartment mentioned (apartments 1, 3, 5, 6, 7, 10, 11, 14 etc.):
   Look for sections starting with "דירה מס X" or "דירה X קומה Y".
   Each apartment section has a table with columns: תמונות, תיאור, סטטוס/הערות, מלאכה, מיקום
   
   Extract EVERY row as a workItem:
   - apartmentNumber: The apartment number as a string
   - workItems: Array of work items with:
     - category: The "מלאכה" column value (e.g., דלתות פנים, מישק הפרדה, עבודות חשמל, עבודות ריצוף, חיפוי, etc.)
     - location: The "מיקום" column value (e.g., כלל הבית, חדרי רחצה, סלון, etc.)
     - description: The "תיאור" column value - the detailed description of the work
     - status: The main status from "סטטוס/הערות" column. Common values:
       * בוצע = completed
       * בוצע חלקית / בביצוע = in progress
       * ליקוי = defect
       * לא תקין = not OK
       * טופל = handled/fixed
       * בוצע, נמצאו אי תאומים = completed with discrepancies (this is a DEFECT)
       * בוצע - יש הערות = completed with notes (check notes for issues)
     - notes: IMPORTANT - capture ALL the detailed notes/comments from "סטטוס/הערות" column, especially:
       * Missing items (חסר/חסרה/חסרים)
       * Discrepancies (אי תאומים/אי תיאומים)
       * Required fixes
       * Location-specific issues (e.g., "חדר שינה 1 - חסרה נקודת תקשורת LAN")
     - hasPhoto: true if there's a photo in the תמונות column

3. **Development Items**: Site-level work from sections like "פיתוח", "לובי", "כללי":
   - Same structure as workItems but for building-level work

4. **Progress Tracking Table**: From the "התקדמות הבנייה" table if present

CRITICAL: Do NOT skip apartment sections. The apartments 1, 3, 5, 6, 7, 10, 11, 14 typically have work items.
Each item row in the apartment tables must be captured, even if status indicates issues.

Return ONLY valid JSON, no explanations. Example structure:
{
  "reportDate": "2026-01-28",
  "inspector": "אמי חי",
  "projectName": "מוסינזון 5 תל אביב",
  "apartments": [
    {
      "apartmentNumber": "7",
      "workItems": [
        {
          "category": "בדיקת תוכנית חשמל",
          "location": "כלל הבית",
          "description": "בדיקת תוכנית חשמל על פי תוכנית שינויי דיירים",
          "status": "בוצע, נמצאו אי תאומים",
          "notes": "חדר שינה 1 - חסרה נקודת תקשורת LAN, ממ״ד - חסרה נקודת תקשורת, סלון - חסרה נקודת תקשורת",
          "hasPhoto": true
        },
        {
          "category": "עבודות ריצוף",
          "location": "כלל הבית",
          "description": "ביצוע עבודות ריצוף בשטח הדירה",
          "status": "בוצע חלקית",
          "notes": "ממ״ד, חדר הורים, חדר שינה 2 - טרם הושלם",
          "hasPhoto": true
        },
        {
          "category": "דלתות פנים",
          "location": "כלל הבית",
          "description": "התקנת דלתות פנים בשטח הדירה",
          "status": "בביצוע",
          "notes": null,
          "hasPhoto": true
        },
        {
          "category": "מישק הפרדה",
          "location": "חדרי רחצה",
          "description": "מישק הפרדה בין כלים סניטריים לחיפוי קרמיקה",
          "status": "ליקוי",
          "notes": "יש לחרוץ חומר קשיח ולבצע מילוי מישקי הפרדה בעזרת חומר איטום",
          "hasPhoto": true
        }
      ]
    }
  ],
  "developmentItems": [
    {
      "category": "חשמל",
      "location": "כללי",
      "description": "התקנת מוני חשמל",
      "status": "בביצוע",
      "notes": null,
      "hasPhoto": true
    }
  ],
  "progressTracking": []
}`;

export async function extractPdfData(pdfPath: string): Promise<ExtractedReportData> {
  // Read the PDF file
  const absolutePath = path.resolve(pdfPath);
  const pdfBuffer = fs.readFileSync(absolutePath);
  const base64Pdf = pdfBuffer.toString('base64');

  console.log(`Processing PDF: ${path.basename(pdfPath)}`);

  // Use higher max_tokens to capture more content
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16384,
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

  // Extract the text content from the response
  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse the JSON response with better error handling
  let extractedData: ExtractedReportData;
  try {
    // Try to extract JSON from the response (in case there's any surrounding text)
    let jsonText = textContent.text;
    
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    jsonText = jsonText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    
    // Find the JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    let jsonString = jsonMatch[0];
    
    // Try to fix common JSON issues
    // Fix trailing commas before ] or }
    jsonString = jsonString.replace(/,\s*([\]}])/g, '$1');
    // Fix unquoted values that should be null
    jsonString = jsonString.replace(/:\s*,/g, ': null,');
    jsonString = jsonString.replace(/:\s*}/g, ': null}');
    
    extractedData = JSON.parse(jsonString);
  } catch (parseError) {
    console.error('Failed to parse Claude response:', textContent.text.substring(0, 2000));
    throw new Error(`Failed to parse extraction result: ${parseError}`);
  }

  // Validate required fields
  if (!extractedData.reportDate) {
    // Try to extract date from filename
    const filename = path.basename(pdfPath);
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      extractedData.reportDate = dateMatch[1];
    } else {
      throw new Error('Could not determine report date');
    }
  }

  // Ensure apartments array exists
  if (!extractedData.apartments) {
    extractedData.apartments = [];
  }

  // Log extraction summary
  const totalItems = extractedData.apartments.reduce((sum, apt) => sum + (apt.workItems?.length || 0), 0);
  const devItems = extractedData.developmentItems?.length || 0;
  console.log(`Extracted: ${extractedData.apartments.length} apartments, ${totalItems} apartment items, ${devItems} development items`);

  return extractedData;
}

export async function testConnection(): Promise<boolean> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Say "OK" if you can read this.',
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent?.type === 'text' && textContent.text.includes('OK');
  } catch (error) {
    console.error('Claude API connection test failed:', error);
    return false;
  }
}
