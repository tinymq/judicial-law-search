/**
 * 近重复扫描（只读）
 *
 * 识别"实质是同一版本但被录入为两条"的冗余记录。典型场景：
 *   [A] 中华人民共和国立法法（2015 修订）  ← 保留（带年份、有文号、有 preamble）
 *   [B] 中华人民共和国立法法              ← 建议删（信息少、可能是早期粗录入）
 *
 * 策略：
 *   1. 按 buildLawBaseTitle() 分组，只看多成员 cluster
 *   2. 两两比对同 cluster 内的记录，满足任一条件视为"近重复嫌疑"：
 *      - 施行日期完全相同
 *      - 公布日期完全相同
 *      - 发文字号完全相同（非空）
 *      - 两者均无日期和文号（弱疑似）
 *   3. 对每对疑似重复打分"信息完整度"，推荐保留高分、删除低分
 *
 * 用法：
 *   npx tsx scripts/governance/scan-near-duplicates.ts           # 只输出清单（本脚本无 --apply 模式，删除由人工或单独脚本完成）
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
  if (law.status && law.status !== '现行有效') score += 0;
  score += (law._count?.articles ?? 0) * 0.1;
  return score;
}

function isLikelyDuplicate(a: LawRow, b: LawRow): { yes: boolean; reason: string } {
  if (
    a.effectiveDate &&
    b.effectiveDate &&
    a.effectiveDate.getTime() === b.effectiveDate.getTime()
  ) {
    return { yes: true, reason: '施行日期相同' };
  }
  if (
    a.promulgationDate &&
    b.promulgationDate &&
    a.promulgationDate.getTime() === b.promulgationDate.getTime()
  ) {
    return { yes: true, reason: '公布日期相同' };
  }
  if (
    a.documentNumber &&
    b.documentNumber &&
    a.documentNumber === b.documentNumber
  ) {
    return { yes: true, reason: '发文字号相同' };
  }
  if (
    !a.effectiveDate &&
    !b.effectiveDate &&
    !a.promulgationDate &&
    !b.promulgationDate &&
    !a.documentNumber &&
    !b.documentNumber
  ) {
    return { yes: true, reason: '均无日期和文号（弱疑似）' };
  }
  return { yes: false, reason: '' };
}

async function main() {
  console.log('📊 近重复扫描（只读，不改数据）\n');

  const laws = (await prisma.law.findMany({
    select: {
      id: true,
      title: true,
      lawGroupId: true,
      status: true,
      level: true,
      issuingAuthority: true,
      documentNumber: true,
      preamble: true,
      promulgationDate: true,
      effectiveDate: true,
      _count: { select: { articles: true } },
    },
  })) as LawRow[];

  console.log(`总法规数: ${laws.length}`);

  const clusters = new Map<string, LawRow[]>();
  for (const law of laws) {
    const base = buildLawBaseTitle(law.title);
    if (!clusters.has(base)) clusters.set(base, []);
    clusters.get(base)!.push(law);
  }

  const multiClusters = Array.from(clusters.entries()).filter(
    ([, members]) => members.length > 1
  );
  console.log(`baseTitle 多成员 cluster: ${multiClusters.length}\n`);

  type Finding = {
    base: string;
    a: LawRow;
    b: LawRow;
    reason: string;
    aScore: number;
    bScore: number;
    keepId: number;
    dropId: number;
    scoreDiff: number;
  };

  const findings: Finding[] = [];
  const summary: Array<{ base: string; total: number; dupPairs: number }> = [];

  for (const [base, members] of multiClusters) {
    let dupPairs = 0;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        const { yes, reason } = isLikelyDuplicate(a, b);
        if (!yes) continue;
        const aScore = scoreCompleteness(a);
        const bScore = scoreCompleteness(b);
        const keep = aScore >= bScore ? a : b;
        const drop = aScore >= bScore ? b : a;
        findings.push({
          base,
          a,
          b,
          reason,
          aScore,
          bScore,
          keepId: keep.id,
          dropId: drop.id,
          scoreDiff: Math.abs(aScore - bScore),
        });
        dupPairs++;
      }
    }
    if (dupPairs > 0) summary.push({ base, total: members.length, dupPairs });
  }

  console.log('=== 汇总 ===');
  console.log(`疑似重复对总数: ${findings.length}`);
  console.log(`涉及 baseTitle 组: ${summary.length}`);
  console.log(
    `涉及法规记录数: ${new Set(findings.flatMap((f) => [f.a.id, f.b.id])).size}`
  );

  const byReason = new Map<string, number>();
  for (const f of findings) byReason.set(f.reason, (byReason.get(f.reason) || 0) + 1);
  console.log('\n=== 按匹配原因分布 ===');
  for (const [reason, count] of Array.from(byReason.entries()).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${reason}: ${count}`);
  }

  console.log('\n=== Top 30 cluster（dupPairs 多的在前）===');
  summary
    .sort((a, b) => b.dupPairs - a.dupPairs)
    .slice(0, 30)
    .forEach((g, i) => {
      console.log(`${i + 1}. "${g.base}" · 共 ${g.total} 条 · ${g.dupPairs} 对疑似重复`);
    });

  console.log('\n=== Top 50 近重复详情（按 score 差距从大到小）===');
  findings
    .sort((a, b) => b.scoreDiff - a.scoreDiff)
    .slice(0, 50)
    .forEach((f, i) => {
      const keep = f.keepId === f.a.id ? f.a : f.b;
      const drop = f.keepId === f.a.id ? f.b : f.a;
      const keepScore = f.keepId === f.a.id ? f.aScore : f.bScore;
      const dropScore = f.keepId === f.a.id ? f.bScore : f.aScore;
      const promul = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');
      console.log(`\n${i + 1}. baseTitle="${f.base}" · ${f.reason}`);
      console.log(
        `   ✅ 保留 #${keep.id} score=${keepScore.toFixed(1)} · ${keep.title}`
      );
      console.log(
        `      公布=${promul(keep.promulgationDate)} 施行=${promul(
          keep.effectiveDate
        )} 文号=${keep.documentNumber || '—'} preamble=${keep.preamble ? '有' : '无'} 条款=${keep._count.articles}`
      );
      console.log(
        `   ❌ 建议删 #${drop.id} score=${dropScore.toFixed(1)} · ${drop.title}`
      );
      console.log(
        `      公布=${promul(drop.promulgationDate)} 施行=${promul(
          drop.effectiveDate
        )} 文号=${drop.documentNumber || '—'} preamble=${drop.preamble ? '有' : '无'} 条款=${drop._count.articles}`
      );
    });

  console.log('\n📋 本脚本只输出清单，不删除任何数据');
  console.log('   删除请在 admin 后台逐条处理，或另写删除脚本（执行前 Mo 必须确认清单）');
}

main()
  .catch((e) => {
    console.error('❌', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
