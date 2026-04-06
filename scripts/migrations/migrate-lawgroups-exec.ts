/**
 * 批量迁移 lawGroupId - 执行脚本
 *
 * 注意：此脚本会修改数据库，请先备份！
 */

import { prisma } from '@/src/lib/db';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

// 备份数据库
function backupDatabase() {
  const dbPath = path.join(process.cwd(), 'dev.db');
  const backupPath = path.join(process.cwd(), 'dev.db.backup');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`数据库文件不存在: ${dbPath}`);
  }

  fs.copyFileSync(dbPath, backupPath);
  console.log(`✓ 数据库已备份到: ${backupPath}`);
  return backupPath;
}

async function migrateLawGroups() {
  console.log('=== 开始迁移 lawGroupId ===\n');

  // 1. 备份数据库
  console.log('步骤 1/4: 备份数据库...');
  const backupPath = backupDatabase();

  // 2. 查询所有法规
  console.log('\n步骤 2/4: 查询所有法规...');
  const allLaws = await prisma.law.findMany({
    select: {
      id: true,
      title: true,
      lawGroupId: true,
    },
    orderBy: { id: 'asc' }
  });
  console.log(`✓ 查询到 ${allLaws.length} 条法规`);

  // 3. 按 lawGroupId 分组并计算新的 lawGroupId
  console.log('\n步骤 3/4: 计算迁移计划...');
  const groupMap = new Map<string, any[]>();
  allLaws.forEach(law => {
    const groupId = law.lawGroupId || 'null';
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, []);
    }
    groupMap.get(groupId)!.push(law);
  });

  // 计算每个组的新 lawGroupId
  const migrationPlan: Map<string, string> = new Map();

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

    if (needsConversion) {
      migrationPlan.set(oldGroupId, newGroupId);
    }
  }

  const needsConversionCount = migrationPlan.size;
  console.log(`✓ 需要迁移的组: ${needsConversionCount}`);
  console.log(`✓ 不需要迁移的组: ${groupMap.size - needsConversionCount}`);

  // 4. 执行迁移（使用事务）
  console.log('\n步骤 4/4: 执行迁移...');

  let successCount = 0;
  let errorCount = 0;

  for (const [oldGroupId, newGroupId] of migrationPlan.entries()) {
    try {
      // 使用事务更新同一组的所有法规
      await prisma.$transaction(async (tx) => {
        const updated = await tx.law.updateMany({
          where: { lawGroupId: oldGroupId },
          data: { lawGroupId: newGroupId }
        });

        console.log(`✓ [${successCount + 1}/${needsConversionCount}] ${oldGroupId} → ${newGroupId} (${updated.count} 条)`);
      });

      successCount++;
    } catch (error) {
      console.error(`✗ 迁移失败: ${oldGroupId}`, error);
      errorCount++;
    }
  }

  // 5. 验证结果
  console.log('\n=== 验证迁移结果 ===');
  const finalLaws = await prisma.law.findMany({
    select: {
      lawGroupId: true,
    }
  });

  const finalGroups = new Set(finalLaws.map(l => l.lawGroupId));
  const oldFormatCount = Array.from(finalGroups).filter(g => g && /^[A-F0-9]{8}$/.test(g)).length;

  console.log(`✓ 成功迁移: ${successCount} 个组`);
  console.log(`✗ 失败: ${errorCount} 个组`);
  console.log(`✓ 剩余旧格式: ${oldFormatCount} 个组`);

  // 6. 总结
  console.log('\n=== 迁移完成 ===');
  console.log(`✓ 数据库备份: ${backupPath}`);
  console.log(`✓ 如需回滚，请执行: cp ${backupPath} dev.db`);

  await prisma.$disconnect();
}

// 执行迁移
migrateLawGroups()
  .then(() => {
    console.log('\n✅ 迁移成功完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 迁移失败:', error);
    console.error('💡 请使用备份回滚: cp dev.db.backup dev.db');
    process.exit(1);
  });
