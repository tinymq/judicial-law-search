const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('创建"只有单条（无款无项）"的测试数据...\n');

  // 查询现有法规
  const law = await prisma.law.findFirst({
    where: { title: { contains: '测试行政处罚规定' } }
  });

  if (!law) {
    console.log('❌ 未找到测试法规，请先运行 test-three-cases.js');
    return;
  }

  // 创建只有单条的Article（没有Paragraph和Item）
  const article = await prisma.article.create({
    data: {
      lawId: law.id,
      title: '第十五条',
      order: 15,
    }
  });
  console.log('✓ 创建【第十五条】- 只有Article，无Paragraph无Item\n');

  // 创建只关联到Article的Violation
  const violation = await prisma.violation.create({
    data: {
      description: '违法行为0：只有Article（无款无项，无内容）',
      violationBasisLawId: law.id,
      violationBasisArticleId: article.id,
      // 不关联 violationBasisParagraphId 和 violationBasisItemId
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）及时改正'
    }
  });
  console.log('✅ 创建违法行为0（只到条，无款无项）\n');

  console.log('═══════════════════════════════════════');
  console.log('⚠️  重要说明：');
  console.log('═══════════════════════════════════════\n');
  console.log('由于数据库设计，Article表没有content字段。');
  console.log('内容必须存储在Paragraph或Item表中。\n');
  console.log('因此：');
  console.log('- 【只有Article】 → 显示"第十五条" 但【无内容】');
  console.log('- 【有Article+Paragraph】 → 显示"第十五条第一款" + 内容\n');
  console.log('现在访问 http://localhost:3000/violations 查看效果');
  console.log('违法行为0会显示：【条款项】第十五条（无内容）\n');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
