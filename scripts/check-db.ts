import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  const vCount = await prisma.violation.count();
  console.log('Violation count:', vCount);
  
  const lCount = await prisma.law.count();
  console.log('Law count:', lCount);
  
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
  
  await prisma.$disconnect();
}

main().catch(console.error);
