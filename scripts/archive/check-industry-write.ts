import { PrismaClient } from '@prisma/client';
import { matchIndustries } from './src/lib/industry-keywords';

async function main() {
  const p = new PrismaClient();

  // 1. 建立 code → Industry.id 映射
  const industries = await p.industry.findMany({ where: { parentCode: null } });
  const codeToId: Record<string, number> = {};
  for (const ind of industries) {
    codeToId[ind.code] = ind.id;
  }
  console.log('行业映射表: ' + Object.keys(codeToId).length + ' 个一级行业');

  // 2. 查所有 industryId=null 的法规
  const laws = await p.law.findMany({
    where: { industryId: null },
    select: { id: true, title: true, issuingAuthority: true, level: true }
  });
  console.log('待处理: ' + laws.length + ' 条');

  // 3. 分批写入
  const BATCH = 200;
  let updated = 0, skipped = 0, failed = 0;
  const stats: Record<string, { total: number; matched: number; other: number }> = {};

  for (let i = 0; i < laws.length; i += BATCH) {
    const batch = laws.slice(i, i + BATCH);
    const ops = [];

    for (const law of batch) {
      const results = matchIndustries(law.title, law.issuingAuthority);
      const primary = results[0];
      const level = law.level || '未知';
      if (!stats[level]) stats[level] = { total: 0, matched: 0, other: 0 };
      stats[level].total++;

      const targetId = codeToId[primary.code];
      if (!targetId) {
        skipped++;
        console.log('  跳过: code=' + primary.code + ' 无对应id, law=' + law.id);
        continue;
      }

      if (primary.code === '99') {
        stats[level].other++;
      } else {
        stats[level].matched++;
      }

      ops.push(
        p.law.update({
          where: { id: law.id },
          data: { industryId: targetId }
        })
      );
    }

    if (ops.length > 0) {
      await p.$transaction(ops);
      updated += ops.length;
    }

    if ((i + BATCH) % 1000 === 0 || i + BATCH >= laws.length) {
      console.log('进度: ' + Math.min(i + BATCH, laws.length) + '/' + laws.length + ' (已写入 ' + updated + ')');
    }
  }

  console.log('\n=== 写入完成 ===');
  console.log('已写入: ' + updated);
  console.log('跳过(无映射): ' + skipped);

  console.log('\n=== 按效力位阶 ===');
  for (const [level, s] of Object.entries(stats).sort((a, b) => b[1].total - a[1].total)) {
    console.log(level + ': 总' + s.total + ' | 具体行业' + s.matched + ' | 归其他' + s.other);
  }

  // 4. 验证：还剩多少 null
  const remaining = await p.law.count({ where: { industryId: null } });
  console.log('\n写入后剩余 industryId=null: ' + remaining);

  await p.$disconnect();
}

main();
