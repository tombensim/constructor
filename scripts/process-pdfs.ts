#!/usr/bin/env npx ts-node

/**
 * Batch PDF Processing Script
 *
 * Usage:
 *   npx ts-node scripts/process-pdfs.ts           # Process all unprocessed PDFs
 *   npx ts-node scripts/process-pdfs.ts --all     # Reprocess all PDFs
 *   npx ts-node scripts/process-pdfs.ts --test    # Test Claude API connection
 */

import 'dotenv/config';
import { processAllPdfs, getUnprocessedPdfs } from '../src/lib/pdf-processor';
import { testConnection } from '../src/lib/claude';
import { prisma } from '../src/lib/db';

async function main() {
  const args = process.argv.slice(2);

  console.log('Construction Progress PDF Processor\n');

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-api-key-here') {
    console.error('Error: ANTHROPIC_API_KEY is not configured in .env file');
    console.log('\nPlease add your Anthropic API key to the .env file:');
    console.log('ANTHROPIC_API_KEY="sk-ant-..."');
    process.exit(1);
  }

  // Test connection if requested
  if (args.includes('--test')) {
    console.log('Testing Claude API connection...');
    const connected = await testConnection();
    if (connected) {
      console.log('✓ Claude API connection successful');
    } else {
      console.log('✗ Claude API connection failed');
    }
    await prisma.$disconnect();
    return;
  }

  // Check unprocessed files
  const unprocessed = await getUnprocessedPdfs();

  if (args.includes('--all')) {
    console.log('Processing all PDF files (including previously processed)...\n');
    // Reset processed flags
    await prisma.report.updateMany({
      data: { processed: false },
    });
    // Clear existing data
    await prisma.workItem.deleteMany();
    await prisma.inspection.deleteMany();
  } else if (unprocessed.length === 0) {
    console.log('All PDFs have already been processed.');
    console.log('Use --all flag to reprocess everything.');
    await prisma.$disconnect();
    return;
  } else {
    console.log(`Found ${unprocessed.length} unprocessed PDF(s):\n`);
    unprocessed.forEach((f) => console.log(`  - ${f}`));
    console.log('');
  }

  // Process PDFs
  const results = await processAllPdfs();

  // Summary
  console.log('\n--- Processing Summary ---\n');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`Total files: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  if (successful.length > 0) {
    const totalWorkItems = successful.reduce(
      (sum, r) => sum + (r.workItemsCreated || 0),
      0
    );
    const totalInspections = successful.reduce(
      (sum, r) => sum + (r.inspectionsCreated || 0),
      0
    );
    console.log(`\nWork items created: ${totalWorkItems}`);
    console.log(`Inspections recorded: ${totalInspections}`);
  }

  if (failed.length > 0) {
    console.log('\nFailed files:');
    failed.forEach((r) => {
      console.log(`  - ${r.fileName}: ${r.error}`);
    });
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
