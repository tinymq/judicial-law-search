/**
 * 删除近重复法规记录（复用 scan-near-duplicates 的检测算法）
 *
 * 三步事务：
 *   0. **articles 内容 diff 保护**：对每对跑 2-gram 相似度检查，内容差异
 *      大的对跳过（保险：万一 keep 和 drop 正文不一致，避免丢数据）
 *   1. 把 EnforcementItem.lawId 从 dropId 改指到 keepId
 *   2. 删除 Law 记录（Prisma Cascade 会连带删 articles/paragraphs/items/LawIndustry）
 *
 * 用法：
 *   npx tsx scripts/governance/delete-near-duplicates.ts          # 分析模式（含 diff）
 *   npx tsx scripts/governance/delete-near-duplicates.ts --apply  # 执行
 *
 * 前置条件：
 *   - 已备份 dev.db（cp dev.db dev.db.backup-YYMMDD）
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

const applyMode = process.argv.includes('--apply');

async function main() {
  console.log(`模式: ${applyMode ? '🔧 执行删除（改库）' : '📊 分析模式'}\n`);

  const laws = (await prisma.law.findMany({
    select: {
      id: true, title: true, lawGroupId: true, status: true, level: true,
      issuingAuthority: true, documentNumber: true, preamble: true,
      promulgationDate: true, effectiveDate: true,
      _count: { select: { articles: true } },
    },
  })) as LawRow[];

  const clusters = new Map<string, LawRow[]>();
  for (const law of laws) {
    const base = buildLawBaseTitle(law.title);
    if (!clusters.has(base)) clusters.set(base, []);
    clusters.get(base)!.push(law);
  }

  type Plan = { dropId: number; keepId: number; baseTitle: string; dropTitle: string; keepTitle: string };
  const plans: Plan[] = [];

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
        plans.push({
          dropId: drop.id,
          keepId: keep.id,
          baseTitle: base,
          dropTitle: drop.title,
          keepTitle: keep.title,
        });
      }
    }
  }

  console.log(`识别出删除计划: ${plans.length} 对`);

  if (plans.length === 0) {
    console.log('未发现近重复，跳过');
    return;
  }

  // ===== articles diff 保护 =====
  console.log(`\n=== articles 内容 diff 保护 ===`);
  console.log(`对每对 (keep, drop) 检查 articles 正文相似度，差异大的跳过...`);

  type DiffResult = {
    safe: boolean;
    similarity: number;
    lenDiff: number;
    reason: string;
  };

  async function fetchFullLaw(id: number) {
    return prisma.law.findUnique({
      where: { id },
      include: {
        articles: {
          orderBy: { order: 'asc' },
          include: {
            paragraphs: {
              orderBy: { order: 'asc' },
              include: { items: { orderBy: { order: 'asc' } } },
            },
          },
        },
      },
    });
  }

  function flattenLawText(law: NonNullable<Awaited<ReturnType<typeof fetchFullLaw>>>): string {
    const parts: string[] = [];
    for (const art of law.articles) {
      parts.push(art.title);
      for (const p of art.paragraphs) {
        if (p.content) parts.push(p.content);
        for (const it of p.items) {
          parts.push(it.content);
        }
      }
    }
    return parts.join(' ');
  }

  function twoGramSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (!a || !b) return 0;
    const gramsA = new Map<string, number>();
    for (let i = 0; i < a.length - 1; i++) {
      const g = a.slice(i, i + 2);
      gramsA.set(g, (gramsA.get(g) || 0) + 1);
    }
    let intersection = 0;
    let totalB = 0;
    const seen = new Map<string, number>();
    for (let i = 0; i < b.length - 1; i++) {
      const g = b.slice(i, i + 2);
      seen.set(g, (seen.get(g) || 0) + 1);
      totalB++;
    }
    for (const [g, cnt] of seen) {
      intersection += Math.min(gramsA.get(g) || 0, cnt);
    }
    return totalB === 0 ? 0 : intersection / totalB;
  }

  async function checkDiff(keepId: number, dropId: number): Promise<DiffResult> {
    const [keep, drop] = await Promise.all([fetchFullLaw(keepId), fetchFullLaw(dropId)]);
    if (!keep || !drop) return { safe: false, similarity: 0, lenDiff: 1, reason: '法规记录不存在' };
    const keepText = flattenLawText(keep);
    const dropText = flattenLawText(drop);

    // 两边都空 articles → 可能都是元数据记录，安全删（或人工审）
    if (keepText.length === 0 && dropText.length === 0) {
      return { safe: true, similarity: 1, lenDiff: 0, reason: '两边正文均为空' };
    }
    if (dropText.length === 0 && keepText.length > 0) {
      return { safe: true, similarity: 1, lenDiff: 1, reason: '待删方正文为空（无损失）' };
    }
    if (keepText.length === 0 && dropText.length > 0) {
      // 保留方空、待删方有 → 不安全，删了会丢正文
      return {
        safe: false,
        similarity: 0,
        lenDiff: 1,
        reason: `待删方有 ${dropText.length} 字正文，保留方为空（不能删）`,
      };
    }

    const lenDiff = Math.abs(keepText.length - dropText.length) / Math.max(keepText.length, dropText.length);
    const similarity = twoGramSimilarity(keepText, dropText);

    // 阈值：2-gram 相似度 >= 0.90 且 长度差 <= 0.10 → 安全
    const safe = similarity >= 0.9 && lenDiff <= 0.1;
    return {
      safe,
      similarity,
      lenDiff,
      reason: `similarity=${(similarity * 100).toFixed(1)}%, lenDiff=${(lenDiff * 100).toFixed(1)}%`,
    };
  }

  const safePlans: Plan[] = [];
  const unsafePlans: Array<Plan & { diff: DiffResult }> = [];

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const diff = await checkDiff(plan.keepId, plan.dropId);
    if (diff.safe) {
      safePlans.push(plan);
    } else {
      unsafePlans.push({ ...plan, diff });
    }
    if ((i + 1) % 10 === 0 || i + 1 === plans.length) {
      console.log(`  进度: ${i + 1}/${plans.length}`);
    }
  }

  console.log(`\n  安全可删: ${safePlans.length} 对`);
  console.log(`  ⚠️ 不安全（跳过）: ${unsafePlans.length} 对`);

  if (unsafePlans.length > 0) {
    console.log(`\n=== 跳过的不安全对 ===`);
    unsafePlans.forEach((p, i) => {
      console.log(`${i + 1}. baseTitle="${p.baseTitle}"`);
      console.log(`   keep #${p.keepId}: ${p.keepTitle}`);
      console.log(`   drop #${p.dropId}: ${p.dropTitle}`);
      console.log(`   ${p.diff.reason}`);
    });
  }

  // 用 safePlans 替代 plans 继续执行
  const finalPlans = safePlans;
  const dropIds = finalPlans.map((p) => p.dropId);
  const affectedItems = await prisma.enforcementItem.count({
    where: { lawId: { in: dropIds } },
  });
  console.log(`\n最终删除对数: ${finalPlans.length}`);
  console.log(`将重定向的执法事项: ${affectedItems} 条`);

  if (!applyMode) {
    console.log(`\n📊 分析完成。运行 --apply 执行删除。`);
    console.log(`\n⚠️ 执行 --apply 前务必已备份 dev.db`);
    return;
  }

  // ===== 执行模式 =====
  console.log(`\n🔧 开始执行...\n`);

  // Step 1: 重定向 EnforcementItem
  console.log(`Step 1/2: 重定向 EnforcementItem.lawId`);
  let redirected = 0;
  for (const plan of finalPlans) {
    const result = await prisma.enforcementItem.updateMany({
      where: { lawId: plan.dropId },
      data: { lawId: plan.keepId },
    });
    if (result.count > 0) {
      console.log(`  [drop #${plan.dropId} → keep #${plan.keepId}] ${result.count} 条执法事项`);
      redirected += result.count;
    }
  }
  console.log(`  小计: ${redirected} 条 EnforcementItem 已重定向\n`);

  // Step 2: 删除 Law 记录（级联删 articles/paragraphs/items/LawIndustry）
  console.log(`Step 2/2: 删除 Law 记录（Cascade 会连带删 articles/paragraphs/items/LawIndustry）`);
  const BATCH = 20;
  let deleted = 0;
  for (let i = 0; i < dropIds.length; i += BATCH) {
    const batch = dropIds.slice(i, i + BATCH);
    const result = await prisma.law.deleteMany({
      where: { id: { in: batch } },
    });
    deleted += result.count;
    console.log(`  进度: ${deleted}/${dropIds.length}`);
  }

  // 验证
  const remainingCount = await prisma.law.count();
  const remainingDupRefs = await prisma.enforcementItem.count({ where: { lawId: { in: dropIds } } });

  console.log(`\n✅ 删除完成`);
  console.log(`  Law 表剩余记录: ${remainingCount}（应为原值 - ${dropIds.length}）`);
  console.log(`  残留孤儿 EnforcementItem: ${remainingDupRefs}（应为 0）`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
