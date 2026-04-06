import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testSearch(label: string, keywords: string[], domain: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试: ${label}`);
  console.log(`关键词: ${keywords.join(', ')}  领域: ${domain}`);
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

  // Score
  const scored = rawViolations.map(v => {
    const matchCount = keywords.filter(kw => v.description.includes(kw)).length;
    const matchedKws = keywords.filter(kw => v.description.includes(kw));
    return { ...v, _score: matchCount, _matchedKws: matchedKws };
  });
  scored.sort((a, b) => b._score - a._score);

  const multiMatch = scored.filter(v => v._score >= 2);
  const violations = multiMatch.length >= 3 ? multiMatch.slice(0, 15) : scored.slice(0, 15);

  console.log(`\n原始匹配: ${rawViolations.length}条, 多关键词匹配(>=2): ${multiMatch.length}条, 最终取: ${violations.length}条`);
  
  console.log('\n--- 最终结果（按相关度排序）---');
  violations.forEach((v, i) => {
    const desc = v.description.length > 60 ? v.description.slice(0, 60) + '...' : v.description;
    console.log(`${i+1}. [分数:${v._score}] ${desc}`);
    console.log(`   匹配词: ${v._matchedKws.join(', ')}`);
    console.log(`   违法依据: ${v.violationBasisLaw?.title || '无'} | 处罚依据: ${v.punishmentBasisLaw?.title || '无'}`);
  });

  // Derive laws
  const lawIds = new Set<number>();
  for (const v of violations) {
    if (v.violationBasisLaw?.id) lawIds.add(v.violationBasisLaw.id);
    if (v.punishmentBasisLaw?.id) lawIds.add(v.punishmentBasisLaw.id);
  }

  if (lawIds.size > 0) {
    const laws = await prisma.law.findMany({
      where: { id: { in: Array.from(lawIds) } },
      select: { id: true, title: true, status: true },
    });
    console.log(`\n--- 关联法规 (${laws.length}部) ---`);
    laws.forEach((l, i) => console.log(`${i+1}. ${l.title} [${l.status}]`));
  }
}

async function main() {
  // 典型案例1: 食品安全
  await testSearch('销售过期食品', ['销售', '过期', '食品', '食品安全', '经营'], '食品安全');

  // 典型案例2: 虚假广告
  await testSearch('虚假宣传广告', ['虚假', '广告', '宣传', '误导', '消费者'], '广告监管');

  // 典型案例3: 无照经营
  await testSearch('无照经营', ['无照', '经营', '营业执照', '许可证', '未取得'], '市场准入');

  // 典型案例4: 价格违法
  await testSearch('价格欺诈', ['价格', '欺诈', '标价', '哄抬', '收费'], '价格监管');

  // 典型案例5: 产品质量
  await testSearch('假冒伪劣产品', ['假冒', '伪劣', '产品', '质量', '合格'], '产品质量');

  await prisma.$disconnect();
}

main().catch(console.error);
