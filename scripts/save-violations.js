/**
 * 保存违法行为到数据库
 * 用法：node scripts/save-violations.js <lawId>
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function saveViolations(lawId) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`💾 保存违法行为到数据库`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 1. 读取临时文件
  const tempFile = `/tmp/violations-${lawId}.json`;

  if (!fs.existsSync(tempFile)) {
    console.log(`❌ 未找到临时文件: ${tempFile}`);
    console.log(`   请先运行拆解脚本: node scripts/extract-one-law.js ${lawId}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));
  console.log(`📚 法规: ${data.lawTitle}`);
  console.log(`📊 违法行为数量: ${data.violations.length} 条\n`);

  // 2. 匹配条款 ID
  console.log(`🔍 匹配条款 ID...`);

  for (const v of data.violations) {
    // 查询违法依据条款
    const violationArticle = await prisma.article.findFirst({
      where: {
        lawId: lawId,
        title: v.violationArticleTitle?.replace(/^第/, '').replace(/条$/, '').trim()
      }
    });

    // 查询处罚依据条款
    const punishmentArticle = await prisma.article.findFirst({
      where: {
        lawId: lawId,
        title: v.punishmentArticleTitle?.replace(/^第/, '').replace(/条$/, '').trim()
      }
    });

    // 保存到数据库
    await prisma.violation.create({
      data: {
        description: v.description,
        violationBasisLawId: lawId,
        violationBasisArticleId: violationArticle?.id || null,
        punishmentBasisLawId: lawId,
        punishmentBasisArticleId: punishmentArticle?.id || null,
        sentencingGuidelines: v.sentencingGuidelines || null
      }
    });
  }

  console.log(`✅ 已保存 ${data.violations.length} 条违法行为\n`);

  // 3. 删除临时文件
  fs.unlinkSync(tempFile);
  console.log(`🗑️ 已删除临时文件\n`);

  // 4. 显示统计
  const total = await prisma.violation.count({
    where: { violationBasisLawId: lawId }
  });

  const articles = await prisma.article.count({
    where: { lawId: lawId }
  });

  const coverage = ((total / articles) * 100).toFixed(1);

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 统计：`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`  违法行为: ${total} 条`);
  console.log(`  条款数量: ${articles} 条`);
  console.log(`  覆盖率: ${coverage}%\n`);

  console.log(`✅ 完成！\n`);
}

// 获取命令行参数
const lawId = parseInt(process.argv[2]);

if (!lawId) {
  console.log(`用法: node scripts/save-violations.js <lawId>`);
  process.exit(1);
}

// 执行
saveViolations(lawId)
  .catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
