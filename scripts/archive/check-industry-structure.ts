import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();

  const all = await p.industry.findMany({ orderBy: { code: 'asc' } });
  const parents = all.filter(i => i.parentCode === null);
  const children = all.filter(i => i.parentCode !== null);

  console.log('总行业数: ' + all.length);
  console.log('一级行业: ' + parents.length);
  console.log('子分类: ' + children.length);

  console.log('\n=== 子分类列表 ===');
  children.forEach(c => {
    const par = parents.find(p => p.code === c.parentCode);
    console.log('  id=' + c.id + ' code=' + c.code + ' ' + c.name + ' ← 父: ' + c.parentCode + ' ' + (par ? par.name : '?'));
  });

  // 执法事项使用的行业分布
  console.log('\n=== 执法事项行业分布 ===');
  const eiByIndustry = await p.enforcementItem.groupBy({
    by: ['industryId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } }
  });

  for (const g of eiByIndustry) {
    const ind = all.find(i => i.id === g.industryId);
    const isChild = ind && ind.parentCode !== null;
    console.log('  id=' + g.industryId + ' ' + (ind ? ind.code + ' ' + ind.name : '(null)') + (isChild ? ' [子分类]' : '') + ': ' + g._count.id + '条事项');
  }

  // 法规使用的行业分布（已有industryId的）
  console.log('\n=== 法规行业分布(已标注) ===');
  const lawByIndustry = await p.law.groupBy({
    by: ['industryId'],
    _count: { id: true },
    where: { industryId: { not: null } },
    orderBy: { _count: { id: 'desc' } }
  });

  let lawUsesChild = 0;
  for (const g of lawByIndustry.slice(0, 30)) {
    const ind = all.find(i => i.id === g.industryId);
    const isChild = ind && ind.parentCode !== null;
    if (isChild) lawUsesChild++;
    console.log('  id=' + g.industryId + ' ' + (ind ? ind.code + ' ' + ind.name : '(null)') + (isChild ? ' [子分类]' : '') + ': ' + g._count.id + '部法规');
  }
  console.log('  ... 法规使用子分类的记录数: ' + lawUsesChild);

  await p.$disconnect();
}

main();
