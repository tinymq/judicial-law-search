import { prisma } from '../src/lib/db';

async function main() {
  const laws = await prisma.law.findMany({
    where: { issuingAuthority: { startsWith: '日' } },
    select: { id: true, issuingAuthority: true }
  });

  const bad = laws.filter(l =>
    !l.issuingAuthority!.startsWith('日喀则') &&
    !l.issuingAuthority!.startsWith('日照')
  );

  console.log(`Found ${bad.length} laws with spurious 日 prefix`);

  let fixed = 0;
  for (const l of bad) {
    const corrected = l.issuingAuthority!.substring(1);
    await prisma.law.update({
      where: { id: l.id },
      data: { issuingAuthority: corrected }
    });
    fixed++;
  }

  console.log(`Fixed ${fixed} laws`);

  // Verify
  const remaining = await prisma.law.findMany({
    where: { issuingAuthority: { startsWith: '日' } },
    select: { id: true, issuingAuthority: true }
  });
  const stillBad = remaining.filter(l =>
    !l.issuingAuthority!.startsWith('日喀则') &&
    !l.issuingAuthority!.startsWith('日照')
  );
  console.log(`Remaining spurious: ${stillBad.length}`);

  await prisma.$disconnect();
}
main();
