import { PrismaClient } from '@prisma/client';
import path from 'path';

const dbPath = path.resolve(__dirname, '..', 'dev.db');
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } }
});

async function testSearch(label: string, keywords: string[], domain: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试: ${label}`);
  console.log(`关键词: ${keywords.join(', ')}`);
  console.log('='.repeat(60));

  const violationConditions = keywords.map(kw => ({
    description: { contains: kw },
  }));

  const rawViolations = await prisma.violation.findMany({
    where: { OR: violationConditions },
    select: {
      id: true,
      code: true,
      description: true,
      violationBasisLaw: { select: { id: true, title: true } },
      punishmentBasisLaw: { select: { id: true, title: true } },
    },
    take: 50,
  });

  const scored = rawViolations.map(v => {
    const matchCount = keywords.filter(kw => v.description.includes(kw)).length;
    const matchedKws = keywords.filter(kw => v.description.includes(kw));
    return { ...v, _score: matchCount, _matchedKws: matchedKws };
  });
  scored.sort((a, b) => b._score - a._score);

  const multiMatch = scored.filter(v => v._score >= 2);
  const violations = multiMatch.length >= 3 ? multiMatch.slice(0, 15) : scored.slice(0, 15);

  console.log(`原始匹配: ${rawViolations.length}条, 多关键词(>=2): ${multiMatch.length}条, 最终: ${violations.length}条`);
  
  violations.slice(0, 8).forEach((v, i) => {
    const desc = v.description.length > 70 ? v.description.slice(0, 70) + '...' : v.description;
    console.log(`${i+1}. [分数:${v._score}] ${desc}`);
    console.log(`   匹配: ${v._matchedKws.join(', ')}`);
    console.log(`   法规: ${v.violationBasisLaw?.title?.slice(0,30) || '无'}`);
  });

  // Show law derivation
  const lawIds = new Set<number>();
  for (const v of violations) {
    if (v.violationBasisLaw?.id) lawIds.add(v.violationBasisLaw.id);
    if (v.punishmentBasisLaw?.id) lawIds.add(v.punishmentBasisLaw.id);
  }
  if (lawIds.size > 0) {
    const laws = await prisma.law.findMany({
      where: { id: { in: Array.from(lawIds) } },
      select: { id: true, title: true },
    });
    console.log(`\n关联法规 (${laws.length}部):`);
    laws.forEach((l, i) => console.log(`  ${i+1}. ${l.title}`));
  }
}

async function main() {
  await testSearch('销售过期食品', ['销售', '过期', '食品', '食品安全', '经营'], '食品安全');
  await testSearch('虚假宣传广告', ['虚假', '广告', '宣传', '误导', '消费者'], '广告监管');
  await testSearch('无照经营', ['无照', '经营', '营业执照', '许可证', '未取得'], '市场准入');
  await testSearch('价格欺诈', ['价格', '欺诈', '标价', '哄抬', '收费'], '价格监管');
  await testSearch('假冒伪劣产品', ['假冒', '伪劣', '产品', '质量', '合格'], '产品质量');
  await prisma.$disconnect();
}

main().catch(console.error);
