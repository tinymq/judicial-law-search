import { prisma } from '../src/lib/db';

async function main() {
  const laws = await prisma.law.findMany({
    where: { issuingAuthority: { contains: '日' } },
    select: { id: true, title: true, issuingAuthority: true }
  });

  console.log('Laws with 日 in issuingAuthority:', laws.length);
  for (const l of laws.slice(0, 30)) {
    console.log(`[${l.id}] authority=[${l.issuingAuthority}] title=${l.title.substring(0, 40)}`);
  }

  // Also check for laws where preamble starts with 日
  const pLaws = await prisma.law.findMany({
    where: { preamble: { startsWith: '日' } },
    select: { id: true, title: true, preamble: true },
    take: 10
  });
  console.log('\nLaws with preamble starting with 日:', pLaws.length);
  for (const l of pLaws) {
    console.log(`[${l.id}] preamble=[${l.preamble?.substring(0, 80)}]`);
  }

  // Check recently imported laws that might have wrong data
  const recent = await prisma.law.findMany({
    where: {
      id: { in: [7479, 7480, 7481, 7537, 7628, 7629, 7630, 7631, 7632, 7633] }
    },
    select: { id: true, issuingAuthority: true, preamble: true }
  });
  console.log('\nRecently imported laws:');
  for (const l of recent) {
    console.log(`[${l.id}] auth=[${l.issuingAuthority}] preamble=[${l.preamble?.substring(0, 60)}]`);
  }

  await prisma.$disconnect();
}
main();
