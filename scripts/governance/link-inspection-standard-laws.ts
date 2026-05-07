/**
 * 检查标准法规关联脚本
 *
 * 解析 InspectionStandard.law 文本字段，提取法规名称，
 * 与 Law 表进行多级匹配，生成关联报告。
 *
 * 匹配策略（沿用 relink-enforcement-items.ts）：
 *   Level 1: 精确匹配 Law.title
 *   Level 2: 规范化匹配（去"中华人民共和国"前缀 + 去年份修订后缀）
 *   Level 3: 包含/子串匹配（双向，含省级校验）
 *   Level 4: 关键词重叠（≥80%）
 *
 * 用法：
 *   npx tsx scripts/governance/link-inspection-standard-laws.ts          # 试运行
 *   npx tsx scripts/governance/link-inspection-standard-laws.ts --apply  # 输出 JSON
 */

import { PrismaClient } from '@prisma/client';
import { extractBasisLawNames } from '../../src/lib/legal-basis-parser';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// ────────────────────────────── 规范化函数 ──────────────────────────────

/** 规范化法规名称：去"中华人民共和国"前缀、去年份修订后缀、去空格 */
function normalize(name: string): string {
  return name
    .replace(/^中华人民共和国/, '')
    .replace(/\(\d{4}年?[^)]*\)/, '')
    .replace(/（\d{4}年?[^）]*）/, '')
    .replace(/\s+/g, '')
    .trim();
}

/** 提取省级前缀（如"浙江省"、"湖南省"） */
function extractProvince(name: string): string | null {
  const m = name.match(/^(?:中华人民共和国)?([一-龥]{2,6}(?:省|市|自治区))/);
  return m ? m[1] : null;
}

// ────────────────────────────── 匹配级别定义 ──────────────────────────────

type MatchLevel = 'exact' | 'normalized' | 'contains' | 'keyword' | 'unmatched';

interface MatchResult {
  lawName: string;         // 从 law 字段解析出的法规名
  matchLevel: MatchLevel;
  matchedLawId: number | null;
  matchedLawTitle: string | null;
  confidence: number;      // 0-1, keyword 匹配时为重叠率
}

interface InspectionLink {
  inspectionStandardId: number;
  enforcementItemId: number;
  lawFieldText: string;     // 原始 law 字段
  citations: MatchResult[];
}

// ────────────────────────────── 关键词重叠匹配 ──────────────────────────────

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

// ────────────────────────────── 主函数 ──────────────────────────────

