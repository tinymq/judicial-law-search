/**
 * Phase 2: effectiveDate 提取脚本
 *
 * 从法规最后几条的段落内容中提取施行日期
 *
 * 规则：
 * 1. 正则匹配"XXXX年X月X日起施行/实施/生效"
 * 2. "自公布之日起施行" → 取 promulgationDate
 * 3. 提取日期 > promulgationDate → 用提取日期
 * 4. 提取日期 <= promulgationDate → promulgationDate 是修订日期，取 promulgationDate
 *
 * 用法：
 *   npx tsx scripts/governance/fix-effective-date.ts          # 分析模式
 *   npx tsx scripts/governance/fix-effective-date.ts --apply   # 执行修复
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';

const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;
const prisma = new PrismaClient();

const applyMode = process.argv.includes('--apply');

// 匹配 "XXXX年X月X日" 格式的日期
const DATE_RE = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
// 匹配施行/实施/生效相关语句
const EFFECTIVE_RE = /(?:自|于)?\s*(\d{4})年(\d{1,2})月(\d{1,2})日[起]?(?:施行|实施|生效|执行)/;
// 匹配"自公布之日起施行"
const FROM_PUBLISH_RE = /自(?:公布|发布|印发|颁布)之日起(?:施行|实施|生效|执行)/;
// 匹配"自X年X月X日起施行，X年X月X日废止的XXX同时废止" - 取前面的日期
const EFFECTIVE_WITH_REPEAL_RE = /(?:自|于)?\s*(\d{4})年(\d{1,2})月(\d{1,2})日[起]?施行/;

function parseDate(year: string, month: string, day: string): Date | null {
  const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}

type ExtractResult = {
  lawId: number;
  title: string;
  promulgationDate: Date | null;
  extractedDate: Date | null;
  effectiveDate: Date | null;
  method: 'date_pattern' | 'from_publish' | 'no_match';
  matchedText: string;
};

async function main() {
  console.log(`模式: ${applyMode ? '🔧 执行修复' : '📊 分析模式（加 --apply 执行修复）'}\n`);

  // 查询所有无 effectiveDate 的法规基本信息
  const lawList = await prisma.law.findMany({
    where: { effectiveDate: null },
    select: { id: true, title: true, promulgationDate: true },
  });
  console.log(`待处理法规: ${lawList.length}\n`);

  // 用 raw SQL 一次性获取所有相关法规最后5条的段落内容
  // 这比逐条嵌套查询高效得多
  const lawIds = lawList.map(l => l.id);
  const lawMap = new Map(lawList.map(l => [l.id, l]));

  // 分批查询段落内容（SQLite 变量数限制）
  const QUERY_BATCH = 500;
  const paragraphsByLaw = new Map<number, string[]>();

  for (let i = 0; i < lawIds.length; i += QUERY_BATCH) {
    const batch = lawIds.slice(i, i + QUERY_BATCH);
    const placeholders = batch.map(() => '?').join(',');
    const rows = await prisma.$queryRawUnsafe<Array<{ lawId: number; content: string | null; artOrder: number }>>(
      `SELECT a.lawId, p.content, a."order" as artOrder
       FROM Article a
       JOIN Paragraph p ON p.articleId = a.id
       WHERE a.lawId IN (${placeholders})
       AND a."order" >= (SELECT MAX(a2."order") - 4 FROM Article a2 WHERE a2.lawId = a.lawId)
       ORDER BY a.lawId, a."order" DESC, p."order" ASC`,
      ...batch
    );
    for (const row of rows) {
      if (!paragraphsByLaw.has(row.lawId)) paragraphsByLaw.set(row.lawId, []);
      if (row.content) paragraphsByLaw.get(row.lawId)!.push(row.content);
    }
  }

  type LawInput = { id: number; title: string; promulgationDate: Date | null };
  const laws: Array<LawInput & { texts: string[] }> = lawList.map(l => ({
    ...l,
    texts: paragraphsByLaw.get(l.id) || [],
  }));

  const results: ExtractResult[] = [];
  let datePatternCount = 0;
  let fromPublishCount = 0;
  let noMatchCount = 0;

  for (const law of laws) {
    const allText = law.texts.join('\n');

    let extractedDate: Date | null = null;
    let method: ExtractResult['method'] = 'no_match';
    let matchedText = '';

    // 1. 尝试匹配明确的施行日期
    const effectiveMatch = allText.match(EFFECTIVE_RE) || allText.match(EFFECTIVE_WITH_REPEAL_RE);
    if (effectiveMatch) {
      extractedDate = parseDate(effectiveMatch[1], effectiveMatch[2], effectiveMatch[3]);
      if (extractedDate) {
        method = 'date_pattern';
        matchedText = effectiveMatch[0];
      }
    }

    // 2. 如果没有明确日期，尝试匹配"自公布之日起施行"
    if (!extractedDate && FROM_PUBLISH_RE.test(allText)) {
      method = 'from_publish';
      matchedText = allText.match(FROM_PUBLISH_RE)?.[0] || '';
    }

    // 3. 确定最终 effectiveDate
    let finalEffectiveDate: Date | null = null;
    if (method === 'date_pattern' && extractedDate) {
      if (law.promulgationDate && extractedDate.getTime() <= law.promulgationDate.getTime()) {
        // 提取日期 <= 公布日期，说明公布日期是修订日期，取公布日期
        finalEffectiveDate = law.promulgationDate;
      } else {
        finalEffectiveDate = extractedDate;
      }
      datePatternCount++;
    } else if (method === 'from_publish') {
      finalEffectiveDate = law.promulgationDate;
      fromPublishCount++;
    } else {
      noMatchCount++;
    }

    results.push({
      lawId: law.id,
      title: law.title,
      promulgationDate: law.promulgationDate,
      extractedDate,
      effectiveDate: finalEffectiveDate,
      method,
      matchedText,
    });
  }

  console.log(`=== 分析结果 ===`);
  console.log(`日期模式匹配成功: ${datePatternCount}`);
  console.log(`自公布之日起施行:  ${fromPublishCount}`);
  console.log(`无法提取:          ${noMatchCount}`);
  console.log(`可更新总数:        ${datePatternCount + fromPublishCount}`);

  // 展示无法匹配的样例
  const noMatches = results.filter(r => r.method === 'no_match');
  console.log(`\n=== 无法提取样例 (前 20) ===`);
  for (const r of noMatches.slice(0, 20)) {
    console.log(`  [${r.lawId}] ${r.title}`);
  }

  // 展示"自公布之日起施行"但无 promulgationDate 的
  const publishNoDate = results.filter(r => r.method === 'from_publish' && !r.promulgationDate);
  if (publishNoDate.length > 0) {
    console.log(`\n⚠️ "自公布之日起施行"但无公布日期: ${publishNoDate.length}`);
    for (const r of publishNoDate.slice(0, 10)) {
      console.log(`  [${r.lawId}] ${r.title}`);
    }
  }

  if (!applyMode) {
    console.log(`\n📊 分析完成。运行 --apply 执行修复。`);
    return;
  }

  // 执行修复
  const toUpdate = results.filter(r => r.effectiveDate !== null);
  console.log(`\n🔧 开始更新 ${toUpdate.length} 部法规的施行日期...`);

  const BATCH_SIZE = 100;
  let processed = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map(r =>
        prisma.law.update({
          where: { id: r.lawId },
          data: { effectiveDate: r.effectiveDate! },
        })
      )
    );
    processed += batch.length;
    if (processed % 1000 === 0 || processed === toUpdate.length) {
      console.log(`  进度: ${processed}/${toUpdate.length}`);
    }
  }

  const remainingNull = await prisma.law.count({ where: { effectiveDate: null } });
  console.log(`\n✅ 修复完成！`);
  console.log(`剩余 effectiveDate=NULL: ${remainingNull}`);
}

main()
  .catch(e => { console.error('错误:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
