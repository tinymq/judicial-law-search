const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('开始创建三种测试情况...\n');

  // 创建测试法规
  const law = await prisma.law.create({
    data: {
      title: '测试行政处罚规定(2024年)',
      issuingAuthority: '市场监管部门',
      promulgationDate: new Date('2024-01-01'),
      effectiveDate: new Date('2024-02-01'),
      status: '现行有效',
      level: '部门规章',
      category: '综合监管',
    }
  });
  console.log(`✓ 创建测试法规: ${law.title}\n`);

  // ========== 情况1：只有单条（无款无项） ==========
  const article1 = await prisma.article.create({
    data: {
      lawId: law.id,
      title: '第五条',
      order: 5,
    }
  });

  // 对于只有单条的情况，内容存在款中
  const para1 = await prisma.paragraph.create({
    data: {
      articleId: article1.id,
      number: 1,
      content: '经营者应当在经营场所醒目位置悬挂营业执照，并保持营业执照整洁完好。',
      order: 1,
    }
  });
  console.log('✓ 创建【第五条】- 只有单条（内容在款中）\n');

  const violation1 = await prisma.violation.create({
    data: {
      description: '违法行为1：未悬挂营业执照（只到条）',
      violationBasisLawId: law.id,
      violationBasisArticleId: article1.id,
      violationBasisParagraphId: para1.id,
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article1.id,
      punishmentBasisParagraphId: para1.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）及时改正\n\n【从重处罚情形】\n（一）拒不改正'
    }
  });
  console.log('✅ 创建违法行为1（到条+款）\n');

  // ========== 情况2：多款无项 ==========
  const article2 = await prisma.article.create({
    data: {
      lawId: law.id,
      title: '第八条',
      order: 8,
    }
  });

  const para2_1 = await prisma.paragraph.create({
    data: {
      articleId: article2.id,
      number: 1,
      content: '经营者应当建立进货查验制度，查验供货者许可证和产品合格证明。',
      order: 1,
    }
  });

  const para2_2 = await prisma.paragraph.create({
    data: {
      articleId: article2.id,
      number: 2,
      content: '对无法提供许可证和合格证明的，不得进货和销售。',
      order: 2,
    }
  });

  const para2_3 = await prisma.paragraph.create({
    data: {
      articleId: article2.id,
      number: 3,
      content: '进货查验记录应当保存不少于二年。',
      order: 3,
    }
  });
  console.log('✓ 创建【第八条】- 有3款，无项\n');

  const violation2 = await prisma.violation.create({
    data: {
      description: '违法行为2：未建立进货查验制度（到款）',
      violationBasisLawId: law.id,
      violationBasisArticleId: article2.id,
      violationBasisParagraphId: para2_1.id,
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article2.id,
      punishmentBasisParagraphId: para2_1.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）首次违法\n（二）及时改正\n\n【从重处罚情形】\n（一）造成危害后果'
    }
  });
  console.log('✅ 创建违法行为2（到款）\n');

  // ========== 情况3：多款有项 ==========
  const article3 = await prisma.article.create({
    data: {
      lawId: law.id,
      title: '第十二条',
      order: 12,
    }
  });

  const para3_1 = await prisma.paragraph.create({
    data: {
      articleId: article3.id,
      number: 1,
      content: '禁止从事下列不正当竞争行为：',
      order: 1,
    }
  });

  const item3_1_1 = await prisma.item.create({
    data: {
      paragraphId: para3_1.id,
      number: '（一）',
      content: '虚假宣传，误导消费者',
      order: 1,
    }
  });

  const item3_1_2 = await prisma.item.create({
    data: {
      paragraphId: para3_1.id,
      number: '（二）',
      content: '商业诋毁，损害竞争对手声誉',
      order: 2,
    }
  });

  const item3_1_3 = await prisma.item.create({
    data: {
      paragraphId: para3_1.id,
      number: '（三）',
      content: '侵犯商业秘密',
      order: 3,
    }
  });

  const para3_2 = await prisma.paragraph.create({
    data: {
      articleId: article3.id,
      number: 2,
      content: '违反本条规定的，由市场监督管理部门责令停止违法行为，处以罚款。',
      order: 2,
    }
  });
  console.log('✓ 创建【第十二条】- 有2款，第1款有3项\n');

  const violation3 = await prisma.violation.create({
    data: {
      description: '违法行为3：虚假宣传误导消费者（到项）',
      violationBasisLawId: law.id,
      violationBasisArticleId: article3.id,
      violationBasisParagraphId: para3_1.id,
      violationBasisItemId: item3_1_1.id,
      punishmentBasisLawId: law.id,
      punishmentBasisArticleId: article3.id,
      punishmentBasisParagraphId: para3_2.id,
      sentencingGuidelines: '【从轻处罚情形】\n（一）情节轻微\n（二）主动消除影响\n\n【从重处罚情形】\n（一）造成严重后果\n（二）屡教不改'
    }
  });
  console.log('✅ 创建违法行为3（到项）\n');

  console.log('═══════════════════════════════════════');
  console.log('✅ 测试数据创建完成！');
  console.log('═══════════════════════════════════════\n');
  console.log('现在访问 http://localhost:3000/violations 查看效果：\n');
  console.log('【测试情况1】单款无项：');
  console.log('  - 违法行为1 → 应显示：第五条第一款 + 内容\n');
  console.log('【测试情况2】多款无项：');
  console.log('  - 违法行为2 → 应显示：第八条第一款 + 内容\n');
  console.log('【测试情况3】多款有项：');
  console.log('  - 违法行为3 → 应显示：第十二条第一款第（一）项 + 内容\n');
  console.log('═══════════════════════════════════════\n');
  console.log('💡 提示：数据库设计中，内容必须存在款或项中，无法直接存在"条"中');
}

main()
  .catch((e) => {
    console.error('❌ 错误:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