async function main() {
  console.log('=== InspectionStandard 法规关联分析 ===');
  console.log(`模式: ${APPLY ? '正式输出 JSON' : '试运行（仅报告）'}\n`);

  // ── 1. 加载 Law 表，构建匹配索引 ──
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

  // ── 2. 加载 InspectionStandard 记录 ──
  console.log('加载检查标准数据...');
  const standards = await prisma.inspectionStandard.findMany({
    where: {
      law: { not: null },
    },
    select: {
      id: true,
      enforcementItemId: true,
      law: true,
      checkItem: true,
    },
  });

  // 过滤空字符串
  const withLaw = standards.filter(s => s.law && s.law.trim().length > 0);
  const totalRecords = await prisma.inspectionStandard.count();

  console.log(`  检查标准总数: ${totalRecords}`);
  console.log(`  有 law 字段: ${withLaw.length}`);
  console.log(`  无 law 字段: ${totalRecords - withLaw.length}\n`);

  // ── 3. 逐条解析并匹配 ──
  console.log('开始解析与匹配...');

  const allLinks: InspectionLink[] = [];
  const stats = {
    totalProcessed: 0,
    recordsWithParsedNames: 0,
    recordsNoParse: 0,
    totalCitations: 0,
    byLevel: {
      exact: 0,
      normalized: 0,
      contains: 0,
      keyword: 0,
      unmatched: 0,
    } as Record<MatchLevel, number>,
  };

  // 法规名 → 匹配结果缓存（避免重复匹配同一法规名）
  const matchCache = new Map<string, MatchResult>();
  // 未匹配法规名计数
  const unmatchedCounter = new Map<string, number>();
  // 所有去重法规名
  const allLawNames = new Set<string>();

  const progressInterval = Math.max(1, Math.floor(withLaw.length / 20));

  for (let i = 0; i < withLaw.length; i++) {
    const std = withLaw[i];
    stats.totalProcessed++;

    if ((i + 1) % progressInterval === 0 || i === withLaw.length - 1) {
      const pct = ((i + 1) / withLaw.length * 100).toFixed(1);
      process.stdout.write(`\r  进度: ${i + 1}/${withLaw.length} (${pct}%)`);
    }

    // 解析法规名
    const lawNames = extractBasisLawNames(std.law!);

    if (lawNames.length === 0) {
      stats.recordsNoParse++;
      allLinks.push({
        inspectionStandardId: std.id,
        enforcementItemId: std.enforcementItemId,
        lawFieldText: std.law!,
        citations: [],
      });
      continue;
    }

    stats.recordsWithParsedNames++;
    const citations: MatchResult[] = [];

    for (const lawName of lawNames) {
      allLawNames.add(lawName);
      stats.totalCitations++;

      // 检查缓存
      if (matchCache.has(lawName)) {
        const cached = matchCache.get(lawName)!;
        citations.push({ ...cached });
        stats.byLevel[cached.matchLevel]++;
        if (cached.matchLevel === 'unmatched') {
          unmatchedCounter.set(lawName, (unmatchedCounter.get(lawName) || 0) + 1);
        }
        continue;
      }

      const result = matchLawName(lawName, exactMap, normalizedMap, dbLaws);
      matchCache.set(lawName, result);
      citations.push(result);
      stats.byLevel[result.matchLevel]++;

      if (result.matchLevel === 'unmatched') {
        unmatchedCounter.set(lawName, (unmatchedCounter.get(lawName) || 0) + 1);
      }
    }

    allLinks.push({
      inspectionStandardId: std.id,
      enforcementItemId: std.enforcementItemId,
      lawFieldText: std.law!,
      citations,
    });
  }

  console.log('\n');

  // ── 4. 报告 ──
  printReport(stats, allLawNames, unmatchedCounter, matchCache, allLinks, withLaw);

  // ── 5. 输出 JSON（--apply 模式） ──
  if (APPLY) {
    const outputDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const outputPath = path.join(outputDir, `inspection-law-links-${timestamp}.json`);

    // 只输出有匹配结果的记录
    const linksWithMatches = allLinks.filter(
      link => link.citations.some(c => c.matchLevel !== 'unmatched')
    );

    const output = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRecordsProcessed: stats.totalProcessed,
        recordsWithMatches: linksWithMatches.length,
        matchStats: stats.byLevel,
        uniqueLawNames: allLawNames.size,
      },
      links: linksWithMatches.map(link => ({
        inspectionStandardId: link.inspectionStandardId,
        enforcementItemId: link.enforcementItemId,
        lawFieldText: link.lawFieldText,
        matchedLaws: link.citations
          .filter(c => c.matchLevel !== 'unmatched')
          .map(c => ({
            parsedLawName: c.lawName,
            matchLevel: c.matchLevel,
            lawId: c.matchedLawId,
            lawTitle: c.matchedLawTitle,
            confidence: c.confidence,
          })),
      })),
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`\n结果已写入: ${outputPath}`);
    console.log(`  含匹配的记录数: ${linksWithMatches.length}`);

    // 同时输出未匹配法规名清单
    const unmatchedPath = path.join(outputDir, `unmatched-inspection-laws-${timestamp}.json`);
    const unmatchedList = Array.from(unmatchedCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ lawName: name, occurrences: count }));

    fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedList, null, 2), 'utf-8');
    console.log(`  未匹配清单: ${unmatchedPath}`);
  }

  if (!APPLY) {
    console.log('\n提示: 添加 --apply 参数输出 JSON 结果文件');
  }

  await prisma.$disconnect();
}

// ────────────────────────────── 匹配单个法规名 ──────────────────────────────

