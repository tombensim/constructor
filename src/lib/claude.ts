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
   - Same structure as workItems but for общие/building-level work

4. **Progress Tracking Table**: If there's a tracking table showing inspection dates by apartment and category:
   - apartmentNumber
   - category
   - inspectionDate
   - status

Return ONLY valid JSON, no explanations. Example structure:
{
  "reportDate": "2025-01-15",
  "inspector": "שם המפקח",
  "projectName": "מוסינזון 5 תל אביב",
  "apartments": [
    {
      "apartmentNumber": "1",
      "workItems": [
        {
          "category": "חשמל",
          "location": "סלון",
          "description": "התקנת נקודות חשמל",
          "status": "בוצע - תקין",
          "notes": null,
          "hasPhoto": false
        }
      ],
      "inspectionDates": {
        "חשמל": "2025-01-10",
        "אינסטלציה": "2025-01-12"
      }
    }
  ],
  "developmentItems": [],
  "progressTracking": []
}`;

export async function extractPdfData(pdfPath: string): Promise<ExtractedReportData> {
  // Read the PDF file
  const absolutePath = path.resolve(pdfPath);
  const pdfBuffer = fs.readFileSync(absolutePath);
  const base64Pdf = pdfBuffer.toString('base64');

  console.log(`Processing PDF: ${path.basename(pdfPath)}`);

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

  // Extract the text content from the response
  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse the JSON response
  let extractedData: ExtractedReportData;
  try {
    // Try to extract JSON from the response (in case there's any surrounding text)
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    extractedData = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.error('Failed to parse Claude response:', textContent.text);
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
