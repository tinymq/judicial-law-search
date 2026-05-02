import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('=== 执法事项与法规的关联示例 ===\n');
  
  // 获取有lawId的执法事项样本
  const itemsWithLaw = await prisma.enforcementItem.findMany({
    where: { lawId: { not: null } },
    include: { law: true },
    take: 5,
  });
  
  console.log('有关联的执法事项样本:\n');
  itemsWithLaw.forEach(item => {
    console.log(`执法事项 ID: ${item.id}`);
    console.log(`  名称: ${item.name}`);
    console.log(`  类别: ${item.category}`);
    console.log(`  law.id: ${item.lawId}`);
    console.log(`  law.title: ${item.law?.title}`);
    console.log(`  law.level: ${item.law?.level}`);
    console.log('');
  });
  
  // 获取无lawId的执法事项样本
  console.log('\n无关联的执法事项样本:\n');
  const itemsWithoutLaw = await prisma.enforcementItem.findMany({
    where: { lawId: null },
    take: 5,
  });
  
  itemsWithoutLaw.forEach(item => {
    console.log(`执法事项 ID: ${item.id}`);
    console.log(`  名称: ${item.name}`);
    console.log(`  类别: ${item.category}`);
    console.log(`  law.id: ${item.lawId} (null)`);
    console.log(`  legalBasisText: ${item.legalBasisText?.substring(0, 80) || '(empty)'}...`);
    console.log('');
  });
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