function matchLawName(
  lawName: string,
  exactMap: Map<string, number>,
  normalizedMap: Map<string, { id: number; title: string }[]>,
  dbLaws: { id: number; title: string }[],
): MatchResult {
  // Level 1: 精确匹配
  const exactId = exactMap.get(lawName);
  if (exactId !== undefined) {
    return {
      lawName,
      matchLevel: 'exact',
      matchedLawId: exactId,
      matchedLawTitle: lawName,
      confidence: 1.0,
    };
  }

  // Level 2: 规范化匹配
  const normCited = normalize(lawName);
  const normMatches = normalizedMap.get(normCited);
  if (normMatches && normMatches.length > 0) {
    return {
      lawName,
      matchLevel: 'normalized',
      matchedLawId: normMatches[0].id,
      matchedLawTitle: normMatches[0].title,
      confidence: 0.95,
    };
  }

  // Level 3: 包含匹配（双向，含省级校验）
  const citedProvince = extractProvince(lawName);
  for (const law of dbLaws) {
    const normTitle = normalize(law.title);
    if (normTitle === normCited) continue; // 已被 Level 2 覆盖

    if (normTitle.includes(normCited) || normCited.includes(normTitle)) {
      // 省级校验：防止跨省误匹配
      const lawProvince = extractProvince(law.title);
      if (citedProvince && lawProvince && citedProvince !== lawProvince) continue;
      if (citedProvince && !lawProvince && law.title.startsWith('中华人民共和国')) continue;

      return {
        lawName,
        matchLevel: 'contains',
        matchedLawId: law.id,
        matchedLawTitle: law.title,
        confidence: 0.85,
      };
    }
  }

  // Level 4: 关键词重叠（≥80%）
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
      return {
        lawName,
        matchLevel: 'keyword',
        matchedLawId: bestLaw.id,
        matchedLawTitle: bestLaw.title,
        confidence: bestScore,
      };
    }
  }

  // 未匹配
  return {
    lawName,
    matchLevel: 'unmatched',
    matchedLawId: null,
    matchedLawTitle: null,
    confidence: 0,
  };
}

// ────────────────────────────── 报告打印 ──────────────────────────────

