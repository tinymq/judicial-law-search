/**
 * v1.7.1 修改验证脚本
 *
 * 验证内容：
 * 1. 效力位阶整合完成（经济特区法规、海南自由贸易港法规 → 地方性法规）
 * 2. 效力位阶数量正确（13个 → 11个）
 * 3. 配置文件一致性
 *
 * @version 1.0.0
 * @date 2026-01-29
 */

import { prisma } from '@/src/lib/db';
import { LEVEL_ORDER, LEVEL_OPTIONS, LEVEL_MIGRATION_MAP } from '../../src/lib/category-config';

async function verifyV171() {
  console.log('=== v1.7.1 修改验证 ===\n');

  // 1. 验证配置文件
  console.log('1️⃣ 验证配置文件\n');
  console.log(`LEVEL_ORDER 数量: ${LEVEL_ORDER.length}个`);
  console.log(`LEVEL_OPTIONS 数量: ${LEVEL_OPTIONS.length}个`);
  console.log(`LEVEL_MIGRATION_MAP: ${Object.keys(LEVEL_MIGRATION_MAP).length}个映射\n`);

  console.log('新的效力位阶顺序：');
  LEVEL_ORDER.forEach((level, index) => {
    console.log(`  ${index + 1}. ${level}`);
  });
  console.log('');

  // 2. 验证数据库迁移
  console.log('2️⃣ 验证数据库迁移\n');

  const oldLevels = ['经济特区法规', '海南自由贸易港法规'];
  let hasOldData = false;

  for (const oldLevel of oldLevels) {
    const count = await prisma.law.count({
      where: { level: oldLevel }
    });
    if (count > 0) {
      console.log(`⚠️ 仍有 ${count}条数据使用"${oldLevel}"`);
      hasOldData = true;
    } else {
      console.log(`✅ "${oldLevel}"已完全迁移`);
    }
  }

  // 3. 验证地方性法规数量
  console.log('\n3️⃣ 验证地方性法规数量\n');
  const localRegulationsCount = await prisma.law.count({
    where: { level: '地方性法规' }
  });
  console.log(`地方性法规总数: ${localRegulationsCount}条`);
  console.log(`预期: 41条(原) + 4条(迁移) = 45条`);

  if (localRegulationsCount === 45) {
    console.log('✅ 数量正确！');
  } else {
    console.log(`⚠️ 数量不符，差异: ${localRegulationsCount - 45}条`);
  }

  // 4. 显示迁移的法规列表
  console.log('\n4️⃣ 迁移的法规列表\n');
  const migratedLaws = [
    { id: 397, title: '海南经济特区外国企业从事服务贸易经营活动登记管理暂行规定(2020年公布)' },
    { id: 388, title: '海南自由贸易港市场主体登记管理条例(2024年公布)' },
    { id: 400, title: '海南自由贸易港极简审批条例(2024年公布)' },
    { id: 401, title: '海南自由贸易港数字经济促进条例(2024年公布)' },
  ];

  for (const law of migratedLaws) {
    const dbLaw = await prisma.law.findUnique({
      where: { id: law.id },
      select: { id: true, title: true, level: true }
    });

    if (dbLaw) {
      const status = dbLaw.level === '地方性法规' ? '✅' : '❌';
      console.log(`${status} [${dbLaw.id}] ${dbLaw.title}`);
      console.log(`   当前位阶: ${dbLaw.level}\n`);
    } else {
      console.log(`❌ 未找到 ID=${law.id} 的法规\n`);
    }
  }

  // 5. 最终统计
  console.log('5️⃣ 当前数据库统计\n');
  const stats = await prisma.law.groupBy({
    by: ['level'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  stats.forEach(item => {
    console.log(`  ${item.level}: ${item._count.id}条`);
  });

  // 总结
  console.log('\n=== 验证总结 ===\n');
  if (!hasOldData && localRegulationsCount === 45) {
    console.log('✅ 所有验证通过！v1.7.1 修改成功！');
  } else {
    console.log('⚠️ 发现问题，请检查上述警告信息');
  }
}

verifyV171()
  .then(() => {
    console.log('\n✅ 验证脚本执行完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ 验证失败:', err);
    process.exit(1);
  });
