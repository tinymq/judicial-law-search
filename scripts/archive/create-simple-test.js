const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('开始创建测试数据...\n');

  // 1. 创建法规
  const law = await prisma.law.create({
    data: {
      title: '测试企业登记管理规定(2024年)',
      issuingAuthority: '市场监管部门',
      promulgationDate: new Date('2024-01-01'),
      effectiveDate: new Date('2024-02-01'),
      status: '现行有效',
      level: '部门规章',
      category: '企业登记',
    }
  });
  console.log(`✓ 创建法规: ${law.title}\n`);

  // 2. 创建一条（有款）
  const article = await prisma.article.create({
    data: {
      lawId: law.id,
      title: '第三条',
      order: 3,
    }
  });

  // 创建款
  const paragraph = await prisma.paragraph.create({
    data: {
      articleId: article.id,
      number: 1,
      content: '企业应当在登记场所醒目位置悬挂营业执照。',
      order: 1,
    }
  });

  console.log(`✓ 创建条款: ${article.title}，第${paragraph.number}款\n`);

  // 3. 创建违法行为（到款）
  const violation = await prisma.violation.create({
    data: {
      description: '未在登记场所悬挂营业执照',
      violationBasisLawId: law.id,
      violationBasisArticleId: article.id,
      violationBasisParagraphId: paragraph.id,  // ← 关联到款
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article.id,
      punishmentBasisParagraphId: paragraph.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）及时改正\n\n【从重处罚情形】\n（一）拒不改正'
    }
  });

  console.log(`✅ 创建违法行为: ${violation.description}`);
  console.log(`✓ 关联到: ${article.title} 第${paragraph.number}款`);
  console.log(`✓ 裁量标准已添加\n`);

  // 4. 验证数据
  const v_check = await prisma.violation.findFirst({
    where: { id: violation.id },
    include: {
      violationBasisLaw: true,
      violationBasisArticle: true,
      violationBasisParagraph: true,
    }
  });

  console.log('=== 数据验证 ===');
  console.log('法规:', v_check.violationBasisLaw?.title);
  console.log('条款:', v_check.violationBasisArticle?.title);
  console.log('款ID:', v_check.violationBasisParagraphId);
  console.log('款对象:', v_check.violationBasisParagraph);
  if (v_check.violationBasisParagraph) {
    console.log('  款number:', v_check.violationBasisParagraph.number, '类型:', typeof v_check.violationBasisParagraph.number);
    console.log('  款content:', v_check.violationBasisParagraph.content?.substring(0, 20) + '...');
  }

  console.log('\n✅ 测试数据创建完成！');
  console.log('\n现在访问 http://localhost:3002/violations 查看效果');
  console.log('应该显示: 【条款项】第三条第一款');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
