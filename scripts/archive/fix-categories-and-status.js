/**
 * 修复类别命名和时效性
 * 1. 合并重复的类别
 * 2. 修改时效性命名
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== 修复类别和时效性 ===\n');

  // 1. 消保维权 → 消费维权
  const result1 = await prisma.law.updateMany({
    where: { category: '消保维权' },
    data: { category: '消费维权' }
  });
  console.log(`✅ "消保维权" → "消费维权": ${result1.count}条`);

  // 2. 反垄断 → 反垄断与反不正当竞争
  const result2 = await prisma.law.updateMany({
    where: { category: '反垄断' },
    data: { category: '反垄断与反不正当竞争' }
  });
  console.log(`✅ "反垄断" → "反垄断与反不正当竞争": ${result2.count}条`);

  // 3. 反不正当竞争 → 反垄断与反不正当竞争
  const result3 = await prisma.law.updateMany({
    where: { category: '反不正当竞争' },
    data: { category: '反垄断与反不正当竞争' }
  });
  console.log(`✅ "反不正当竞争" → "反垄断与反不正当竞争": ${result3.count}条`);

  // 4. 网监 → 网监与合同
  const result4 = await prisma.law.updateMany({
    where: { category: '网监' },
    data: { category: '网监与合同' }
  });
  console.log(`✅ "网监" → "网监与合同": ${result4.count}条`);

  // 5. 已被修订 → 已被修改
  const result5 = await prisma.law.updateMany({
    where: { status: '已被修订' },
    data: { status: '已被修改' }
  });
  console.log(`✅ "已被修订" → "已被修改": ${result5.count}条`);

  console.log(`\n总计更新: ${result1.count + result2.count + result3.count + result4.count + result5.count}条`);

  // 验证结果
  console.log('\n=== 验证修复结果 ===\n');

  const categories = await prisma.law.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { category: 'asc' }
  });

  console.log('法规类别统计:');
  categories.forEach(c => {
    console.log(`  ${c.category}: ${c._count.id}条`);
  });

  console.log('\n时效性统计:');
  const statuses = await prisma.law.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  statuses.forEach(s => {
    console.log(`  ${s.status}: ${s._count.id}条`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
