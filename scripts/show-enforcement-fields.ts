import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('=== EnforcementItem 字段分布分析 ===\n');
  
  const items = await prisma.enforcementItem.findMany({ take: 10 });
  
  console.log('样本记录 (前10条):\n');
  items.forEach((item, i) => {
    console.log(`[${i+1}] ID: ${item.id}, lawId: ${item.lawId}`);
    console.log(`    名称: ${item.name}`);
    console.log(`    类别: ${item.category}`);
    console.log(`    执法主体: ${item.enforcementBody}`);
    console.log(`    执法领域: ${item.enforcementDomain}`);
    console.log(`    执法依据: ${item.legalBasisText?.substring(0, 80) || '(null)'}...`);
    console.log('');
  });
  
  // 统计每个字段的非null比例
  console.log('\n=== 字段填充率 ===\n');
  const counts = {
    lawId: 0,
    legalBasisText: 0,
    enforcementBody: 0,
    enforcementDomain: 0,
    checkTarget: 0,
    checkContent: 0,
    checkMethod: 0,
    enforcementLevel: 0,
  };
  
  const allItems = await prisma.enforcementItem.findMany({ select: { lawId: true, legalBasisText: true, enforcementBody: true, enforcementDomain: true, checkTarget: true, checkContent: true, checkMethod: true, enforcementLevel: true } });
  
  allItems.forEach(item => {
    if (item.lawId !== null) counts.lawId++;
    if (item.legalBasisText !== null) counts.legalBasisText++;
    if (item.enforcementBody !== null) counts.enforcementBody++;
    if (item.enforcementDomain !== null) counts.enforcementDomain++;
    if (item.checkTarget !== null) counts.checkTarget++;
    if (item.checkContent !== null) counts.checkContent++;
    if (item.checkMethod !== null) counts.checkMethod++;
    if (item.enforcementLevel !== null) counts.enforcementLevel++;
  });
  
  const total = allItems.length;
  Object.entries(counts).forEach(([field, count]) => {
    const pct = (count/total*100).toFixed(1);
    console.log(`${field}: ${count}/${total} (${pct}%)`);
  });
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
