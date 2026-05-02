import { prisma } from '../src/lib/db';

async function main() {
  const laws = await prisma.law.findMany({
    where: { issuingAuthority: { startsWith: '日' } },
    select: { id: true, issuingAuthority: true },
    orderBy: { id: 'asc' }
  });

  console.log('Total with 日 prefix:', laws.length);

  // Legitimate: 日喀则, 日照
  const legit = laws.filter(l => l.issuingAuthority!.startsWith('日喀则') || l.issuingAuthority!.startsWith('日照'));
  const bad = laws.filter(l => !l.issuingAuthority!.startsWith('日喀则') && !l.issuingAuthority!.startsWith('日照'));

  console.log('Legitimate (日喀则/日照):', legit.length);
  console.log('Bad (spurious 日 prefix):', bad.length);

  if (bad.length > 0) {
    console.log('ID range:', bad[0].id, 'to', bad[bad.length - 1].id);
    console.log('\nSamples:');
    for (const l of bad.slice(0, 10)) {
      console.log(`  [${l.id}] ${l.issuingAuthority}`);
    }
  }

  await prisma.$disconnect();
}
main();
