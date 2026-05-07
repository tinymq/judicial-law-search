/**
 * 检查标准法规关联落库脚本
 *
 * 读取人工审核后的 Excel，结合 4 级匹配策略，
 * 将确认的法规关联写入 InspectionStandard.lawId。
 *
 * 策略：
 *   Level 1+2: 自动确认，直接写入
 *   Level 3:   排除 Excel 中标记为 N 的配对
 *   Level 4:   排除 Excel 中标记为 N 的配对
 *   未匹配:    跳过
 *
 * 用法：
 *   npx tsx scripts/governance/apply-inspection-law-links.ts          # 试运行
 *   npx tsx scripts/governance/apply-inspection-law-links.ts --apply  # 正式写入
 */

import { PrismaClient } from '@prisma/client';
import { extractBasisLawNames } from '../../src/lib/legal-basis-parser';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const EXCEL_PATH = 'C:/Users/26371/Documents/Mo Obsidian/Mo CCLearning/2026司法执法监督/执法事项研究/法规关联审核清单.xlsx';

// ── 规范化（同 link-inspection-standard-laws.ts） ──

function normalize(name: string): string {
  return name
    .replace(/^中华人民共和国/, '')
    .replace(/\(\d{4}年?[^)]*\)/, '')
    .replace(/（\d{4}年?[^）]*）/, '')
    .replace(/\s+/g, '')
    .trim();
}

function extractProvince(name: string): string | null {
  const m = name.match(/^(?:中华人民共和国)?([一-龥]{2,6}(?:省|市|自治区))/);
  return m ? m[1] : null;
}

const STOP_WORDS = new Set([
  '的', '和', '与', '及', '关于', '办法', '规定', '条例',
  '实施', '细则', '管理', '监督',
]);

function keywordOverlap(a: string, b: string): number {
  const tokensA = a.split('').filter(c => !STOP_WORDS.has(c));
  const tokensB = b.split('').filter(c => !STOP_WORDS.has(c));
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const overlap = tokensA.filter(t => tokensB.includes(t)).length;
  return overlap / Math.max(tokensA.length, tokensB.length);
}

// ── 读取 Excel 排除清单 ──

function loadExclusions(): Set<string> {
  const wb = XLSX.readFile(EXCEL_PATH);
  const exclusions = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

    for (const row of rows) {
      const confirm = (row['确认(Y正确/N错误)'] || '').trim().toUpperCase();
      if (confirm === 'N') {
        const source = (row['原始法规引用'] || '').trim();
        const matched = (row['匹配到的法规'] || '').trim();
        if (source && matched) {
          exclusions.add(`${source}|${matched}`);
        }
      }
    }
  }

  return exclusions;
}

// ── 匹配函数 ──

type MatchLevel = 'exact' | 'normalized' | 'contains' | 'keyword';

interface Match {
  lawId: number;
  lawTitle: string;
  level: MatchLevel;
}

function matchLawName(
  lawName: string,
  exactMap: Map<string, number>,
  normalizedMap: Map<string, { id: number; title: string }[]>,
  dbLaws: { id: number; title: string }[],
  exclusions: Set<string>,
): Match | null {
  // Level 1
  const exactId = exactMap.get(lawName);
  if (exactId !== undefined) {
    return { lawId: exactId, lawTitle: lawName, level: 'exact' };
  }

  // Level 2
  const normCited = normalize(lawName);
  const normMatches = normalizedMap.get(normCited);
  if (normMatches && normMatches.length > 0) {
    return { lawId: normMatches[0].id, lawTitle: normMatches[0].title, level: 'normalized' };
  }

  // Level 3
  const citedProvince = extractProvince(lawName);
  for (const law of dbLaws) {
    const normTitle = normalize(law.title);
    if (normTitle === normCited) continue;
    if (normTitle.includes(normCited) || normCited.includes(normTitle)) {
      const lawProvince = extractProvince(law.title);
      if (citedProvince && lawProvince && citedProvince !== lawProvince) continue;
      if (citedProvince && !lawProvince && law.title.startsWith('中华人民共和国')) continue;

      // 排除 Excel 中标记 N 的
      if (exclusions.has(`${lawName}|${law.title}`)) continue;

      return { lawId: law.id, lawTitle: law.title, level: 'contains' };
    }
  }

  // Level 4
  if (normCited.length >= 4) {
    let bestScore = 0;
    let bestLaw: { id: number; title: string } | null = null;
    for (const law of dbLaws) {
      const normTitle = normalize(law.title);
      const score = keywordOverlap(normCited, normTitle);
      if (score > bestScore) {
        bestScore = score;
        bestLaw = law;
      }
    }
    if (bestScore >= 0.8 && bestLaw) {
      if (exclusions.has(`${lawName}|${bestLaw.title}`)) return null;
      return { lawId: bestLaw.id, lawTitle: bestLaw.title, level: 'keyword' };
    }
  }

  return null;
}

