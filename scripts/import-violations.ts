/**
 * 导入违法行为数据到数据库
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/src/lib/db';

async function main() {
  console.log('开始导入违法行为数据...\n');

  // 读取可导入数据
  const availableDataPath = 'import-results/2026-01-30-260128-available-data.json';
  const availableData = JSON.parse(fs.readFileSync(availableDataPath, 'utf-8'));

  console.log(`准备导入 ${availableData.length} 条违法行为\n`);

  let successCount = 0;
  let errorCount = 0;
  let counter = 1;

  for (const item of availableData) {
    try {
      const violation = item.violation;
      const matches = item.matches;

      // 生成正确的code（如果原code是undefined）
      let code = violation.code;
      if (code === 'Nundefined' || !code || code.includes('undefined')) {
        // 查询已有最大code
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
      console.log(`✅ [${code}] ${violation.shortName}`);
    } catch (error) {
      errorCount++;
      console.error(`❌ [${item.violation.code}] ${error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('导入完成！');
  console.log('='.repeat(60));
  console.log(`成功: ${successCount} 条`);
  console.log(`失败: ${errorCount} 条`);

  await prisma.$disconnect();
}

main();
