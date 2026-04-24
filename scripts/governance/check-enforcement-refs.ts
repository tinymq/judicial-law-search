/**
 * 只读：检查 scan-near-duplicates 识别的"建议删除"法规是否被 EnforcementItem 引用
 *
 * 目的：删 Law 前先找出受影响的执法事项，把它们的 lawId 改指到"保留"的那条，
 * 避免级联删除后执法事项指向孤儿 ID。
 *
 * 用法：
 *   npx tsx scripts/governance/check-enforcement-refs.ts
 */

import path from 'path';
import { PrismaClient } from '@prisma/client';
import { buildLawBaseTitle } from '../../src/lib/law-grouping';

const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;
const prisma = new PrismaClient();

type LawRow = {
  id: number;
  title: string;
  lawGroupId: string | null;
  status: string | null;
  level: string;
  issuingAuthority: string | null;
  documentNumber: string | null;
  preamble: string | null;
  promulgationDate: Date | null;
  effectiveDate: Date | null;
  _count: { articles: number };
};

function scoreCompleteness(law: LawRow): number {
  let score = 0;
  score += law.title.length * 0.5;
  if (/[（(\[]\s*\d{4}/.test(law.title)) score += 15;
  if (law.documentNumber && law.documentNumber.trim()) score += 5;
  if (law.preamble && law.preamble.trim()) score += 5;
  if (law.effectiveDate) score += 3;
  if (law.promulgationDate) score += 2;
  if (law.issuingAuthority && law.issuingAuthority.trim()) score += 3;
  score += (law._count?.articles ?? 0) * 0.1;
  return score;
}

function isLikelyDuplicate(a: LawRow, b: LawRow): boolean {
  if (a.effectiveDate && b.effectiveDate && a.effectiveDate.getTime() === b.effectiveDate.getTime()) return true;
  if (a.promulgationDate && b.promulgationDate && a.promulgationDate.getTime() === b.promulgationDate.getTime()) return true;
  if (a.documentNumber && b.documentNumber && a.documentNumber === b.documentNumber) return true;
  if (!a.effectiveDate && !b.effectiveDate && !a.promulgationDate && !b.promulgationDate && !a.documentNumber && !b.documentNumber) return true;
  return false;
}

async function main() {
  console.log('📊 检查待删法规是否被 EnforcementItem 引用（只读）\n');

  const laws = (await prisma.law.findMany({
    select: {
      id: true, title: true, lawGroupId: true, status: true, level: true,
      issuingAuthority: true, documentNumber: true, preamble: true,
      promulgationDate: true, effectiveDate: true,
      _count: { select: { articles: true } },
    },
  })) as LawRow[];

  // 1. 复用 scan-near-duplicates 的算法，识别 dropId
  const clusters = new Map<string, LawRow[]>();
  for (const law of laws) {
    const base = buildLawBaseTitle(law.title);
    if (!clusters.has(base)) clusters.set(base, []);
    clusters.get(base)!.push(law);
  }

  type DupPair = { dropId: number; keepId: number; baseTitle: string };
  const pairs: DupPair[] = [];
  for (const [base, members] of clusters) {
    if (members.length < 2) continue;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        if (!isLikelyDuplicate(a, b)) continue;
        const aScore = scoreCompleteness(a);
        const bScore = scoreCompleteness(b);
        const keep = aScore >= bScore ? a : b;
        const drop = aScore >= bScore ? b : a;
        pairs.push({ dropId: drop.id, keepId: keep.id, baseTitle: base });
      }
    }
  }

  const dropIds = pairs.map((p) => p.dropId);
  const dropToKeep = new Map<number, number>();
  const dropToBase = new Map<number, string>();
  for (const p of pairs) {
    dropToKeep.set(p.dropId, p.keepId);
    dropToBase.set(p.dropId, p.baseTitle);
  }

  console.log(`识别出待删法规 ID: ${dropIds.length} 条`);

  // 2. 查 EnforcementItem 的 lawId 指向这些 ID 的事项
  const affected = await prisma.enforcementItem.findMany({
    where: { lawId: { in: dropIds } },
    select: {
      id: true,
      sequenceNumber: true,
      name: true,
      category: true,
      province: true,
      lawId: true,
      law: { select: { id: true, title: true } },
    },
  });

  console.log(`\n=== 受影响的 EnforcementItem ===`);
  console.log(`总数: ${affected.length}`);

  if (affected.length === 0) {
    console.log('✅ 没有执法事项指向待删法规，可以安全删除。');
    return;
  }

  // 按省份 + 待删 lawId 分组
  const byDropLaw = new Map<number, typeof affected>();
  for (const item of affected) {
    if (!item.lawId) continue;
    if (!byDropLaw.has(item.lawId)) byDropLaw.set(item.lawId, []);
    byDropLaw.get(item.lawId)!.push(item);
  }

  console.log(`\n=== 按待删法规 ID 分组 ===`);
  Array.from(byDropLaw.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([dropId, items]) => {
      const keepId = dropToKeep.get(dropId);
      const baseTitle = dropToBase.get(dropId);
      console.log(`\n[待删 #${dropId}] ${baseTitle}（${items[0]?.law?.title ?? '?'}）`);
      console.log(`  → 应改关联到 [保留 #${keepId}]`);
      console.log(`  受影响执法事项: ${items.length} 条`);
      items.slice(0, 5).forEach((item) => {
        console.log(`    - [${item.id}] ${item.province} #${item.sequenceNumber} ${item.name} (${item.category})`);
      });
      if (items.length > 5) {
        console.log(`    ... 还有 ${items.length - 5} 条`);
      }
    });

  // 输出修正 SQL
  console.log(`\n=== 修正建议（改库时参考）===`);
  console.log(`以下 SQL 可用于把受影响的执法事项改指到保留的法规：`);
  console.log();
  for (const [dropId, items] of byDropLaw) {
    const keepId = dropToKeep.get(dropId);
    console.log(`UPDATE EnforcementItem SET lawId = ${keepId} WHERE lawId = ${dropId};  -- ${items.length} 条`);
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
