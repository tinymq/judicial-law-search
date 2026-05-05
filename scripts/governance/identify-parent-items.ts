/**
 * 识别并标记父子事项关系
 *
 * 父事项特征：lawId=NULL 且 legalBasisText=NULL，后跟连续子事项
 * 子事项特征：同province+domain+category，序号连续，有lawId或legalBasisText
 *
 * 用法：
 *   npx tsx scripts/governance/identify-parent-items.ts          # 试运行
 *   npx tsx scripts/governance/identify-parent-items.ts --apply   # 写入数据库
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function extractLawName(text: string | null): string {
  if (!text) return '';
  // First line of legalBasisText is the law name (before \r\n or 第X条)
  const firstLine = text.split(/[\r\n]+/)[0].replace(/_x000d_$/, '').trim();
  // Remove trailing article references like "第XX条..."
  return firstLine.replace(/\s*第[一-鿿\d]+条.*$/, '').trim();
}

async function main() {
  console.log(`=== 识别父子事项关系 ===`);
  console.log(`模式: ${APPLY ? '正式写入' : '试运行'}\n`);

  // Find all candidate parents: no lawId AND no legalBasisText
  const candidates = await prisma.enforcementItem.findMany({
    where: {
      lawId: null,
      OR: [
        { legalBasisText: null },
        { legalBasisText: '' },
      ],
    },
    select: { id: true, sequenceNumber: true, name: true, province: true, enforcementDomain: true, category: true },
    orderBy: [{ province: 'asc' }, { sequenceNumber: 'asc' }],
  });

  console.log(`候选父事项: ${candidates.length}\n`);

  let totalParents = 0;
  let totalChildren = 0;
  const updates: { childId: number; parentId: number }[] = [];

  for (const parent of candidates) {
    // Find consecutive items after this one, same province+domain+category
    const nextItems = await prisma.enforcementItem.findMany({
      where: {
        province: parent.province,
        enforcementDomain: parent.enforcementDomain,
        category: parent.category,
        sequenceNumber: { gt: parent.sequenceNumber },
      },
      select: { id: true, sequenceNumber: true, lawId: true, legalBasisText: true },
      orderBy: { sequenceNumber: 'asc' },
      take: 300,
    });

    const childIds: number[] = [];
    let groupLawName: string | null = null;
    for (const item of nextItems) {
      if (item.sequenceNumber !== parent.sequenceNumber + childIds.length + 1) break;
      if (!item.lawId && (!item.legalBasisText || item.legalBasisText === '')) break;
      // Group by law NAME from legalBasisText (more reliable than lawId)
      const lawName = extractLawName(item.legalBasisText);
      if (lawName) {
        if (groupLawName === null) groupLawName = lawName;
        else if (lawName !== groupLawName) break;
      }
      childIds.push(item.id);
    }

    if (childIds.length >= 2) {
      totalParents++;
      totalChildren += childIds.length;
      for (const childId of childIds) {
        updates.push({ childId, parentId: parent.id });
      }
      if (totalParents <= 10) {
        console.log(`[父] #${parent.id} (${childIds.length}子) ${parent.province} ${parent.enforcementDomain} | ${parent.name.substring(0, 50)}`);
      }
    }
  }

  console.log(`\n=== 结果 ===`);
  console.log(`父事项: ${totalParents}`);
  console.log(`子事项: ${totalChildren}`);
  console.log(`待写入关联: ${updates.length}`);

  if (APPLY && updates.length > 0) {
    console.log(`\n正在写入 parentId...`);
    // Clear existing parentId first
    await prisma.enforcementItem.updateMany({
      where: { parentId: { not: null } },
      data: { parentId: null },
    });

    // Batch update in chunks
    const BATCH = 100;
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH);
      await Promise.all(
        batch.map(u => prisma.enforcementItem.update({
          where: { id: u.childId },
          data: { parentId: u.parentId },
        }))
      );
      if ((i + BATCH) % 500 === 0 || i + BATCH >= updates.length) {
        console.log(`  已写入 ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
      }
    }
    console.log(`写入完成!`);
  } else if (!APPLY && updates.length > 0) {
    console.log(`\n提示: 添加 --apply 参数执行写入`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
