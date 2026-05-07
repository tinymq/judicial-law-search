import { PrismaClient } from '@prisma/client';
import { matchIndustries } from '../../src/lib/industry-keywords';

async function main() {
  const p = new PrismaClient();

  const laws = await p.law.findMany({
    where: { industryId: null },
    select: { id: true, title: true, issuingAuthority: true, level: true }
  });
  console.log('总待匹配: ' + laws.length);

  const stats: Record<string, { total: number; matched: number; other: number }> = {};
  const otherList: { id: number; title: string; auth: string | null; level: string }[] = [];
  const distAll: Record<string, number> = {};
  let matched = 0, noMatch = 0;

  for (const law of laws) {
    const results = matchIndustries(law.title, law.issuingAuthority);
    const primary = results[0];
    const level = law.level || '未知';
    if (!stats[level]) stats[level] = { total: 0, matched: 0, other: 0 };
    stats[level].total++;

    if (primary.code === '99') {
      noMatch++;
      stats[level].other++;
      if (otherList.length < 40) otherList.push({ id: law.id, title: law.title, auth: law.issuingAuthority, level });
    } else {
      matched++;
      stats[level].matched++;
      const key = primary.code + ' ' + primary.name;
      distAll[key] = (distAll[key] || 0) + 1;
    }
  }

  console.log('\n=== 匹配总览 ===');
  console.log('已匹配: ' + matched + ' (' + (matched / laws.length * 100).toFixed(1) + '%)');
  console.log('归其他(无匹配): ' + noMatch + ' (' + (noMatch / laws.length * 100).toFixed(1) + '%)');

  console.log('\n=== 按效力位阶 ===');
  for (const [level, s] of Object.entries(stats).sort((a, b) => b[1].total - a[1].total)) {
    console.log(level + ': 总' + s.total + ' | 匹配' + s.matched + ' | 其他' + s.other + ' (' + (s.other / s.total * 100).toFixed(1) + '%)');
  }

  console.log('\n=== 匹配行业分布(TOP20) ===');
  const sorted = Object.entries(distAll).sort((a, b) => b[1] - a[1]).slice(0, 20);
  sorted.forEach(([k, v]) => console.log(k + ': ' + v));

  console.log('\n=== 归其他的法规采样(前40) ===');
  otherList.forEach(l => console.log('[' + l.level + '] id=' + l.id + ' auth=[' + (l.auth || '') + '] ' + l.title));

  await p.$disconnect();
}

main();
