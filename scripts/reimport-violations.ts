/**
 * 删除之前的88条数据，重新导入868条
 */

import * as fs from 'fs';
import { prisma } from '../src/lib/db';

async function main() {
  console.log('开始重新导入违法行为数据...\n');

  // Step 1: 删除所有已导入的违法行为
  console.log('Step 1/3: 删除旧数据...');
  const deleteResult = await prisma.violation.deleteMany({});
  console.log(`✅ 已删除 ${deleteResult.count} 条旧数据\n`);

  // Step 2: 读取新的可导入数据
  console.log('Step 2/3: 读取新的可导入数据...');
  const availableDataPath = 'import-results/2026-01-30-260128-available-data.json';
  const availableData = JSON.parse(fs.readFileSync(availableDataPath, 'utf-8'));
  console.log(`✅ 准备导入 ${availableData.length} 条违法行为\n`);

  // Step 3: 导入数据
  console.log('Step 3/3: 导入数据...\n');
  let successCount = 0;
  let errorCount = 0;

  for (const item of availableData) {
    try {
      const violation = item.violation;
      const matches = item.matches;

      // 生成正确的code
      let code = violation.code;
      if (code === 'Nundefined' || !code || code.includes('undefined')) {
        const maxViolation = await prisma.violation.findFirst({
          orderBy: { id: 'desc' },
          select: { code: true }
        });

        let nextNum = 1;
        if (maxViolation?.code) {
          const match = maxViolation.code.match(/\d+/);
          if (match) {
            nextNum = parseInt(match[0]) + 1;
          }
        }

        code = `N${String(nextNum).padStart(3, '0')}`;
      }

      // 创建违法行为记录
      await prisma.violation.create({
        data: {
          code: code,
          description: violation.description,
          sentencingGuidelines: violation.discretionStandard || null,
          punishmentSuggestion: violation.punishmentSuggestion || null,

          // 违法依据（取第一个匹配的）
          violationBasisLawId: matches.violationBasis[0]?.lawId || null,
          violationBasisArticleId: matches.violationBasis[0]?.articleId || null,
          violationBasisParagraphId: matches.violationBasis[0]?.paragraphId || null,
          violationBasisItemId: matches.violationBasis[0]?.itemId || null,

          // 处罚依据（取第一个匹配的）
          punishmentBasisLawId: matches.punishmentBasis[0]?.lawId || null,
          punishmentBasisArticleId: matches.punishmentBasis[0]?.articleId || null,
          punishmentBasisParagraphId: matches.punishmentBasis[0]?.paragraphId || null,
          punishmentBasisItemId: matches.punishmentBasis[0]?.itemId || null,
        },
      });

      successCount++;
      if (successCount % 100 === 0) {
        console.log(`  进度: ${successCount}/${availableData.length}`);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ [${item.violation.code}] ${error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 重新导入完成！');
  console.log('='.repeat(60));
  console.log(`成功: ${successCount} 条`);
  console.log(`失败: ${errorCount} 条`);
  console.log(`成功率: ${(successCount / availableData.length * 100).toFixed(1)}%`);

  await prisma.$disconnect();
}

main();
