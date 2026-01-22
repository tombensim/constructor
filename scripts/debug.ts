import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('prisma:', prisma);
  console.log('prisma.report:', prisma.report);

  try {
    const count = await prisma.report.count();
    console.log('report count:', count);
  } catch (e) {
    console.error('Error:', e);
  }

  await prisma.$disconnect();
}

main();
