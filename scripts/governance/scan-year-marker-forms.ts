/**
 * 只读：扫描所有标题里 (...) 形态的年份括号，按实际形式分类统计
 * 目的：看清楚有哪些非标准形式需要规范化
 */

import path from 'path';
import { PrismaClient } from '@prisma/client';

const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;
const prisma = new PrismaClient();

// 抓出标题里所有形如 (...) 或 （...） 含 4 位年份的括号
const YEAR_PAREN_RE = /[(（][^(（)）]*[12]\d{3}[^(（)）]*[)）]/g;

async function main() {
  const laws = await prisma.law.findMany({ select: { id: true, title: true } });

  const markerCounts = new Map<string, number>();
  const markerExamples = new Map<string, number[]>();

  for (const law of laws) {
    const matches = law.title.match(YEAR_PAREN_RE);
    if (!matches) continue;
    for (const m of matches) {
      // 归一化：把全角括号转半角做分类 key，但保留原形用于展示
      const key = m.replace(/（/g, '(').replace(/）/g, ')');
      markerCounts.set(key, (markerCounts.get(key) || 0) + 1);
      if (!markerExamples.has(key)) markerExamples.set(key, []);
      if (markerExamples.get(key)!.length < 3) markerExamples.get(key)!.push(law.id);
    }
  }

  console.log(`总法规: ${laws.length}`);
  console.log(`不同年份括号形式: ${markerCounts.size}\n`);

  const sorted = Array.from(markerCounts.entries()).sort((a, b) => b[1] - a[1]);

  // 分类规则
  const standardRe = /^\([12]\d{3}年(修订|修正|公布|修改|发布)\)$/;
  const statusRe = /^\([12]\d{3}年(废止|失效)\)$/;
  const missingYearRe = /^\([12]\d{3}(修订|修正|公布|修改|发布)\)$/;
  const ordinalRe = /^\([12]\d{3}年第[一二三四五六七八九十]+次(修订|修正|修改|修改发布)\)$/;
  const pureYearRe = /^\([12]\d{3}\)$/;

  const buckets = {
    standard: [] as Array<[string, number]>,
    status: [] as Array<[string, number]>,
    missingYear: [] as Array<[string, number]>,
    ordinal: [] as Array<[string, number]>,
    pureYear: [] as Array<[string, number]>,
    other: [] as Array<[string, number]>,
  };

  for (const [key, count] of sorted) {
    if (standardRe.test(key)) buckets.standard.push([key, count]);
    else if (statusRe.test(key)) buckets.status.push([key, count]);
    else if (missingYearRe.test(key)) buckets.missingYear.push([key, count]);
    else if (ordinalRe.test(key)) buckets.ordinal.push([key, count]);
    else if (pureYearRe.test(key)) buckets.pureYear.push([key, count]);
    else buckets.other.push([key, count]);
  }

  const bucketTotal = (b: Array<[string, number]>) => b.reduce((s, [, c]) => s + c, 0);

  console.log('=== 分类统计（按条数合计）===');
  console.log(`标准格式 (YYYY年修订|修正|公布|修改|发布):    ${buckets.standard.length} 种 / ${bucketTotal(buckets.standard)} 条`);
  console.log(`状态标记 (YYYY年废止|失效)（Mo 说保留）:       ${buckets.status.length} 种 / ${bucketTotal(buckets.status)} 条`);
  console.log(`缺"年"字 (YYYY修订|修正|...)（需加"年"）:       ${buckets.missingYear.length} 种 / ${bucketTotal(buckets.missingYear)} 条`);
  console.log(`带"第X次"(YYYY年第X次修订|修正)（需去"第X次"）: ${buckets.ordinal.length} 种 / ${bucketTotal(buckets.ordinal)} 条`);
  console.log(`纯年份 (YYYY)（需补"年公布"）:                 ${buckets.pureYear.length} 种 / ${bucketTotal(buckets.pureYear)} 条`);
  console.log(`其他形式（需人工决定）:                        ${buckets.other.length} 种 / ${bucketTotal(buckets.other)} 条\n`);

  const show = (label: string, list: Array<[string, number]>, max = 20) => {
    if (list.length === 0) return;
    console.log(`\n=== ${label} ===`);
    list.slice(0, max).forEach(([k, c]) => {
      const examples = markerExamples.get(k)?.join(', ') ?? '';
      console.log(`  ${c.toString().padStart(4)}  ${k}  [样例 id: ${examples}]`);
    });
    if (list.length > max) console.log(`  ... 还有 ${list.length - max} 种`);
  };

  show('缺"年"字（将补"年"）', buckets.missingYear, 30);
  show('带"第X次"（将去"第X次"）', buckets.ordinal, 30);
  show('纯年份（将补"年公布"）', buckets.pureYear, 30);
  show('状态标记（保留）', buckets.status, 30);
  show('其他形式（需人工决定）', buckets.other, 50);
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
