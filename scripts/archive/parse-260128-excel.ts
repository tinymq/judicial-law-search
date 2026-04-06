/**
 * 解析 260128违法行为.xlsx 文件
 * 适配该文件的特殊格式（用"编码"代替"序号"，没有"违法行为简称"）
 */

import * as path from 'path';
import {
  readExcelFile,
  parseExcelData,
  exportToJson,
  exportMissingLaws,
  exportViolationsWithMissingLaws,
  exportUnmatchedArticles,
} from '../src/lib/import/excel-parser';
import { validateViolations } from '../src/lib/import/data-validator';
import { parseExcelRow } from '../src/lib/import/article-parser';
import { extractShortName } from '../src/lib/import/article-parser';

/**
 * 自定义解析函数，适配260128文件格式
 */
function parseExcelRow260128(row: any) {
  try {
    // 用"编码"代替"序号"
    const id = row['编码'] || row['序号'];
    const description = (row['违法行为'] || '').toString().trim();
    const shortName = extractShortName(description); // 自动生成简称
    const violationBasisStr = (row['违法依据'] || '').toString().trim();
    const punishmentBasisStr = (row['处罚依据'] || '').toString().trim();
    const discretionStandard = (row['裁量基准'] || row['裁量标准'] || '').toString().trim(); // 兼容两个列名
    const punishmentSuggestion = (row['处罚建议'] || '').toString().trim();

    // 解析违法依据和处罚依据
    const { parseBasisField } = require('../src/lib/import/article-parser');
    const { generateViolationCode } = require('../src/lib/import/article-parser');
    const violationBasis = parseBasisField(violationBasisStr);
    const punishmentBasis = parseBasisField(punishmentBasisStr);

    // 生成编号（根据编码判断类型）
    const code = generateViolationCode(id);

    return {
      id,
      code,
      description,
      shortName,
      violationBasis,
      punishmentBasis,
      discretionStandard,
      punishmentSuggestion,
    };
  } catch (error) {
    console.error(`解析行 ${row?.['编码']} 失败:`, error);
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('260128违法行为Excel解析工具');
  console.log('='.repeat(60));

  const excelFilePath = "C:\\Users\\26371\\Documents\\Mo Obsidian\\Mo CCLearning\\2026工作相关AI生成文档\\260128违法行为.xlsx";

  try {
    // Step 1: 读取Excel文件
    console.log('\n📖 步骤 1/4: 读取Excel文件');
    console.log('-'.repeat(60));
    const excelData = readExcelFile(excelFilePath);

    // Step 2: 解析数据（使用自定义解析函数）
    console.log('\n🔍 步骤 2/4: 解析结构化数据');
    console.log('-'.repeat(60));

    const violations = [];
    let errorCount = 0;

    for (const row of excelData) {
      const parsed = parseExcelRow260128(row);
      if (parsed) {
        violations.push(parsed);
      } else {
        errorCount++;
      }
    }

    console.log(`解析完成: ${violations.length} 条数据`);
    if (errorCount > 0) {
      console.warn(`跳过 ${errorCount} 条无效数据`);
    }

    // 显示前3条数据示例
    console.log('\n前3条数据示例：');
    violations.slice(0, 3).forEach((v, idx) => {
      console.log(`\n${idx + 1}. [${v.code}] ${v.description}`);
      console.log(`   简称: ${v.shortName}`);
      console.log(`   违法依据: ${v.violationBasis.length} 条`);
      console.log(`   处罚依据: ${v.punishmentBasis.length} 条`);
    });

    // Step 3: 验证数据
    console.log('\n✅ 步骤 3/4: 验证数据（匹配法规和条款）');
    console.log('-'.repeat(60));
    const validationResult = await validateViolations(violations);

    // Step 4: 导出结果
    console.log('\n💾 步骤 4/4: 导出结果文件');
    console.log('-'.repeat(60));

    const outputDir = path.join(process.cwd(), 'import-results');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

    // 导出可导入数据列表
    const availableDataPath = path.join(outputDir, `${timestamp}-260128-available-data.json`);
    exportToJson(validationResult.availableData, availableDataPath);

    // 导出缺失法规列表
    const missingLawsPath = path.join(outputDir, `${timestamp}-260128-missing-laws.xlsx`);
    exportMissingLaws(validationResult.missingLaws, missingLawsPath);

    // 导出含缺失法规的违法行为列表
    const violationsWithMissingLawsPath = path.join(
      outputDir,
      `${timestamp}-260128-violations-with-missing-laws.xlsx`
    );
    exportViolationsWithMissingLaws(
      validationResult.violationsWithMissingLaws,
      violationsWithMissingLawsPath
    );

    // 导出条款未匹配的违法行为列表
    const unmatchedArticlesPath = path.join(outputDir, `${timestamp}-260128-unmatched-articles.xlsx`);
    exportUnmatchedArticles(validationResult.unmatchedArticles, unmatchedArticlesPath);

    // 导出统计报告
    const statisticsPath = path.join(outputDir, `${timestamp}-260128-statistics.json`);
    exportToJson(validationResult.statistics, statisticsPath);

    // 显示最终结果
    console.log('\n' + '='.repeat(60));
    console.log('✅ 解析完成！');
    console.log('='.repeat(60));
    console.log('\n📊 统计信息：');
    console.log(`   总计违法行为: ${validationResult.statistics.totalViolations} 条`);
    console.log(`   ✅ 可直接导入: ${validationResult.statistics.availableCount} 条 (${validationResult.statistics.successRate.toFixed(1)}%)`);
    console.log(`   ⚠️  缺失法规: ${validationResult.statistics.missingLawsCount} 部`);
    console.log(`   ❌ 含缺失法规的违法行为: ${validationResult.statistics.violationsWithMissingLawsCount} 条`);
    console.log(`   ⚠️  条款未匹配: ${validationResult.statistics.unmatchedArticlesCount} 条`);

    console.log('\n📁 输出文件：');
    console.log(`   ${availableDataPath}`);
    console.log(`   ${missingLawsPath}`);
    console.log(`   ${violationsWithMissingLawsPath}`);
    console.log(`   ${unmatchedArticlesPath}`);
    console.log(`   ${statisticsPath}`);

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ 错误：', error);
    process.exit(1);
  }
}

main();
