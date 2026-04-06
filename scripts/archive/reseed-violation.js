const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('开始重新插入测试数据...\n');

  // 1. 删除旧的测试数据
  console.log('删除旧的测试数据...');
  await prisma.violation.deleteMany({});
  console.log('✓ 旧数据已删除\n');

  // 2. 查询现有法规和条款
  const laws = await prisma.law.findMany({
    take: 1,
    select: {
      id: true,
      title: true,
    }
  });

  if (laws.length === 0) {
    console.log('⚠️  数据库中没有法规！');
    return;
  }

  const testLaw = laws[0];
  console.log(`使用法规: ${testLaw.title}\n`);

  // 3. 查询该法规的条款和款项
  const articles = await prisma.article.findMany({
    where: { lawId: testLaw.id },
    take: 2,
    include: {
      paragraphs: {
        include: {
          items: true
        }
      }
    }
  });

  if (articles.length === 0) {
    console.log('⚠️  该法规没有条款！');
    return;
  }

  console.log('找到的条款结构：');
  articles.forEach((article, index) => {
    console.log(`  ${index + 1}. ${article.title}`);
    if (article.paragraphs.length > 0) {
      article.paragraphs.forEach((para, pIndex) => {
        console.log(`     - 第${para.number}款 ${para.content ? '(有内容)' : ''}`);
        if (para.items.length > 0) {
          para.items.forEach((item, iIndex) => {
            console.log(`       - ${item.number} ${item.content.substring(0, 20)}...`);
          });
        }
      });
    }
  });

  // 4. 插入测试数据 - 不同粒度的关联

  // 测试数据1：只到"条"级别
  if (articles.length > 0) {
    const article1 = articles[0];
    const violation1 = await prisma.violation.create({
      data: {
        description: '公司股东会、董事会决议不成立',
        violationBasisLawId: testLaw.id,
        violationBasisArticleId: article1.id,
        punishmentBasisLawId: testLaw.id,
        punishmentBasisArticleId: article1.id,
        sentencingGuidelines: `【从轻处罚情形】
（一）主动消除或者减轻违法行为危害后果的；
（二）及时改正违法行为的。

【从重处罚情形】
（一）拒不改正的；
（二）造成严重后果的。`
      }
    });
    console.log(`\n✅ 创建测试数据1（只到条）: ID=${violation1.id}`);
    console.log(`   条款编号: ${article1.title}`);
  }

  // 测试数据2：到"款"级别
  if (articles.length > 0 && articles[0].paragraphs.length > 0) {
    const article2 = articles[0];
    const paragraph2 = article2.paragraphs[0];

    const violation2 = await prisma.violation.create({
      data: {
        description: '企业未按照本条例规定的期限公示年度报告',
        violationBasisLawId: testLaw.id,
        violationBasisArticleId: article2.id,
        violationBasisParagraphId: paragraph2.id,
        punishmentBasisLawId: testLaw.id,
        punishmentBasisArticleId: article2.id,
        punishmentBasisParagraphId: paragraph2.id,
        sentencingGuidelines: `【从轻处罚情形】
（一）首次违法且危害后果轻微的；
（二）积极配合调查的。

【从重处罚情形】
（一）拒不改正的；
（二）隐瞒真实情况的。`
      }
    });
    console.log(`\n✅ 创建测试数据2（到款）: ID=${violation2.id}`);
    console.log(`   条款编号: ${article2.title} 第${paragraph2.number}款`);
  }

  // 测试数据3：到"项"级别
  if (articles.length > 0 && articles[0].paragraphs.length > 0 && articles[0].paragraphs[0].items.length > 0) {
    const article3 = articles[0];
    const paragraph3 = article3.paragraphs[0];
    const item3 = paragraph3.items[0];

    const violation3 = await prisma.violation.create({
      data: {
        description: '隐匿、销毁违法证据',
        violationBasisLawId: testLaw.id,
        violationBasisArticleId: article3.id,
        violationBasisParagraphId: paragraph3.id,
        violationBasisItemId: item3.id,
        punishmentBasisLawId: testLaw.id,
        punishmentBasisArticleId: article3.id,
        punishmentBasisParagraphId: paragraph3.id,
        punishmentBasisItemId: item3.id,
        sentencingGuidelines: `【从轻处罚情形】
（一）主动消除违法行为的。

【从重处罚情形】
（一）造成严重后果的；
（二）拒不配合调查的。`
      }
    });
    console.log(`\n✅ 创建测试数据3（到项）: ID=${violation3.id}`);
    console.log(`   条款编号: ${article3.title} 第${paragraph3.number}款 ${item3.number}`);
  }

  console.log('\n✅ 测试数据插入完成！');
  console.log('\n现在访问 /violations 页面，应该能看到不同粒度的法条显示。');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