// ── 主函数 ──

async function main() {
  console.log('=== 检查标准法规关联落库 ===');
  console.log(`模式: ${APPLY ? '正式写入数据库' : '试运行（仅统计）'}\n`);

  // 1. 加载排除清单
  console.log('加载 Excel 审核结果...');
  const exclusions = loadExclusions();
  console.log(`  排除配对数: ${exclusions.size}\n`);

  // 2. 加载法规
  console.log('加载法规数据...');
  const dbLaws = await prisma.law.findMany({ select: { id: true, title: true } });
  console.log(`  法规总数: ${dbLaws.length}`);

  const exactMap = new Map<string, number>();
  const normalizedMap = new Map<string, { id: number; title: string }[]>();
  for (const law of dbLaws) {
    exactMap.set(law.title, law.id);
    const norm = normalize(law.title);
    if (!normalizedMap.has(norm)) normalizedMap.set(norm, []);
    normalizedMap.get(norm)!.push(law);
  }

  // 3. 加载检查标准
  console.log('加载检查标准数据...');
  const standards = await prisma.inspectionStandard.findMany({
    where: { law: { not: null } },
    select: { id: true, law: true },
  });
  const withLaw = standards.filter(s => s.law && s.law.trim().length > 0);
  const total = await prisma.inspectionStandard.count();
  console.log(`  检查标准总数: ${total}`);
  console.log(`  有 law 字段: ${withLaw.length}\n`);

  // 4. 匹配并决定 lawId
  console.log('匹配并分配 lawId...');
  const matchCache = new Map<string, Match | null>();
  const stats = { exact: 0, normalized: 0, contains: 0, keyword: 0, unmatched: 0, skipped: 0 };
  const updates: { id: number; lawId: number }[] = [];

  for (const std of withLaw) {
    let names: string[];
    try { names = extractBasisLawNames(std.law!); } catch { continue; }
    if (!names || names.length === 0) { stats.skipped++; continue; }

    // 取第一个能匹配的法规作为 lawId（同 EnforcementItem 策略）
    let bestMatch: Match | null = null;
    for (const name of names) {
      if (matchCache.has(name)) {
        const cached = matchCache.get(name)!;
        if (cached) { bestMatch = cached; break; }
        continue;
      }
      const m = matchLawName(name, exactMap, normalizedMap, dbLaws, exclusions);
      matchCache.set(name, m);
      if (m) { bestMatch = m; break; }
    }

    if (bestMatch) {
      stats[bestMatch.level]++;
      updates.push({ id: std.id, lawId: bestMatch.lawId });
    } else {
      stats.unmatched++;
    }
  }

  console.log('\n── 匹配结果 ──');
  console.log(`  Level 1 精确:   ${stats.exact}`);
  console.log(`  Level 2 规范化: ${stats.normalized}`);
  console.log(`  Level 3 包含:   ${stats.contains}`);
  console.log(`  Level 4 关键词: ${stats.keyword}`);
  console.log(`  未匹配:         ${stats.unmatched}`);
  console.log(`  无法解析:       ${stats.skipped}`);
  console.log(`  待写入 lawId:   ${updates.length}`);

  // 5. 写入数据库
  if (APPLY && updates.length > 0) {
    console.log('\n写入数据库...');
    let written = 0;
    const batchSize = 500;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const cases = batch.map(u => `WHEN ${u.id} THEN ${u.lawId}`).join(' ');
      const ids = batch.map(u => u.id).join(',');
      await prisma.$executeRawUnsafe(
        `UPDATE InspectionStandard SET lawId = CASE id ${cases} END WHERE id IN (${ids})`
      );
      written += batch.length;
      if (written % 2000 === 0 || written === updates.length) {
        console.log(`  ${written}/${updates.length}`);
      }
    }
    console.log(`\n完成！共写入 ${written} 条 lawId`);
  } else if (!APPLY) {
    console.log('\n提示: 添加 --apply 参数正式写入数据库');
  }

  // 6. 未匹配统计
  const unmatchedNames = new Map<string, number>();
  for (const [name, match] of matchCache) {
    if (!match) unmatchedNames.set(name, (unmatchedNames.get(name) || 0) + 1);
  }
  if (unmatchedNames.size > 0) {
    console.log(`\n── 未匹配法规名 Top 20 ──`);
    const sorted = [...unmatchedNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    for (const [name] of sorted) {
      console.log(`  ${name}`);
    }
    console.log(`  共 ${unmatchedNames.size} 个未匹配法规名`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('脚本执行失败:', e);
  prisma.$disconnect();
  process.exit(1);
});
