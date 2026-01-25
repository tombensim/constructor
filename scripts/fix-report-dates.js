const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

// Extract date from raw extraction JSON (the date inside the PDF)
function extractDateFromRawExtraction(rawExtraction) {
  if (!rawExtraction) return null;
  
  try {
    const data = JSON.parse(rawExtraction);
    if (data.reportDate) {
      const date = new Date(data.reportDate);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  return null;
}

// Extract date from filename
function extractDateFromFilename(filename) {
  // Format 1: YYYY-MM-DD at the start (e.g., "2024-11-03 - מוסינזון...")
  const isoMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    const date = new Date(isoMatch[1]);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Format 2: DD.MM.YY or DD.MM.YYYY at the end (e.g., "...18.9.23.pdf" or "...26.12.22.pdf")
  const ddmmyyMatch = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\.pdf)?$/i);
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1]);
    const month = parseInt(ddmmyyMatch[2]) - 1; // JavaScript months are 0-indexed
    let year = parseInt(ddmmyyMatch[3]);
    
    // Convert 2-digit year to 4-digit
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Format 3: DD.MM.YY in the middle (e.g., "...מיום - 26.12.22.pdf")
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

// Generate a clean display name from filename
function generateDisplayName(filename, date) {
  // Remove the extension
  const withoutExt = filename.replace(/\.pdf$/i, '');
  
  // If it starts with a date, use a cleaner format
  if (filename.match(/^(\d{4}-\d{2}-\d{2})/)) {
    return `מוסינזון 5 תל אביב - ${date.toLocaleDateString('he-IL')}`;
  }
  
  // For Visitt files
  if (withoutExt.includes('Visitt')) {
    return `ביקור באתר - ${date.toLocaleDateString('he-IL')}`;
  }
  
  // For דוח מפקח הדיירים files
  if (withoutExt.includes('דוח מפקח הדיירים')) {
    return `דוח מפקח הדיירים - ${date.toLocaleDateString('he-IL')}`;
  }
  
  return withoutExt;
}

async function fixReportDates() {
  console.log('Fetching all reports...');
  
  const reports = await prisma.report.findMany({
    orderBy: { fileName: 'asc' },
  });

  console.log(`Found ${reports.length} reports`);

  let updated = 0;
  let skipped = 0;

  for (const report of reports) {
    // Prefer date from inside PDF (rawExtraction), then filename
    const pdfDate = extractDateFromRawExtraction(report.rawExtraction);
    const filenameDate = extractDateFromFilename(report.fileName);
    const extractedDate = pdfDate || filenameDate;
    
    if (extractedDate) {
      const source = pdfDate ? 'PDF' : 'filename';
      
      // Check if date is different
      const currentDate = new Date(report.reportDate);
      const needsUpdate = 
        currentDate.getFullYear() !== extractedDate.getFullYear() ||
        currentDate.getMonth() !== extractedDate.getMonth() ||
        currentDate.getDate() !== extractedDate.getDate();

      if (needsUpdate) {
        console.log(`\nUpdating: ${report.fileName}`);
        console.log(`  Old date: ${currentDate.toLocaleDateString('he-IL')}`);
        console.log(`  New date: ${extractedDate.toLocaleDateString('he-IL')} (from ${source})`);
        
        await prisma.report.update({
          where: { id: report.id },
          data: { reportDate: extractedDate },
        });
        
        updated++;
      } else {
        console.log(`✓ Already correct: ${report.fileName} (${extractedDate.toLocaleDateString('he-IL')}) [${source}]`);
        skipped++;
      }
    } else {
      console.log(`⚠ Could not extract date from: ${report.fileName}`);
      skipped++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${reports.length}`);
}

fixReportDates()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
