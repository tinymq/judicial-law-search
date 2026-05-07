import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();

  // 1. 总体覆盖率
  const total = await p.law.count();
  const hasIndustry = await p.law.count({ where: { industryId: { not: null } } });
  const noIndustry = await p.law.count({ where: { industryId: null } });
  console.log('=== 总体覆盖率 ===');
  console.log('总法规: ' + total);
  console.log('已有行业: ' + hasIndustry + ' (' + (hasIndustry / total * 100).toFixed(1) + '%)');
  console.log('缺失行业: ' + noIndustry);

  // 2. 按效力位阶统计
  console.log('\n=== 按效力位阶 ===');
  const levels = await p.law.groupBy({
    by: ['level'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  for (const lv of levels) {
    const lvTotal = lv._count.id;
    const lvNull = await p.law.count({ where: { level: lv.level, industryId: null } });
    const lvOther = await p.law.count({ where: { level: lv.level, industryId: 67 } }); // id=67 is code=99 其他
    const lvSpecific = lvTotal - lvNull - lvOther;
    console.log((lv.level || '未知') + ': 总' + lvTotal + ' | 具体行业' + lvSpecific + ' | 归其他' + lvOther + ' | 缺失' + lvNull);
  }

  // 3. 归其他的总数
  const otherCount = await p.law.count({ where: { industryId: 67 } });
  console.log('\n归其他(code=99)总数: ' + otherCount);

  // 4. 行业分布 TOP20
  console.log('\n=== 行业分布 TOP20（全部法规） ===');
  const industries = await p.industry.findMany({ where: { parentCode: null } });
  const idToName: Record<number, string> = {};
  for (const ind of industries) idToName[ind.id] = ind.code + ' ' + ind.name;

  const dist = await p.law.groupBy({
    by: ['industryId'],
    _count: { id: true },
    where: { industryId: { not: null } },
    orderBy: { _count: { id: 'desc' } }
  });

  dist.slice(0, 20).forEach(g => {
    console.log('  ' + (idToName[g.industryId!] || 'id=' + g.industryId) + ': ' + g._count.id);
  });

  // 5. 抽样验证 - 每个位阶取5条新写入的（id >= 6678 大致是新批次）
  console.log('\n=== 抽样验证（每位阶5条） ===');
  const sampleLevels = ['法律', '部门规章', '地方政府规章', '地方性法规', '司法解释'];
  for (const sl of sampleLevels) {
    const samples = await p.law.findMany({
      where: { level: sl, industryId: { not: null, not: 67 } },
      select: { id: true, title: true, issuingAuthority: true, industry: { select: { code: true, name: true } } },
      orderBy: { id: 'desc' },
      take: 5
    });
    console.log('\n[' + sl + ']');
    samples.forEach(s => {
      console.log('  id=' + s.id + ' → ' + s.industry?.code + ' ' + s.industry?.name + ' | ' + s.title.substring(0, 40));
    });
  }

  await p.$disconnect();
}

main();