function printReport(
  stats: {
    totalProcessed: number;
    recordsWithParsedNames: number;
    recordsNoParse: number;
    totalCitations: number;
    byLevel: Record<MatchLevel, number>;
  },
  allLawNames: Set<string>,
  unmatchedCounter: Map<string, number>,
  matchCache: Map<string, MatchResult>,
  allLinks: InspectionLink[],
  withLaw: { id: number; law: string | null; checkItem: string }[],
) {
  const matchedCitations = stats.totalCitations - stats.byLevel.unmatched;
  const matchRate = stats.totalCitations > 0
    ? (matchedCitations / stats.totalCitations * 100).toFixed(1)
    : '0.0';

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         InspectionStandard 法规关联报告          ║');
  console.log('╚══════════════════════════════════════════════════╝');

  console.log('\n── 总览 ──');
  console.log(`  处理记录数:       ${stats.totalProcessed}`);
  console.log(`  可解析法规名:     ${stats.recordsWithParsedNames} 条记录`);
  console.log(`  无法解析:         ${stats.recordsNoParse} 条记录`);
  console.log(`  去重法规名总数:   ${allLawNames.size}`);
  console.log(`  引用总数（含重复）: ${stats.totalCitations}`);

  console.log('\n── 匹配率（按引用计） ──');
  console.log(`  Level 1 精确匹配:   ${stats.byLevel.exact} (${pct(stats.byLevel.exact, stats.totalCitations)})`);
  console.log(`  Level 2 规范化匹配: ${stats.byLevel.normalized} (${pct(stats.byLevel.normalized, stats.totalCitations)})`);
  console.log(`  Level 3 包含匹配:   ${stats.byLevel.contains} (${pct(stats.byLevel.contains, stats.totalCitations)})`);
  console.log(`  Level 4 关键词匹配: ${stats.byLevel.keyword} (${pct(stats.byLevel.keyword, stats.totalCitations)})`);
  console.log(`  未匹配:             ${stats.byLevel.unmatched} (${pct(stats.byLevel.unmatched, stats.totalCitations)})`);
  console.log(`  ──────────────────`);
  console.log(`  总匹配率:           ${matchRate}%`);

  // 按去重法规名统计
  let uniqueMatched = 0;
  let uniqueUnmatched = 0;
  for (const [, result] of matchCache) {
    if (result.matchLevel === 'unmatched') uniqueUnmatched++;
    else uniqueMatched++;
  }
  console.log('\n── 匹配率（按去重法规名） ──');
  console.log(`  已匹配: ${uniqueMatched} / ${matchCache.size} (${pct(uniqueMatched, matchCache.size)})`);
  console.log(`  未匹配: ${uniqueUnmatched} / ${matchCache.size} (${pct(uniqueUnmatched, matchCache.size)})`);

  // Top 20 未匹配法规名
  const unmatchedSorted = Array.from(unmatchedCounter.entries())
    .sort((a, b) => b[1] - a[1]);

  if (unmatchedSorted.length > 0) {
    console.log(`\n── Top ${Math.min(20, unmatchedSorted.length)} 未匹配法规名 ──`);
    for (let i = 0; i < Math.min(20, unmatchedSorted.length); i++) {
      const [name, count] = unmatchedSorted[i];
      console.log(`  ${String(i + 1).padStart(2)}. [${count}次] ${name}`);
    }
    if (unmatchedSorted.length > 20) {
      console.log(`  ... 还有 ${unmatchedSorted.length - 20} 个未匹配法规名`);
    }
  }

  // 无法解析示例
  if (stats.recordsNoParse > 0) {
    const noParseExamples = allLinks
      .filter(l => l.citations.length === 0)
      .slice(0, 10);

    console.log(`\n── 无法解析示例（前 ${Math.min(10, noParseExamples.length)} 条） ──`);
    for (const ex of noParseExamples) {
      const truncated = ex.lawFieldText.length > 80
        ? ex.lawFieldText.substring(0, 80) + '...'
        : ex.lawFieldText;
      console.log(`  #${ex.inspectionStandardId}: ${truncated}`);
    }
  }

  // 匹配示例（每个级别各取 5 条）
  console.log('\n── 匹配示例 ──');
  const levels: MatchLevel[] = ['exact', 'normalized', 'contains', 'keyword'];
  for (const level of levels) {
    const examples = Array.from(matchCache.entries())
      .filter(([, r]) => r.matchLevel === level)
      .slice(0, 5);

    if (examples.length === 0) continue;

    const levelLabel = {
      exact: 'Level 1 精确匹配',
      normalized: 'Level 2 规范化匹配',
      contains: 'Level 3 包含匹配',
      keyword: 'Level 4 关键词匹配',
    }[level];

    console.log(`\n  ${levelLabel}:`);
    for (const [, result] of examples) {
      if (result.matchLevel === level) {
        const arrow = result.lawName === result.matchedLawTitle
          ? `"${result.lawName}"`
          : `"${result.lawName}" -> "${result.matchedLawTitle}"`;
        const conf = level === 'keyword'
          ? ` (${(result.confidence * 100).toFixed(0)}%)`
          : '';
        console.log(`    ${arrow}${conf}`);
      }
    }
  }

  // 多引用记录统计
  const multiCite = allLinks.filter(l => l.citations.length > 1);
  if (multiCite.length > 0) {
    console.log(`\n── 多法规引用 ──`);
    console.log(`  引用多部法规的记录数: ${multiCite.length}`);

    const citationDist = new Map<number, number>();
    for (const link of multiCite) {
      const n = link.citations.length;
      citationDist.set(n, (citationDist.get(n) || 0) + 1);
    }
    const sorted = Array.from(citationDist.entries()).sort((a, b) => a[0] - b[0]);
    for (const [count, num] of sorted) {
      console.log(`    引用 ${count} 部法规: ${num} 条记录`);
    }

    // 展示 3 个多引用示例
    console.log('\n  示例:');
    for (const link of multiCite.slice(0, 3)) {
      const truncated = link.lawFieldText.length > 60
        ? link.lawFieldText.substring(0, 60) + '...'
        : link.lawFieldText;
      console.log(`    #${link.inspectionStandardId}: "${truncated}"`);
      for (const c of link.citations) {
        const status = c.matchLevel === 'unmatched' ? 'X' : 'V';
        console.log(`      [${status}] ${c.lawName} -> ${c.matchedLawTitle || '(未匹配)'} [${c.matchLevel}]`);
      }
    }
  }
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return (n / total * 100).toFixed(1) + '%';
}

// ────────────────────────────── 启动 ──────────────────────────────

main().catch(e => {
  console.error('脚本执行失败:', e);
  prisma.$disconnect();
  process.exit(1);
});
