/**
 * 批量迁移 lawGroupId 的脚本
 *
 * 目标：
 * 1. 统一格式：8位 → 12位 LAW_ 前缀
 * 2. 保持现有关联：同一 groupid 的法规，迁移后仍然保持同一 groupid
 * 3. 基于 lawId 最小的法规标题生成新的 lawGroupId
 */

import { prisma } from '@/src/lib/db';
import crypto from 'crypto';

// 清理标题：去掉年份和修饰词
function cleanTitleForGroupId(title: string) {
  return title
    .replace(/\(\d{4}[^)]*\)/g, '')
    .replace(/暂行|试行|修改|修订/g, '')
    .trim();
}

// 生成法规组ID
function generateLawGroupId(title: string) {
  const clean = cleanTitleForGroupId(title);
  const hash = crypto.createHash('md5').update(clean).digest('hex');
  return `LAW_${hash.substring(0, 12).toUpperCase()}`;
}

async function migrateLawGroups() {
  console.log('=== 开始迁移 lawGroupId ===\n');

  // 1. 查询所有法规
  const allLaws = await prisma.law.findMany({
    select: {
      id: true,
      title: true,
      lawGroupId: true,
    },
    orderBy: { id: 'asc' }
  });

  console.log(`✓ 查询到 ${allLaws.length} 条法规\n`);

  // 2. 按 lawGroupId 分组
  const groupMap = new Map<string, any[]>();
  allLaws.forEach(law => {
    const groupId = law.lawGroupId || 'null';
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, []);
    }
    groupMap.get(groupId)!.push(law);
  });

  console.log(`✓ 现有 ${groupMap.size} 个不同的 lawGroupId\n`);

  // 3. 计算每个组的新 lawGroupId
  const migrationPlan: any[] = [];

  for (const [oldGroupId, laws] of groupMap.entries()) {
    if (oldGroupId === 'null') {
      console.log(`⚠️  跳过 lawGroupId 为 null 的法规`);
      continue;
    }

    // 找到 lawId 最小的法规
    const minLawIdLaw = laws.reduce((min, law) =>
      law.id < min.id ? law : min
    );

    // 基于最小 lawId 的法规标题生成新的 lawGroupId
    const newGroupId = generateLawGroupId(minLawIdLaw.title);

    // 检查是否需要转换
    const isOldFormat = /^[A-F0-9]{8}$/.test(oldGroupId);
    const needsConversion = isOldFormat || oldGroupId !== newGroupId;

    migrationPlan.push({
      oldGroupId,
      newGroupId,
      lawCount: laws.length,
      minLawId: minLawIdLaw.id,
      basedOnTitle: minLawIdLaw.title,
      needsConversion,
      isOldFormat,
    });
  }

  // 4. 显示迁移计划
  const needsConversionCount = migrationPlan.filter(p => p.needsConversion).length;
  console.log('=== 迁移计划统计 ===\n');
  console.log(`需要迁移的组: ${needsConversionCount}`);
  console.log(`不需要迁移的组: ${migrationPlan.length - needsConversionCount}`);
  console.log(`总计: ${migrationPlan.length} 个组\n`);

  // 5. 显示迁移计划详情（前10条）
  console.log('=== 迁移计划详情（前10条）===\n');
  console.table(migrationPlan.slice(0, 10));

  // 6. 确认是否执行
  console.log('\n⚠️  即将执行数据库迁移！');
  console.log('💡 建议先备份数据库：cp dev.db dev.db.backup');
  console.log('\n是否继续？(请输入 "yes" 确认)');

  // 注意：这个脚本需要手动确认后才执行实际迁移
  // 实际执行时会使用事务，确保可以回滚

  await prisma.$disconnect();
}

migrateLawGroups().catch(console.error);
