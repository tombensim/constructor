/**
 * Data Fix Script
 * 
 * Fixes issues in existing data:
 * 1. Re-categorizes items based on description keywords
 * 2. Re-evaluates status based on notes content
 */

const { PrismaClient } = require('../src/generated/prisma');
const prisma = new PrismaClient();

// Description-based category override
const descriptionCategoryMap = {
  'שיפועים': 'FLOORING',
  'שיפוע': 'FLOORING',
};

// Negative keywords that indicate a defect
const DEFECT_KEYWORDS = [
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
  'חסרה',
  'חסרות',
  'חסרים',
  'שבור',
  'שבורה',
  'שבורים',
  'סדוק',
  'סדוקה',
  'סדוקים',
  'פגם',
  'פגמים',
  'בעיה',
  'בעיות',
  'לתקן',
  'תיקון',
  'לא בוצע',
  'לא הותקן',
  'לא הותקנו',
  'חתוך',
  'חתוכים',
  'להחליף',
  'החלפה',
  'נזק',
  'נזקים',
  'לא הושלם',
  'טעון',
  'דרוש',
];

function hasNegativeKeywords(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return DEFECT_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

function getCategoryFromDescription(description) {
  if (!description) return null;
  const descLower = description.toLowerCase();
  for (const [keyword, category] of Object.entries(descriptionCategoryMap)) {
    if (descLower.includes(keyword.toLowerCase())) {
      return category;
    }
  }
  return null;
}

async function main() {
  console.log('Starting data fix...\n');
  
  let categoryFixes = 0;
  let statusFixes = 0;
  
  // Get all work items
  const items = await prisma.workItem.findMany({
    include: { apartment: true, report: true }
  });
  
  console.log(`Found ${items.length} work items to check\n`);
  
  for (const item of items) {
    const updates = {};
    
    // Check for category fix based on description
    const newCategory = getCategoryFromDescription(item.description);
    if (newCategory && newCategory !== item.category) {
      console.log(`Category fix: "${item.description?.substring(0, 50)}" -> ${item.category} => ${newCategory}`);
      updates.category = newCategory;
      categoryFixes++;
    }
    
    // Check if status should be DEFECT based on notes
    if (item.status === 'COMPLETED' || item.status === 'COMPLETED_OK') {
      if (hasNegativeKeywords(item.notes)) {
        console.log(`Status fix: "${item.description?.substring(0, 40)}" has negative notes -> DEFECT`);
        console.log(`  Notes: "${item.notes?.substring(0, 80)}"`);
        updates.status = 'DEFECT';
        statusFixes++;
      }
    }
    
    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await prisma.workItem.update({
        where: { id: item.id },
        data: updates,
      });
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Category fixes: ${categoryFixes}`);
  console.log(`Status fixes: ${statusFixes}`);
  console.log(`Total items fixed: ${categoryFixes + statusFixes}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
