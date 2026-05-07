import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { extractBasisLawNames } from '../../src/lib/legal-basis-parser';

const prisma = new PrismaClient();

function normalize(name: string): string {
  return name
    .replace(/^中华人民共和国/, '')
    .replace(/\(.*?(修正|公布|修订).*?\)$/, '')
    .trim();
}

async function main() {
  console.log('加载数据...');
  const laws = await prisma.law.findMany({ select: { id: true, title: true } });
  console.log(`  法规: ${laws.length} 条`);

  const standards = await prisma.inspectionStandard.findMany({
    where: { NOT: { law: '' } },
    select: { id: true, law: true, checkItem: true, enforcementItemId: true },
  });
  console.log(`  检查标准(有law): ${standards.length} 条`);

  const items = await prisma.enforcementItem.findMany({ select: { id: true, name: true } });
  const itemMap = new Map(items.map(i => [i.id, i.name]));

  const level3Results: any[] = [];
  const level4Results: any[] = [];
  const cache = new Map<string, any>();

  console.log('分析匹配...');
  let processed = 0;

  for (const std of standards) {
    if (!std.law) continue;
    processed++;
    if (processed % 2000 === 0) console.log(`  ${processed}/${standards.length}`);

    let names: string[];
    try { names = extractBasisLawNames(std.law); } catch { continue; }
    if (!names || names.length === 0) continue;

    for (const rawName of names) {
      if (cache.has(rawName)) {
        const cached = cache.get(rawName);
        if (cached) {
          const row = { ...cached, stdId: std.id, checkItem: std.checkItem, itemName: itemMap.get(std.enforcementItemId) || '' };
          if (cached.level === 3) level3Results.push(row);
          if (cached.level === 4) level4Results.push(row);
        }
        continue;
      }

      const normName = normalize(rawName);

      // Level 1
      if (laws.some(l => l.title === rawName)) { cache.set(rawName, null); continue; }
      // Level 2
      if (laws.some(l => normalize(l.title) === normName)) { cache.set(rawName, null); continue; }

      // Level 3
      const containsMatch = laws.find(l => {
        const nt = normalize(l.title);
        return (nt.includes(normName) || normName.includes(nt)) && nt !== normName;
      });
      if (containsMatch) {
        const srcLen = normName.length;
        const dstLen = normalize(containsMatch.title).length;
        const ratio = Math.min(srcLen, dstLen) / Math.max(srcLen, dstLen);
        if (ratio < 0.7 || srcLen <= 3) {
          const entry = { level: 3, sourceLaw: rawName, matchedLaw: containsMatch.title, ratio: Math.round(ratio * 100) + '%' };
          cache.set(rawName, entry);
          level3Results.push({ ...entry, stdId: std.id, checkItem: std.checkItem, itemName: itemMap.get(std.enforcementItemId) || '' });
        } else {
          cache.set(rawName, null);
        }
        continue;
      }

      // Level 4
      const srcTokens = [...new Set(normName.split(''))];
      let bestMatch: typeof laws[0] | null = null;
      let bestScore = 0;
      for (const l of laws) {
        const dstNorm = normalize(l.title);
        const dstTokens = [...new Set(dstNorm.split(''))];
        const overlap = srcTokens.filter(t => dstTokens.includes(t)).length;
        const score = overlap / Math.max(srcTokens.length, dstTokens.length);
        if (score >= 0.8 && score > bestScore) { bestScore = score; bestMatch = l; }
      }
      if (bestMatch) {
        const entry = { level: 4, sourceLaw: rawName, matchedLaw: bestMatch.title, ratio: Math.round(bestScore * 100) + '%' };
        cache.set(rawName, entry);
        level4Results.push({ ...entry, stdId: std.id, checkItem: std.checkItem, itemName: itemMap.get(std.enforcementItemId) || '' });
      } else {
        cache.set(rawName, null);
      }
    }
  }

  // Dedup
  function dedup(arr: any[]) {
    const seen = new Map<string, any>();
    for (const r of arr) {
      const key = r.sourceLaw + '|' + r.matchedLaw;
      if (!seen.has(key)) seen.set(key, { ...r, count: 1 });
      else seen.get(key)!.count++;
    }
    return [...seen.values()].sort((a, b) => b.count - a.count);
  }

  const l3 = dedup(level3Results);
  const l4 = dedup(level4Results);
  console.log(`\nLevel 3 可疑匹配: ${l3.length} 条（去重）, 涉及 ${level3Results.length} 条记录`);
  console.log(`Level 4 全量匹配: ${l4.length} 条（去重）, 涉及 ${level4Results.length} 条记录`);

  const toRows = (arr: any[]) => arr.map((r, i) => ({
    '序号': i + 1,
    '原始法规引用': r.sourceLaw,
    '匹配到的法规': r.matchedLaw,
    '匹配度': r.ratio,
    '出现次数': r.count,
    '示例检查项': r.checkItem,
    '示例事项': r.itemName,
    '确认(Y正确/N错误)': '',
    '备注': '',
  }));

  const wb = XLSX.utils.book_new();
  const ws3 = XLSX.utils.json_to_sheet(toRows(l3));
  const ws4 = XLSX.utils.json_to_sheet(toRows(l4));
  const cols = [{ wch: 5 }, { wch: 35 }, { wch: 50 }, { wch: 8 }, { wch: 8 }, { wch: 40 }, { wch: 35 }, { wch: 18 }, { wch: 12 }];
  ws3['!cols'] = cols;
  ws4['!cols'] = cols;
  XLSX.utils.book_append_sheet(wb, ws3, 'Level3可疑匹配');
  XLSX.utils.book_append_sheet(wb, ws4, 'Level4全量匹配');

  const outPath = 'C:/Users/26371/Documents/Mo Obsidian/Mo CCLearning/2026司法执法监督/执法事项研究/法规关联审核清单.xlsx';
  XLSX.writeFile(wb, outPath);
  console.log(`\n已导出: ${outPath}`);

  await prisma.$disconnect();
}

main().catch(console.error);
