const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('开始插入测试数据...\n');

  // 1. 查询现有法规
  const laws = await prisma.law.findMany({
    take: 3,
    select: {
      id: true,
      title: true,
    }
  });

  console.log('找到的法规：');
  laws.forEach(law => {
    console.log(`  ID: ${law.id}, 标题: ${law.title}`);
  });

  if (laws.length === 0) {
    console.log('\n⚠️  数据库中没有法规，请先导入法规数据！');
    return;
  }

  // 使用第一条法规
  const testLaw = laws[0];
  console.log(`\n使用法规进行测试: ${testLaw.title}`);

  // 2. 查询该法规的条款
  const articles = await prisma.article.findMany({
    where: { lawId: testLaw.id },
    take: 3,
    select: {
      id: true,
      title: true,
    }
  });

  console.log('\n找到的条款：');
  articles.forEach(article => {
    console.log(`  ID: ${article.id}, 标题: ${article.title}`);
  });

  if (articles.length === 0) {
    console.log('\n⚠️  该法规没有条款，无法创建测试数据！');
    return;
  }

  // 使用第一条条款
  const testArticle = articles[0];
  console.log(`\n使用条款进行测试: ${testArticle.title}`);

  // 3. 创建测试违法行为数据
  console.log('\n插入测试违法行为数据...');

  const violation1 = await prisma.violation.create({
    data: {
      description: '企业因连续2年未按规定报送年度报告被列入经营异常名录未改正，且通过登记的住所或者经营场所无法取得联系',
      violationBasisLawId: testLaw.id,
      violationBasisArticleId: testArticle.id,
      punishmentBasisLawId: testLaw.id,
      punishmentBasisArticleId: testArticle.id,
      sentencingGuidelines: `【从轻处罚情形】
（一）主动消除或者减轻违法行为危害后果的；
（二）受他人胁迫有违法行为的；
（三）配合查处违法行为有立功表现的；
（四）其他依法从轻处罚的。

【从重处罚情形】
（一）隐匿、销毁违法证据的；
（二）阻碍执法人员依法查处违法行为的；
（三）其他依法从重处罚的。`
    }
  });

  console.log(`✅ 创建成功: ID=${violation1.id}`);
  console.log(`   违法行为: ${violation1.description.substring(0, 30)}...`);

  const violation2 = await prisma.violation.create({
    data: {
      description: '企业未按照本条例规定的期限公示年度报告或者未按照市场监督管理部门责令的期限公示有关企业信息',
      violationBasisLawId: testLaw.id,
      violationBasisArticleId: testArticle.id,
      punishmentBasisLawId: testLaw.id,
      punishmentBasisArticleId: testArticle.id,
      sentencingGuidelines: `【从轻处罚情形】
（一）首次违法且危害后果轻微的；
（二）及时改正违法行为的。

【从重处罚情形】
（一）拒不改正的；
（二）造成严重后果的。`
    }
  });

  console.log(`✅ 创建成功: ID=${violation2.id}`);
  console.log(`   违法行为: ${violation2.description.substring(0, 30)}...`);

  console.log('\n✅ 测试数据插入完成！');
  console.log('\n现在可以访问 /violations 页面查看效果。');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
