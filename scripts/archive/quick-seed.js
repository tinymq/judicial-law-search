const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('开始插入简化测试数据...\n');

  // 1. 创建一个测试法规
  const law = await prisma.law.create({
    data: {
      title: '测试法规(2024年修订)',
      issuingAuthority: '测试机关',
      promulgationDate: new Date('2024-01-01'),
      effectiveDate: new Date('2024-02-01'),
      status: '现行有效',
      level: '部门规章',
      category: '综合监管',
    }
  });
  console.log(`✓ 创建测试法规: ID=${law.id}, ${law.title}`);

  // 2. 创建条款（带章节结构）
  const article1 = await prisma.article.create({
    data: {
      lawId: law.id,
      chapter: '第一章',
      section: '总则',
      title: '第一条',
      order: 1,
    }
  });
  console.log(`✓ 创建条款: ${article1.chapter} ${article1.section} ${article1.title}`);

  // 3. 创建款
  const paragraph1 = await prisma.paragraph.create({
    data: {
      articleId: article1.id,
      number: 1,
      content: '为了规范行政管理，维护市场秩序，保护当事人合法权益，根据有关法律，制定本规定。',
      order: 1,
    }
  });
  console.log(`✓ 创建款: 第${paragraph1.number}款`);

  // 4. 创建项
  const item1 = await prisma.item.create({
    data: {
      paragraphId: paragraph1.id,
      number: '（一）',
      content: '遵守法律、法规，恪守职业道德',
      order: 1,
    }
  });
  console.log(`✓ 创建项: ${item1.number}`);

  const item2 = await prisma.item.create({
    data: {
      paragraphId: paragraph1.id,
      number: '（二）',
      content: '诚实守信，勤勉尽责',
      order: 2,
    }
  });
  console.log(`✓ 创建项: ${item2.number}`);

  // 5. 创建违法行为测试数据

  // 测试1：只到条
  const v1 = await prisma.violation.create({
    data: {
      description: '违反行政管理规定',
      violationBasisLawId: law.id,
      violationBasisArticleId: article1.id,
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article1.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）主动改正的\n\n【从重处罚情形】\n（一）拒不改正的',
    }
  });
  console.log(`\n✅ 创建违法行为1（到条）: ${article1.title}`);

  // 测试2：到款
  const v2 = await prisma.violation.create({
    data: {
      description: '未按规定履行职责',
      violationBasisLawId: law.id,
      violationBasisArticleId: article1.id,
      violationBasisParagraphId: paragraph1.id,
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article1.id,
      punishmentBasisParagraphId: paragraph1.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）及时补救的\n\n【从重处罚情形】\n（一）造成严重后果的',
    }
  });
  console.log(`✅ 创建违法行为2（到款）: ${article1.title}第${paragraph1.number}款`);

  // 测试3：到项
  const v3 = await prisma.violation.create({
    data: {
      description: '违反职业道德规范',
      violationBasisLawId: law.id,
      violationBasisArticleId: article1.id,
      violationBasisParagraphId: paragraph1.id,
      violationBasisItemId: item1.id,
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article1.id,
      punishmentBasisParagraphId: paragraph1.id,
      punishmentBasisItemId: item1.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）情节轻微的\n\n【从重处罚情形】\n（一）情节严重的',
    }
  });
  console.log(`✅ 创建违法行为3（到项）: ${article1.title}第${paragraph1.number}款${item1.number}`);

  console.log('\n✅ 所有测试数据创建完成！');
  console.log('\n现在可以访问 http://localhost:3000/violations 查看效果');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
