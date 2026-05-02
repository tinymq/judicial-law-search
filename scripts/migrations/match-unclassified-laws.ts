/**
 * 全量自动匹配：为无分类的法规自动关联 Industry
 * 使用 industry-keywords.ts 的关键词匹配引擎
 *
 * 用法: npx tsx scripts/migrations/match-unclassified-laws.ts
 */
import { PrismaClient } from '@prisma/client';
import { matchIndustries } from '../../src/lib/industry-keywords';

const prisma = new PrismaClient();

async function main() {
  // 获取所有无分类法规
  const laws = await prisma.law.findMany({
    where: {
      category: '综合监管',
      industryId: null,
    },
    select: { id: true, title: true, issuingAuthority: true },
  });

  console.log(`待匹配法规: ${laws.length} 条`);

  // 预加载 Industry code → id
  const industries = await prisma.industry.findMany({ select: { id: true, code: true } });
  const codeToId = new Map(industries.map(i => [i.code, i.id]));

  let matched = 0;
  let unmatched = 0;
  const stats: Record<string, number> = {};
  const BATCH_SIZE = 100;

  for (let i = 0; i < laws.length; i += BATCH_SIZE) {
    const batch = laws.slice(i, i + BATCH_SIZE);

    for (const law of batch) {
      const results = matchIndustries(law.title, law.issuingAuthority);

      if (results.length === 0 || (results.length === 1 && results[0].code === '99')) {
        unmatched++;
        continue;
      }

      const primaryMatch = results[0];
      const primaryIndustryId = codeToId.get(primaryMatch.code);

      if (!primaryIndustryId) {
        unmatched++;
        continue;
      }

      // 更新 Law.industryId
      await prisma.law.update({
        where: { id: law.id },
        data: { industryId: primaryIndustryId },
      });

      // 创建 LawIndustry 记录（所有匹配结果）
      for (const result of results) {
        const indId = codeToId.get(result.code);
        if (!indId) continue;

        await prisma.lawIndustry.upsert({
          where: { lawId_industryId: { lawId: law.id, industryId: indId } },
          update: { isPrimary: result.isPrimary },
          create: {
            lawId: law.id,
            industryId: indId,
            isPrimary: result.isPrimary,
          },
        });
      }

      stats[primaryMatch.code] = (stats[primaryMatch.code] || 0) + 1;
      matched++;
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= laws.length) {
      console.log(`进度: ${Math.min(i + BATCH_SIZE, laws.length)}/${laws.length} (匹配: ${matched}, 未匹配: ${unmatched})`);
    }
  }

  // 输出统计
  console.log(`\n完成: 匹配 ${matched} 条, 未匹配 ${unmatched} 条`);
  console.log('\n按一级领域统计 (Top 15):');
  const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [code, count] of sorted) {
    const ind = industries.find(i => i.code === code);
    console.log(`  ${code} ${ind ? '' : '?'}: ${count}`);
  }

  const totalLI = await prisma.lawIndustry.count();
  console.log(`\nLawIndustry 总记录数: ${totalLI}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
