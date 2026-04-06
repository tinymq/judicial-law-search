const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('开始创建测试数据...\n');

  // 创建测试法规
  const law = await prisma.law.create({
    data: {
      title: '测试行政法规(2024年修订)',
      issuingAuthority: '测试部门',
      promulgationDate: new Date('2024-01-01'),
      effectiveDate: new Date('2024-02-01'),
      status: '现行有效',
      level: '部门规章',
      category: '综合监管',
    }
  });
  console.log(`✓ 创建测试法规: ${law.title}\n`);

  // 创建条款1（有多个款，每个款有多个项）
  const article1 = await prisma.article.create({
    data: {
      lawId: law.id,
      title: '第一条',
      order: 1,
    }
  });

  const para1_1 = await prisma.paragraph.create({
    data: {
      articleId: article1.id,
      number: 1,
      content: '为了规范市场秩序，保护经营者合法权益，维护公平竞争的市场环境，制定本规定。',
      order: 1,
    }
  });

  const item1_1_1 = await prisma.item.create({
    data: {
      paragraphId: para1_1.id,
      number: '（一）',
      content: '遵守法律法规，恪守职业道德',
      order: 1,
    }
  });

  const item1_1_2 = await prisma.item.create({
    data: {
      paragraphId: para1_1.id,
      number: '（二）',
      content: '诚实守信，文明经营',
      order: 2,
    }
  });

  const para1_2 = await prisma.paragraph.create({
    data: {
      articleId: article1.id,
      number: 2,
      content: '经营者应当依法取得营业执照，并在经营场所醒目位置悬挂营业执照。',
      order: 2,
    }
  });

  console.log('  ✓ 第一条：第1款（2项），第2款\n');

  // 创建条款2（只有款，没有项）
  const article2 = await prisma.article.create({
    data: {
      lawId: law.id,
      title: '第二条',
      order: 2,
    }
  });

  const para2_1 = await prisma.paragraph.create({
    data: {
      articleId: article2.id,
      number: 1,
      content: '违反本规定，由市场监督管理部门责令改正，处以罚款。',
      order: 1,
    }
  });

  console.log('  ✓ 第二条：第1款\n');

  // 创建违法行为1（只到条）
  const v1 = await prisma.violation.create({
    data: {
      description: '违法行为1：未依法取得营业执照从事经营活动',
      violationBasisLawId: law.id,
      violationBasisArticleId: article2.id,
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article2.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）首次违法且危害后果轻微\n\n【从重处罚情形】\n（一）拒不改正'
    }
  });
  console.log(`✅ 创建违法行为1（到条）：${article2.title}\n`);

  // 创建违法行为2（到款）
  const v2 = await prisma.violation.create({
    data: {
      description: '违法行为2：未在经营场所悬挂营业执照',
      violationBasisLawId: law.id,
      violationBasisArticleId: article2.id,
      violationBasisParagraphId: para2_1.id,
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article2.id,
      punishmentBasisParagraphId: para2_1.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）及时改正\n\n【从重处罚情形】\n（一）拒不改正'
    }
  });
  console.log(`✅ 创建违法行为2（到款）：${article2.title}第一款\n`);

  // 创建违法行为3（到项）
  const v3 = await prisma.violation.create({
    data: {
      description: '违法行为3：违反职业道德规范',
      violationBasisLawId: law.id,
      violationBasisArticleId: article1.id,
      violationBasisParagraphId: para1_1.id,
      violationBasisItemId: item1_1_1.id,
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article1.id,
      punishmentBasisParagraphId: para1_1.id,
      punishmentBasisItemId: item1_1_1.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）情节轻微\n\n【从重处罚情形】\n（一）造成严重后果'
    }
  });
  console.log(`✅ 创建违法行为3（到项）：${article1.title}第一款${item1_1_1.number}\n`);

  console.log('✅ 测试数据创建完成！');
  console.log('\n现在访问 http://localhost:3001/violations 查看效果：');
  console.log('- 违法行为1：只到条（无内容）');
  console.log('- 违法行为2：到款（有内容）');
  console.log('- 违法行为3：到项（有内容）');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
