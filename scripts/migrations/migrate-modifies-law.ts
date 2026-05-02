/**
 * 填充 modifiesLawId —— 将"关于修改《X》的决定"指向被修改法规
 *
 * 用法:
 *   npx tsx scripts/migrations/migrate-modifies-law.ts           # preview 模式
 *   npx tsx scripts/migrations/migrate-modifies-law.ts --execute # 写入数据库
 */

import { prisma } from '@/src/lib/db';
import { buildLawBaseTitle } from '@/src/lib/law-grouping';

const DECISION_RE = /关于修改《(.+?)》的决定/;

async function run() {
  const dryRun = !process.argv.includes('--execute');
  console.log(dryRun ? '=== PREVIEW 模式 ===' : '=== EXECUTE 模式 ===');

  const decisions = await prisma.law.findMany({
    where: { title: { contains: '关于修改' } },
    select: { id: true, title: true, modifiesLawId: true },
  });

  console.log(`\n找到 ${decisions.length} 部"关于修改"法规\n`);

  let matched = 0;
  let skipped = 0;
  let ambiguous = 0;

  for (const dec of decisions) {
    const m = dec.title.match(DECISION_RE);
    if (!m) {
      console.log(`[SKIP] #${dec.id} ${dec.title.substring(0, 60)} — 标题未匹配正则`);
      skipped++;
      continue;
    }

    if (dec.modifiesLawId) {
      console.log(`[SKIP] #${dec.id} 已有 modifiesLawId=${dec.modifiesLawId}`);
      skipped++;
      continue;
    }

    const targetName = m[1];
    const targetBase = buildLawBaseTitle(targetName);

    const candidates = await prisma.law.findMany({
      where: {
        title: { contains: targetName.substring(0, 10) },
        id: { not: dec.id },
      },
      select: { id: true, title: true, lawGroupId: true },
    });

    const exactMatches = candidates.filter(
      c => buildLawBaseTitle(c.title) === targetBase
    );

    if (exactMatches.length === 0) {
      console.log(`[MISS] #${dec.id} "${targetName}" — 未找到匹配法规`);
      ambiguous++;
      continue;
    }

    // 取同组中 ID 最小的（通常是原始版本或最早版本）
    const groups = new Map<string, typeof exactMatches>();
    for (const c of exactMatches) {
      const gid = c.lawGroupId || `solo_${c.id}`;
      if (!groups.has(gid)) groups.set(gid, []);
      groups.get(gid)!.push(c);
    }

    if (groups.size > 1) {
      console.log(`[WARN] #${dec.id} "${targetName}" — 匹配到 ${groups.size} 个不同法规组:`);
      for (const [gid, laws] of groups) {
        console.log(`  组 ${gid}: ${laws.map(l => `#${l.id} ${l.title.substring(0, 50)}`).join(', ')}`);
      }
      ambiguous++;
      continue;
    }

    // 单一法规组 — 选最新版本（ID 最大）
    const target = exactMatches.sort((a, b) => b.id - a.id)[0];
    console.log(`[MATCH] #${dec.id} → #${target.id} "${target.title.substring(0, 60)}"`);

    if (!dryRun) {
      await prisma.law.update({
        where: { id: dec.id },
        data: { modifiesLawId: target.id },
      });
    }
    matched++;
  }

  console.log(`\n=== 完成 ===`);
  console.log(`匹配: ${matched}, 跳过: ${skipped}, 待人工: ${ambiguous}`);
  if (dryRun) console.log('\n使用 --execute 写入数据库');

  await prisma.$disconnect();
}

run().catch(console.error);
