/**
 * 解析并导入缺失法规的违法行为
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { prisma } from '../src/lib/db';
import { parseBasisField, generateViolationCode } from '../src/lib/import/article-parser';
import { validateViolations } from '../src/lib/import/data-validator';

async function main() {
  console.log('开始处理缺失法规的违法行为...\n');
  console.log('='.repeat(80));

  // Step 1: 读取Excel
  console.log('Step 1/4: 读取Excel文件');
  console.log('-'.repeat(60));
  const filePath = "C:\\Users\\26371\\Desktop\\260128违法行为-缺失法规.xlsx";
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  console.log(`读取到 ${data.length} 条数据\n`);

  // Step 2: 解析数据
  console.log('Step 2/4: 解析结构化数据');
  console.log('-'.repeat(60));

  const violations = [];
  let errorCount = 0;

  for (const row of data) {
    try {
      const description = (row['违法行为'] || '').toString().trim();
      const violationBasisStr = (row['违法依据'] || '').toString().trim();
      const punishmentBasisStr = (row['处罚依据'] || '').toString().trim();
      const discretionStandard = (row['裁量基准'] || row['处罚建议'] || '').toString().trim();
      const punishmentSuggestion = (row['处罚建议'] || '').toString().trim();

      // 解析违法依据和处罚依据
      const violationBasis = parseBasisField(violationBasisStr);
      const punishmentBasis = parseBasisField(punishmentBasisStr);

      // 生成临时ID（使用行号）
      const id = (row as any)['行号'] || Math.floor(Math.random() * 10000);
      const code = generateViolationCode(id);

      violations.push({
        id,
        code,
        description,
        shortName: description.substring(0, 12), // 简化处理
        violationBasis,
        punishmentBasis,
        discretionStandard,
        punishmentSuggestion,
      });
    } catch (error) {
      errorCount++;
      console.error(`解析行 ${(row as any)['行号']} 失败:`, error);
    }
  }

  console.log(`解析完成: ${violations.length} 条数据`);
  if (errorCount > 0) {
    console.warn(`跳过 ${errorCount} 条无效数据`);
  }

  // 显示前3条数据示例
  console.log('\n前3条数据示例：');
  violations.slice(0, 3).forEach((v, idx) => {
    console.log(`\n${idx + 1}. [${v.code}] ${v.description.substring(0, 40)}...`);
    console.log(`   违法依据: ${v.violationBasis.length} 条`);
    console.log(`   处罚依据: ${v.punishmentBasis.length} 条`);
  });

  // Step 3: 验证数据
  console.log('\nStep 3/4: 验证数据（匹配法规和条款）');
  console.log('-'.repeat(60));
  const validationResult = await validateViolations(violations);

  // Step 4: 导入数据
  console.log('\nStep 4/4: 导入数据到数据库');
  console.log('-'.repeat(60));

  let successCount = 0;
  let errorCount2 = 0;

  for (const item of validationResult.availableData) {
    try {
      const violation = item.violation;
      const matches = item.matches;

      // 生成正确的code
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

      const code = `N${String(nextNum).padStart(3, '0')}`;

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

  if (validationResult.statistics.missingLawsCount > 0) {
    console.log(`\n⚠️  仍有 ${validationResult.statistics.missingLawsCount} 部法规缺失`);
    console.log(`⚠️  条款未匹配: ${validationResult.statistics.unmatchedArticlesCount} 条`);
  }

  await prisma.$disconnect();
}

main();
