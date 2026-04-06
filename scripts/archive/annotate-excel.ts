/**
 * 在原始Excel中标注缺失数据
 * 创建一个带状态列的新Excel文件
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

  // 创建缺失数据的编码集合（Excel中的编码列）
  const missingCodes = new Set<string>();

  violationsWithMissingLaws.forEach((row: any) => {
    const code = row['违法行为代码'];
    if (code && !code.includes('undefined')) {
      missingCodes.add(code);
    }
  });

  unmatchedArticles.forEach((row: any) => {
    const code = row['违法行为代码'];
    if (code && !code.includes('undefined')) {
      missingCodes.add(code);
    }
  });

  console.log(`缺失数据: ${missingCodes.size}条\n`);

  // 为每行添加状态标注
  const annotatedData = data.map((row: any) => {
    const code = row['编码']; // Excel中的列名是"编码"不是"序号"
    const newRow: any = { ...row };

    // 判断状态
    if (missingCodes.has(code) || (typeof code === 'undefined')) {
      // 检查是哪种缺失
      const violationMissing: any = violationsWithMissingLaws.find((r: any) => r['违法行为代码'] === code);
      const articleUnmatched: any = unmatchedArticles.find((r: any) => r['违法行为代码'] === code);

      if (violationMissing) {
        newRow['状态'] = '❌ 缺失法规';
        newRow['缺失原因'] = violationMissing['缺失法规名称'];
      } else if (articleUnmatched) {
        newRow['状态'] = '⚠️  条款未匹配';
        newRow['缺失原因'] = articleUnmatched['未匹配条款详情']?.substring(0, 50) + '...';
      } else {
        newRow['状态'] = '❌ 编码无效';
        newRow['缺失原因'] = '编码列未定义';
      }
    } else {
      newRow['状态'] = '✅ 可导入';
      newRow['缺失原因'] = '';
    }

    return newRow;
  });

  // 统计
  const stats = {
    available: annotatedData.filter((r: any) => r['状态'] === '✅ 可导入').length,
    missingLaw: annotatedData.filter((r: any) => r['状态'] === '❌ 缺失法规').length,
    unmatched: annotatedData.filter((r: any) => r['状态'] === '⚠️  条款未匹配').length,
    invalid: annotatedData.filter((r: any) => r['状态'] === '❌ 编码无效').length,
  };

  console.log('统计信息：');
  console.log(`  ✅ 可导入: ${stats.available}条`);
  console.log(`  ❌ 缺失法规: ${stats.missingLaw}条`);
  console.log(`  ⚠️  条款未匹配: ${stats.unmatched}条`);
  console.log(`  ❌ 编码无效: ${stats.invalid}条\n`);

  // 导出带标注的Excel
  const newWorkbook = XLSX.utils.book_new();
  const newWorksheet = XLSX.utils.json_to_sheet(annotatedData);
  XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, '已标注数据');

  const outputPath = 'import-results/2026-01-30-260128-annotated.xlsx';
  XLSX.writeFile(newWorkbook, outputPath);

  console.log(`✅ 已生成标注文件: ${outputPath}`);
  console.log('\n文件说明：');
  console.log('  - 新增"状态"列：标注每行数据的导入状态');
  console.log('  - 新增"缺失原因"列：说明具体问题');
  console.log('  - ✅ 可导入：868条');
  console.log('  - ❌ 缺失法规：104条');
  console.log('  - ⚠️  条款未匹配：140条');
}

main();
