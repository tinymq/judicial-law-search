/**
 * 导入药品违法行为Excel文件
 */

import * as XLSX from 'xlsx';
import { prisma } from '../src/lib/db';
import { parseBasisField, generateViolationCode } from '../src/lib/import/article-parser';
import { validateViolations } from '../src/lib/import/data-validator';

async function main() {
  console.log('开始导入药品违法行为文件...\n');
  console.log('='.repeat(80));

  // Step 1: 读取Excel
  console.log('Step 1/4: 读取Excel文件');
  const filePath = "C:\\Users\\26371\\Desktop\\260130违法行为-药品.xlsx";
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  console.log(`读取到 ${data.length} 条数据\n`);

  // Step 2: 解析数据
  console.log('Step 2/4: 解析结构化数据');
  const violations = [];
  let errorCount = 0;

  for (const row of data) {
    try {
      const description = (row['违法行为'] || '').toString().trim();
      const violationBasisStr = (row['违法依据'] || '').toString().trim();
      const punishmentBasisStr = (row['处罚依据'] || '').toString().trim();
      const punishmentSuggestion = (row['处罚建议'] || '').toString().trim();

      const violationBasis = parseBasisField(violationBasisStr);
      const punishmentBasis = parseBasisField(punishmentBasisStr);

      const id = (row as any)['行号'] || Math.floor(Math.random() * 10000);
      const code = generateViolationCode(id);

      violations.push({
        id,
        code,
        description,
        shortName: description.substring(0, 12),
        violationBasis,
        punishmentBasis,
        discretionStandard: '',
        punishmentSuggestion,
      });
    } catch (error) {
      errorCount++;
      console.error(`解析行 ${(row as any)['行号']} 失败:`, error);
    }
  }

  console.log(`解析完成: ${violations.length} 条数据`);

  // Step 3: 验证数据
  console.log('\nStep 3/4: 验证数据');
  const validationResult = await validateViolations(violations);

  // Step 4: 导入数据
  console.log('\nStep 4/4: 导入数据到数据库');
  let successCount = 0;
  let errorCount2 = 0;

  for (const item of validationResult.availableData) {
    try {
      const violation = item.violation;
      const matches = item.matches;

      const maxViolation = await prisma.violation.findFirst({
        orderBy: { id: 'desc' },
        select: { code: true }
      });

      let nextNum = 1;
      if (maxViolation?.code) {
        const match = maxViolation.code.match(/\d+/);
        if (match) nextNum = parseInt(match[0]) + 1;
      }

      const code = `N${String(nextNum).padStart(3, '0')}`;

      await prisma.violation.create({
        data: {
          code: code,
          description: violation.description,
          sentencingGuidelines: violation.discretionStandard || null,
          punishmentSuggestion: violation.punishmentSuggestion || null,
          violationBasisLawId: matches.violationBasis[0]?.lawId || null,
          violationBasisArticleId: matches.violationBasis[0]?.articleId || null,
          violationBasisParagraphId: matches.violationBasis[0]?.paragraphId || null,
          violationBasisItemId: matches.violationBasis[0]?.itemId || null,
          punishmentBasisLawId: matches.punishmentBasis[0]?.lawId || null,
          punishmentBasisArticleId: matches.punishmentBasis[0]?.articleId || null,
          punishmentBasisParagraphId: matches.punishmentBasis[0]?.paragraphId || null,
          punishmentBasisItemId: matches.punishmentBasis[0]?.itemId || null,
        },
      });

      successCount++;
      if (successCount % 20 === 0) {
        console.log(`  进度: ${successCount}/${validationResult.availableData.length}`);
      }
    } catch (error) {
      errorCount2++;
      console.error(`❌ 导入失败: ${error}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 导入完成！');
  console.log('='.repeat(80));
  console.log(`成功: ${successCount} 条`);
  console.log(`失败: ${errorCount2} 条`);

  console.log(`\n总计: ${validationResult.statistics.totalViolations} 条`);
  console.log(`可导入: ${validationResult.statistics.availableCount} 条 (${validationResult.statistics.successRate.toFixed(1)}%)`);
  console.log(`缺失法规: ${validationResult.statistics.missingLawsCount} 部`);
  console.log(`条款未匹配: ${validationResult.statistics.unmatchedArticlesCount} 条`);

  await prisma.$disconnect();
}

main();
