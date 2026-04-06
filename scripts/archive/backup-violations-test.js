const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('开始备份 Violation 测试数据...\n');

  // 查询所有违法行为（包含完整关联）
  const violations = await prisma.violation.findMany({
    include: {
      violationBasisLaw: true,
      violationBasisArticle: true,
      violationBasisParagraph: true,
      violationBasisItem: true,
      punishmentBasisLaw: true,
      punishmentBasisArticle: true,
      punishmentBasisParagraph: true,
      punishmentBasisItem: true,
    }
  });

  console.log(`找到 ${violations.length} 条违法行为记录`);

  // 导出为JSON
  const backupData = {
    exportedAt: new Date().toISOString(),
    count: violations.length,
    violations: violations.map(v => ({
      description: v.description,
      violationBasisLawId: v.violationBasisLawId,
      violationBasisArticleId: v.violationBasisArticleId,
      violationBasisParagraphId: v.violationBasisParagraphId,
      violationBasisItemId: v.violationBasisItemId,
      punishmentBasisLawId: v.punishmentBasisLawId,
      punishmentBasisArticleId: v.punishmentBasisArticleId,
      punishmentBasisParagraphId: v.punishmentBasisParagraphId,
      punishmentBasisItemId: v.punishmentBasisItemId,
      sentencingGuidelines: v.sentencingGuidelines,
      // 保存关联信息，方便验证
      _debug: {
        violationBasisLaw: v.violationBasisLaw?.title,
        violationBasisArticle: v.violationBasisArticle?.title,
        punishmentBasisLaw: v.punishmentBasisLaw?.title,
        punishmentBasisArticle: v.punishmentBasisArticle?.title,
      }
    }))
  };

  // 保存到文件
  const backupPath = path.join(__dirname, '../backups/violations-test-backup.json');
  const backupDir = path.dirname(backupPath);

  // 确保目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`\n✅ 备份完成！`);
  console.log(`备份文件：${backupPath}`);
  console.log(`备份数据：${backupData.count} 条违法行为\n`);

  // 显示简要信息
  console.log('备份的违法行为：');
  backupData.violations.forEach((v, index) => {
    console.log(`  ${index + 1}. ${v.description.substring(0, 40)}...`);
    console.log(`     违法依据：${v._debug.violationBasisLaw} - ${v._debug.violationBasisArticle}`);
    console.log(`     处罚依据：${v._debug.punishmentBasisLaw} - ${v._debug.punishmentBasisArticle}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ 备份失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
