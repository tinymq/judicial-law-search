/**
 * 单部法规拆解脚本
 * 用法：node scripts/extract-one-law.js <lawId>
 */

const { PrismaClient } = require('@prisma/client');
const { extractViolationsFromLaw } = require('../src/lib/ai/violation-extractor');

const prisma = new PrismaClient();

/**
 * 构建法规全文
 */
function buildLawContent(law) {
  const parts = [];

  // 序言
  if (law.preamble) {
    parts.push(law.preamble);
  }

  // 条款
  for (const article of law.articles) {
    let articleText = `第${article.title}条`;

    // 章节信息
    if (article.chapter && article.section) {
      articleText = `${article.chapter} ${article.section} ${articleText}`;
    } else if (article.chapter) {
      articleText = `${article.chapter} ${articleText}`;
    } else if (article.section) {
      articleText = `${article.section} ${articleText}`;
    }

    parts.push(articleText);

    // 款和项
    for (const para of article.paragraphs) {
      if (para.content) {
        parts.push(para.content);
      }
      for (const item of para.items) {
        parts.push(`${item.number} ${item.content}`);
      }
    }
  }

  return parts.join('\n\n');
}

/**
 * 拆解单部法规
 */
async function extractOneLaw(lawId) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 开始拆解法规 ID: ${lawId}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 1. 查询法规
  const law = await prisma.law.findUnique({
    where: { id: lawId },
    include: {
      articles: {
        orderBy: { order: 'asc' },
        include: {
          paragraphs: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      }
    }
  });

  if (!law) {
    console.log(`❌ 未找到法规 ID: ${lawId}`);
    return;
  }

  console.log(`📚 法规标题: ${law.title}`);
  console.log(`📝 条款数量: ${law.articles.length} 条`);

  // 2. 检查是否已有违法行为
  const existing = await prisma.violation.count({
    where: { violationBasisLawId: lawId }
  });

  console.log(`🔍 已有违法行为: ${existing} 条`);

  if (existing > 0) {
    console.log(`\n⚠️ 该法规已有违法行为，是否继续？`);
    console.log(`   - 如需补充，请手动确认`);
    console.log(`   - 如需重新拆解，请先删除已有数据`);
    return;
  }

  // 3. 构建法规全文
  const lawContent = buildLawContent(law);
  console.log(`📏 法规内容长度: ${lawContent.length} 字符`);

  // 4. 调用 AI 拆解
  console.log(`\n🤖 调用 AI 拆解...`);
  const startTime = Date.now();

  const result = await extractViolationsFromLaw(law.title, lawContent);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏱️ 耗时: ${elapsed} 秒\n`);

  // 5. 显示结果
  if (!result.success) {
    console.log(`❌ 拆解失败: ${result.error}`);
    return;
  }

  const violations = result.violations || [];
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ 拆解成功！`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  console.log(`📊 违法行为数量: ${violations.length} 条`);
  console.log(`📈 覆盖率: ${((violations.length / law.articles.length) * 100).toFixed(1)}%\n`);

  // 6. 显示前10条
  console.log(`前10条违法行为：\n`);
  violations.slice(0, 10).forEach((v, i) => {
    console.log(`${i + 1}. ${v.description}`);
    console.log(`   违法依据: ${v.violationArticleTitle}`);
    console.log(`   处罚依据: ${v.punishmentArticleTitle}\n`);
  });

  // 7. 保存到数据库
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`💾 是否保存到数据库？`);
  console.log(`   - 请人工审核上述结果`);
  console.log(`   - 确认无误后，运行保存脚本`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // 8. 保存结果到临时文件
  const fs = require('fs');
  const tempFile = `/tmp/violations-${lawId}.json`;
  fs.writeFileSync(tempFile, JSON.stringify({
    lawId,
    lawTitle: law.title,
    extractedAt: new Date().toISOString(),
    violations
  }, null, 2));

  console.log(`✅ 结果已保存到: ${tempFile}`);
  console.log(`\n下一步：`);
  console.log(`1. 审核上述结果`);
  console.log(`2. 如果满意，运行: node scripts/save-violations.js ${lawId}`);
  console.log(`3. 如果不满意，调整 Prompt 后重新拆解`);
}

// 获取命令行参数
const lawId = parseInt(process.argv[2]);

if (!lawId) {
  console.log(`用法: node scripts/extract-one-law.js <lawId>`);
  console.log(`\n示例：`);
  console.log(`  node scripts/extract-one-law.js 162  # 疫苗管理法`);
  process.exit(1);
}

// 执行
extractOneLaw(lawId)
  .catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
