/**
 * 分析 260128违法行为.xlsx 文件
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = "C:\\Users\\26371\\Documents\\Mo Obsidian\\Mo CCLearning\\2026工作相关AI生成文档\\260128违法行为.xlsx";

console.log('读取Excel文件...');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, {
  defval: '',
});

console.log(`总行数: ${data.length}`);
console.log(`工作表名: ${sheetName}`);
console.log(`列名: ${Object.keys(data[0] || {}).join(', ')}\n`);

// 显示前5行数据
console.log('===== 前5行数据 =====');
for (let i = 0; i < Math.min(5, data.length); i++) {
  const row = data[i] as any;
  console.log(`\n第 ${i + 1} 行 (序号: ${row['序号']}):`);
  console.log(`  违法行为: ${row['违法行为']?.substring(0, 50)}...`);
  console.log(`  违法依据: ${row['违法依据']?.substring(0, 100)}...`);
  console.log(`  处罚依据: ${row['处罚依据']?.substring(0, 100)}...`);
}

// 统计
let emptyCount = 0;
let validCount = 0;
let hasBothBasis = 0;

for (const row of data) {
  const r = row as any;
  const desc = r['违法行为'];
  const vBasis = r['违法依据'];
  const pBasis = r['处罚依据'];

  if (!desc || desc.trim() === '') {
    emptyCount++;
  } else {
    validCount++;
  }

  if (vBasis && vBasis.trim() !== '' && pBasis && pBasis.trim() !== '') {
    hasBothBasis++;
  }
}

console.log('\n===== 统计 =====');
console.log(`描述为空: ${emptyCount} 条`);
console.log(`描述有值: ${validCount} 条`);
console.log(`同时有违法依据和处罚依据: ${hasBothBasis} 条`);

// 分析数据格式
console.log('\n===== 数据格式分析 =====');
const sampleRow = data.find((r: any) => r['违法依据'] && r['违法依据'].trim() !== '');
if (sampleRow) {
  console.log('\n违法依据示例:');
  console.log((sampleRow as any)['违法依据']);
}

console.log('\n处罚依据示例:');
const samplePunishment = data.find((r: any) => r['处罚依据'] && r['处罚依据'].trim() !== '');
if (samplePunishment) {
  console.log((samplePunishment as any)['处罚依据']);
}
