import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const bmgz = await prisma.law.findMany({
    where: { level: '部门规章' },
    select: { id: true, title: true, documentNumber: true, effectiveDate: true, issuingAuthority: true, preamble: true, industryId: true },
  });

  let noDocNum = 0, noEffDate = 0, noAuthority = 0, noPreamble = 0, noIndustry = 0;
  for (const l of bmgz) {
    if (!l.documentNumber) noDocNum++;
    if (!l.effectiveDate) noEffDate++;
    if (!l.issuingAuthority) noAuthority++;
    if (!l.preamble) noPreamble++;
    if (!l.industryId) noIndustry++;
  }

  const withArticles = await prisma.article.groupBy({ by: ['lawId'], _count: true });
  const lawsWithArticles = new Set(withArticles.map(a => a.lawId));
  const bmgzWithArticles = bmgz.filter(l => lawsWithArticles.has(l.id)).length;

  console.log(`部门规章总数: ${bmgz.length}`);
  console.log(`缺发文字号: ${noDocNum} (${(noDocNum / bmgz.length * 100).toFixed(1)}%)`);
  console.log(`缺施行日期: ${noEffDate} (${(noEffDate / bmgz.length * 100).toFixed(1)}%)`);
  console.log(`缺制定机关: ${noAuthority} (${(noAuthority / bmgz.length * 100).toFixed(1)}%)`);
  console.log(`缺序言: ${noPreamble} (${(noPreamble / bmgz.length * 100).toFixed(1)}%)`);
  console.log(`缺行业领域: ${noIndustry} (${(noIndustry / bmgz.length * 100).toFixed(1)}%)`);
  console.log(`无条文(全文): ${bmgz.length - bmgzWithArticles} (${((bmgz.length - bmgzWithArticles) / bmgz.length * 100).toFixed(1)}%)`);

  const cacheFile = path.join(__dirname, 'data', 'guizhangku-cache.json');
  if (fs.existsSync(cacheFile)) {
    const cache: any[] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    console.log(`\n规章库缓存条目数: ${cache.length}`);

    function norm(t: string): string {
      return t.replace(/<[^>]+>/g, '').replace(/[《》''「」【】\s]/g, '')
        .replace(/[""„‟"]/g, '"').replace(/（/g, '(').replace(/）/g, ')')
        .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
        .replace(/\(试行\)/g, '').trim();
    }

    const cacheNorms = new Set<string>();
    for (const r of cache) {
      const title = (r.f_202321360426 || '').replace(/<[^>]+>/g, '');
      const n = norm(title);
      if (n) cacheNorms.add(n);
    }
    console.log(`缓存去重后: ${cacheNorms.size} 条`);

    let matched = 0, unmatched = 0;
    const unmatchedTitles: string[] = [];
    for (const l of bmgz) {
      const n = norm(l.title);
      if (cacheNorms.has(n)) {
        matched++;
      } else {
        unmatched++;
        if (unmatchedTitles.length < 10) unmatchedTitles.push(l.title);
      }
    }
    console.log(`本地部门规章 vs 缓存匹配: ${matched} / ${bmgz.length}`);
    console.log(`缓存中无对应: ${unmatched} (${(unmatched / bmgz.length * 100).toFixed(1)}%)`);
    if (unmatchedTitles.length > 0) {
      console.log(`\n未匹配示例:`);
      for (const t of unmatchedTitles) console.log(`  ${t}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
