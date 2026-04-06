import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: 'file:../dev.db' } }
  });
  
  const vCount = await prisma.violation.count();
  console.log('Violation count (root dev.db):', vCount);
  
  const lCount = await prisma.law.count();
  console.log('Law count (root dev.db):', lCount);

  if (vCount > 0) {
    const samples = await prisma.violation.findMany({
      take: 5,
      select: { id: true, description: true, code: true }
    });
    console.log('\nSample violations:');
    for (const s of samples) {
      console.log(`[${s.id}] ${s.code}: ${s.description.slice(0, 100)}`);
    }
  }
  
  if (lCount > 0) {
    const samples = await prisma.law.findMany({ take: 3, select: { id: true, title: true } });
    console.log('\nSample laws:');
    for (const s of samples) {
      console.log(`[${s.id}] ${s.title}`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
