/**
 * 分析缺失法规Excel文件
 */

import * as XLSX from 'xlsx';

const filePath = "C:\\Users\\26371\\Desktop\\260128违法行为-缺失法规.xlsx";

console.log('读取缺失法规Excel文件...\n');

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log(`工作表: ${sheetName}`);
console.log(`总行数: ${data.length}`);
console.log(`列名: ${Object.keys(data[0] || {}).join(', ')}\n`);

// 显示前5行
console.log('前5行数据：\n');
for (let i = 0; i < Math.min(5, data.length); i++) {
  const row = data[i] as any;
  console.log(`第 ${i + 1} 行:`);
  console.log(`  违法行为: ${row['违法行为']?.substring(0, 40)}...`);
  console.log(`  违法依据: ${row['违法依据']?.substring(0, 60)}...`);
  console.log(`  处罚依据: ${row['处罚依据']?.substring(0, 60)}...`);
  console.log();
}
