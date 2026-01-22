require('dotenv/config');
const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  console.log('prisma type:', typeof prisma);
  console.log('prisma.$connect:', typeof prisma.$connect);
  console.log('prisma.report:', prisma.report);

  try {
    await prisma.$connect();
    const count = await prisma.report.count();
    console.log('report count:', count);
  } catch (e) {
    console.error('Error:', e);
  }

  await prisma.$disconnect();
}

main();
