/**
 * 违法行为Excel解析脚本
 *
 * 功能：
 * 1. 读取Excel文件（4346条违法行为）
 * 2. 解析结构化数据（【法规】...【条款项】...【内容】...）
 * 3. 匹配数据库中的法规和条款
 * 4. 生成三个列表：
 *    - 可导入数据列表（available-data.json）
 *    - 缺失法规列表（missing-laws.xlsx）
 *    - 含缺失法规的违法行为列表（violations-with-missing-laws.xlsx）
 *    - 条款未匹配的违法行为列表（unmatched-articles.xlsx）
 *
 * 使用方法：
 *   tsx scripts/parse-violation-excel.ts <Excel文件路径>
 *
 * 示例：
 *   tsx scripts/parse-violation-excel.ts "C:\...\入库版【违法行为】260130.xlsx"
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

async function main() {
  console.log('='.repeat(60));
  console.log('违法行为Excel解析工具');
  console.log('='.repeat(60));

  // 获取文件路径参数
  const excelFilePath = process.argv[2];

  if (!excelFilePath) {
    console.error('❌ 错误：请提供Excel文件路径');
    console.log('\n使用方法：');
    console.log('  tsx scripts/parse-violation-excel.ts <Excel文件路径>');
    console.log('\n示例：');
    console.log('  tsx scripts/parse-violation-excel.ts "C:\\Documents\\violations.xlsx"');
    process.exit(1);
  }

  try {
    // Step 1: 读取Excel文件
    console.log('\n📖 步骤 1/4: 读取Excel文件');
    console.log('-'.repeat(60));
    const excelData = readExcelFile(excelFilePath);

    // Step 2: 解析数据
    console.log('\n🔍 步骤 2/4: 解析结构化数据');
    console.log('-'.repeat(60));
    const violations = parseExcelData(excelData);

    if (violations.length === 0) {
      console.error('❌ 错误：未解析到任何有效数据');
      process.exit(1);
    }

    // 显示前3条数据作为示例
    console.log('\n前3条数据示例：');
    violations.slice(0, 3).forEach((v, idx) => {
      console.log(`\n${idx + 1}. [${v.code}] ${v.description}`);
      console.log(`   简称: ${v.shortName}`);
      console.log(`   违法依据: ${v.violationBasis.length} 条`);
      console.log(`   处罚依据: ${v.punishmentBasis.length} 条`);
    });

    // Step 3: 验证数据（匹配法规和条款）
    console.log('\n✅ 步骤 3/4: 验证数据（匹配法规和条款）');
    console.log('-'.repeat(60));
    const validationResult = await validateViolations(violations);

    // Step 4: 导出结果
    console.log('\n💾 步骤 4/4: 导出结果文件');
    console.log('-'.repeat(60));

    const outputDir = path.join(process.cwd(), 'import-results');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

    // 导出可导入数据列表
    const availableDataPath = path.join(outputDir, `${timestamp}-available-data.json`);
    exportToJson(validationResult.availableData, availableDataPath);

    // 导出缺失法规列表
    const missingLawsPath = path.join(outputDir, `${timestamp}-missing-laws.xlsx`);
    exportMissingLaws(validationResult.missingLaws, missingLawsPath);

    // 导出含缺失法规的违法行为列表
    const violationsWithMissingLawsPath = path.join(
      outputDir,
      `${timestamp}-violations-with-missing-laws.xlsx`
    );
    exportViolationsWithMissingLaws(
      validationResult.violationsWithMissingLaws,
      violationsWithMissingLawsPath
    );

    // 导出条款未匹配的违法行为列表
    const unmatchedArticlesPath = path.join(outputDir, `${timestamp}-unmatched-articles.xlsx`);
    exportUnmatchedArticles(validationResult.unmatchedArticles, unmatchedArticlesPath);

    // 导出统计报告
    const statisticsPath = path.join(outputDir, `${timestamp}-statistics.json`);
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

    console.log('\n💡 下一步操作建议：');
    console.log('   1. 查看 missing-laws.xlsx，将缺失的法规录入数据库');
    console.log('   2. 查看 unmatched-articles.xlsx，检查条款解析问题');
    console.log('   3. 将缺失法规录入后，重新运行此脚本');
    console.log('   4. 确认无误后，运行导入脚本将 available-data.json 导入数据库');

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ 错误：', error);
    process.exit(1);
  }
}

main();
