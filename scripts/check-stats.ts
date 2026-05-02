import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const totalItems = await prisma.enforcementItem.count();
  const itemsWithLaw = await prisma.enforcementItem.count({ where: { lawId: { not: null } } });
  const itemsWithoutLaw = await prisma.enforcementItem.count({ where: { lawId: null } } );
  const totalLaws = await prisma.law.count();
  console.log(`Total EnforcementItems: ${totalItems}`);
  console.log(`Items with lawId: ${itemsWithLaw} (${(itemsWithLaw/totalItems*100).toFixed(1)}%)`);
  console.log(`Items with lawId=null: ${itemsWithoutLaw} (${(itemsWithoutLaw/totalItems*100).toFixed(1)}%)`);
  console.log(`Total Laws: ${totalLaws}`);
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
