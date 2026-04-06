/**
 * 分析药品违法行为Excel文件
 */

import * as XLSX from 'xlsx';

const filePath = "C:\\Users\\26371\\Desktop\\260130违法行为-药品.xlsx";

console.log('读取药品违法行为Excel文件...\n');

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
  console.log(`  违法行为: ${row['违法行为']?.substring(0, 50)}...`);
  console.log(`  违法依据: ${row['违法依据']?.substring(0, 80)}...`);
  console.log(`  处罚依据: ${row['处罚依据']?.substring(0, 80)}...`);
  console.log();
}

// 统计
console.log('\n统计信息：');
const emptyDesc = data.filter((r: any) => !r['违法行为'] || r['违法行为'].trim() === '').length;
const hasDesc = data.filter((r: any) => r['违法行为'] && r['违法行为'].trim() !== '').length;
const hasBothBasis = data.filter((r: any) => {
  const vBasis = r['违法依据'];
  const pBasis = r['处罚依据'];
  return vBasis && vBasis.trim() !== '' && pBasis && pBasis.trim() !== '';
}).length;

console.log(`  描述为空: ${emptyDesc} 条`);
console.log(`  描述有值: ${hasDesc} 条`);
console.log(`  同时有违法依据和处罚依据: ${hasBothBasis} 条`);
