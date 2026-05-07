import { PrismaClient } from '@prisma/client';
import { matchIndustries } from './src/lib/industry-keywords';

async function main() {
  const p = new PrismaClient();

  // 1. 地方政府规章：看看有多少其实能通过标题匹配到更具体的行业
  const localGov = await p.law.findMany({
    where: { industryId: null, level: '地方政府规章' },
    select: { id: true, title: true, issuingAuthority: true }
  });

  let onlyGov = 0, hasSpecific = 0;
  const specificDist: Record<string, number> = {};

  for (const law of localGov) {
    const results = matchIndustries(law.title, law.issuingAuthority);
    if (results[0].code === '00') {
      if (results.length > 1 && results[1].code !== '99') {
        hasSpecific++;
        const key = results[1].code + ' ' + results[1].name;
        specificDist[key] = (specificDist[key] || 0) + 1;
      } else {
        onlyGov++;
      }
    }
  }

  console.log('=== 地方政府规章深度分析 ===');
  console.log('总数: ' + localGov.length);
  console.log('仅匹配人民政府(无第二结果): ' + onlyGov);
  console.log('有更具体的第二结果: ' + hasSpecific);
  console.log('\n第二结果行业分布(TOP20):');
  Object.entries(specificDist).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .forEach(([k, v]) => console.log('  ' + k + ': ' + v));

  // 2. 部门规章归其他的191条，看制定机关分布
  const deptAll = await p.law.findMany({
    where: { industryId: null, level: '部门规章' },
    select: { id: true, title: true, issuingAuthority: true }
  });

  const deptOtherAuth: Record<string, number> = {};
  const deptOtherSample: { auth: string; title: string }[] = [];

  for (const law of deptAll) {
    const results = matchIndustries(law.title, law.issuingAuthority);
    if (results[0].code === '99') {
      const auth = law.issuingAuthority || '(空)';
      deptOtherAuth[auth] = (deptOtherAuth[auth] || 0) + 1;
      if (deptOtherSample.length < 20) deptOtherSample.push({ auth, title: law.title });
    }
  }

  console.log('\n=== 部门规章归其他(191条)制定机关分布 ===');
  Object.entries(deptOtherAuth).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .forEach(([k, v]) => console.log('  ' + k + ': ' + v));

  console.log('\n部门规章归其他采样(前20):');
  deptOtherSample.forEach(s => console.log('  [' + s.auth + '] ' + s.title));

  // 3. 地方性法规归其他的619条采样
  const localLawAll = await p.law.findMany({
    where: { industryId: null, level: '地方性法规' },
    select: { id: true, title: true, issuingAuthority: true }
  });

  const localOtherSample: { auth: string; title: string }[] = [];
  for (const law of localLawAll) {
    const results = matchIndustries(law.title, law.issuingAuthority);
    if (results[0].code === '99') {
      if (localOtherSample.length < 30) {
        localOtherSample.push({ auth: law.issuingAuthority || '(空)', title: law.title });
      }
    }
  }

  console.log('\n=== 地方性法规归其他(619条)采样(前30) ===');
  localOtherSample.forEach(s => console.log('  [' + s.auth + '] ' + s.title));

  await p.$disconnect();
}

main();
