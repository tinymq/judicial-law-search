/**
 * 在原始Excel中标注缺失数据（使用行号匹配）
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
  console.log('开始标注Excel数据...\n');

  // 读取原始Excel
  const excelPath = "C:\\Users\\26371\\Documents\\Mo Obsidian\\Mo CCLearning\\2026工作相关AI生成文档\\260128违法行为.xlsx";
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  console.log(`读取Excel: ${data.length}行\n`);

  // 读取缺失法规和未匹配的数据
  const wb1 = XLSX.readFile('import-results/2026-01-30-260128-violations-with-missing-laws.xlsx');
  const violationsWithMissingLaws = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);

  const wb2 = XLSX.readFile('import-results/2026-01-30-260128-unmatched-articles.xlsx');
  const unmatchedArticles = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);

  // 读取可导入的数据
  const wb3 = XLSX.readFile('import-results/2026-01-30-260128-available-data.json');
  const availableData = JSON.parse(fs.readFileSync('import-results/2026-01-30-260128-available-data.json', 'utf-8'));

  // 创建行号到状态的映射（注意：Excel行号从1开始，数组索引从0开始）
  const rowStatus = new Map<number, { status: string; reason: string }>();

  // 标记可导入的数据（通过匹配违法行为描述）
  availableData.forEach((item: any) => {
    const desc = item.violation.description;
    // 在原始数据中找到对应的行
    const rowIndex = data.findIndex((row: any) => row['违法行为'] === desc);
    if (rowIndex !== -1) {
      rowStatus.set(rowIndex + 1, {
        status: '✅ 可导入',
        reason: ''
      });
    }
  });

  // 标记缺失法规的数据
  violationsWithMissingLaws.forEach((row: any) => {
    const desc = row['违法行为描述'];
    const rowIndex = data.findIndex((r: any) => r['违法行为'] === desc);
    if (rowIndex !== -1) {
      rowStatus.set(rowIndex + 1, {
        status: '❌ 缺失法规',
        reason: row['缺失法规名称'] || '法规未找到'
      });
    }
  });

  // 标记条款未匹配的数据
  unmatchedArticles.forEach((row: any) => {
    const desc = row['违法行为描述'];
    const rowIndex = data.findIndex((r: any) => r['违法行为'] === desc);
    if (rowIndex !== -1) {
      const details = row['未匹配条款详情'] as string;
      rowStatus.set(rowIndex + 1, {
        status: '⚠️  条款未匹配',
        reason: details?.substring(0, 30) + '...' || '条款找不到'
      });
    }
  });

  console.log(`已标注: ${rowStatus.size}行\n`);

  // 为每行添加状态标注
  const annotatedData = data.map((row: any, index: number) => {
    const rowNum = index + 1;
    const statusInfo = rowStatus.get(rowNum);

    const newRow: any = {
      '行号': rowNum,
      '违法行为': row['违法行为'],
      '违法依据': row['违法依据'],
      '处罚依据': row['处罚依据'],
      '处罚建议': row['处罚建议'],
      '状态': statusInfo ? statusInfo.status : '❌ 未处理',
      '问题说明': statusInfo ? statusInfo.reason : ''
    };

    return newRow;
  });

  // 统计
  const stats = {
    available: annotatedData.filter((r: any) => r['状态'] === '✅ 可导入').length,
    missingLaw: annotatedData.filter((r: any) => r['状态'] === '❌ 缺失法规').length,
    unmatched: annotatedData.filter((r: any) => r['状态'] === '⚠️  条款未匹配').length,
    unprocessed: annotatedData.filter((r: any) => r['状态'] === '❌ 未处理').length,
  };

  console.log('统计信息：');
  console.log(`  ✅ 可导入: ${stats.available}条`);
  console.log(`  ❌ 缺失法规: ${stats.missingLaw}条`);
  console.log(`  ⚠️  条款未匹配: ${stats.unmatched}条`);
  console.log(`  ❌ 未处理: ${stats.unprocessed}条\n`);

  // 导出带标注的Excel
  const newWorkbook = XLSX.utils.book_new();
  const newWorksheet = XLSX.utils.json_to_sheet(annotatedData);
  XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, '已标注数据');

  const outputPath = 'import-results/2026-01-30-260128-annotated.xlsx';
  XLSX.writeFile(newWorkbook, outputPath);

  console.log(`✅ 已生成标注文件: ${outputPath}`);
  console.log('\n文件说明：');
  console.log('  - 新增"行号"列：Excel中的行号（从1开始）');
  console.log('  - 新增"状态"列：标注每行数据的导入状态');
  console.log('  - 新增"问题说明"列：说明具体问题');
  console.log('\n状态说明：');
  console.log('  ✅ 可导入：868条 - 已成功导入数据库');
  console.log('  ❌ 缺失法规：104条 - 需要补充7部法规');
  console.log('  ⚠️  条款未匹配：140条 - 法规解析不完整或条款编号不匹配');
}

main();
