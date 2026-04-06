/**
 * 效力位阶数据迁移脚本
 *
 * 功能：
 * 1. 将"经济特区法规"迁移到"地方性法规"
 * 2. 将"海南自由贸易港法规"迁移到"地方性法规"
 * 3. 验证迁移结果
 *
 * @version 1.0.0
 * @date 2026-01-29
 */

import { prisma } from '@/src/lib/db';

async function migrateLevels() {
  console.log('=== 开始迁移效力位阶数据 ===\n');

  // 1. 显示待迁移数据
  const migrationTargets = [
    { old: '经济特区法规', new: '地方性法规' },
    { old: '海南自由贸易港法规', new: '地方性法规' },
  ];

  console.log('📊 待迁移数据统计：\n');
  for (const target of migrationTargets) {
    const laws = await prisma.law.findMany({
      where: { level: target.old },
      select: {
        id: true,
        title: true,
        level: true,
      }
    });
    console.log(`  ${target.old}: ${laws.length}条`);
    if (laws.length > 0) {
      laws.forEach(law => {
        console.log(`    - [${law.id}] ${law.title}`);
      });
    }
  }

  console.log('\n=== 开始迁移 ===\n');

  // 2. 执行迁移
  let totalMigrated = 0;
  for (const target of migrationTargets) {
    const result = await prisma.law.updateMany({
      where: { level: target.old },
      data: { level: target.new }
    });
    console.log(`✅ ${target.old} → ${target.new}: ${result.count}条`);
    totalMigrated += result.count;
  }

  console.log(`\n✅ 迁移完成！共迁移 ${totalMigrated}条数据`);

  // 3. 验证迁移结果
  console.log('\n=== 验证迁移结果 ===\n');
  const remainingOld = await prisma.law.findMany({
    where: {
      level: { in: ['经济特区法规', '海南自由贸易港法规'] }
    },
    select: { id: true, title: true, level: true }
  });

  if (remainingOld.length > 0) {
    console.log(`⚠️ 警告：还有 ${remainingOld.length}条旧数据未迁移：`);
    remainingOld.forEach(law => {
      console.log(`  - [${law.id}] ${law.title} (${law.level})`);
    });
  } else {
    console.log('✅ 所有旧数据已成功迁移！');
  }

  // 4. 显示新的统计
  console.log('\n=== 迁移后的位阶统计 ===\n');
  const newStats = await prisma.law.groupBy({
    by: ['level'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  newStats.forEach(item => {
    console.log(`  ${item.level}: ${item._count.id}条`);
  });
}

migrateLevels()
  .then(() => {
    console.log('\n✅ 迁移脚本执行完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ 迁移失败:', err);
    process.exit(1);
  });
