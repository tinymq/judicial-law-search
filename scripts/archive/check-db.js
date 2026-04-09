const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.law.count();
  console.log(`Total laws in database: ${count}`);
  const sampleLaws = await prisma.law.findMany({ take: 3, select: { id: true, title: true } });
  console.log('\nSample laws:');
  sampleLaws.forEach(l => console.log(`  ${l.id}. ${l.title}`));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
