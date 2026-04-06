/**
 * 诊断脚本：查看Excel原始数据格式
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = process.argv[2] || "C:\\Users\\26371\\Documents\\Mo Obsidian\\Mo CCLearning\\2026工作相关AI生成文档\\入库版【违法行为】260130.xlsx";

console.log('读取Excel文件...');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, {
  defval: '',
});

console.log(`总行数: ${data.length}\n`);

// 显示前10行的列名和数据
console.log('前10行数据:');
for (let i = 0; i < Math.min(10, data.length); i++) {
  const row = data[i] as any;
  console.log(`\n===== 第 ${i + 1} 行 =====`);
  console.log('列名:', Object.keys(row));
  console.log('序号:', row['序号']);
  console.log('违法行为:', row['违法行为']);
  console.log('违法行为类型:', typeof row['违法行为']);
  console.log('违法依据:', row['违法依据']);
  console.log('违法依据类型:', typeof row['违法依据']);
  console.log('处罚依据:', row['处罚依据']);
}

// 检查有多少行的违法行为描述为空
let emptyDesc = 0;
let hasDesc = 0;
let emptyBoth = 0;
let hasBoth = 0;

for (const row of data) {
  const r = row as any;
  const desc = r['违法行为'];
  const vBasis = r['违法依据'];
  const pBasis = r['处罚依据'];

  if (!desc || (typeof desc === 'string' && desc.trim() === '')) {
    emptyDesc++;
  } else {
    hasDesc++;
  }

  if ((!vBasis || vBasis.trim() === '') && (!pBasis || pBasis.trim() === '')) {
    emptyBoth++;
  } else {
    hasBoth++;
  }
}

console.log('\n\n===== 统计 =====');
console.log(`描述为空: ${emptyDesc} 条`);
console.log(`描述有值: ${hasDesc} 条`);
console.log(`违法依据和处罚依据都为空: ${emptyBoth} 条`);
console.log(`至少有一个依据有值: ${hasBoth} 条`);

// 显示一些问题行的示例
console.log('\n===== 问题行示例 =====');
let problemCount = 0;
for (let i = 0; i < Math.min(20, data.length); i++) {
  const row = data[i] as any;
  const desc = row['违法行为'];
  const vBasis = row['违法依据'];
  const pBasis = row['处罚依据'];

  if ((!desc || desc.trim() === '') || ((!vBasis || vBasis.trim() === '') && (!pBasis || pBasis.trim() === ''))) {
    console.log(`\n第 ${i + 1} 行 (序号: ${row['序号']}):`);
    console.log(`  描述: "${desc}"`);
    console.log(`  违法依据: "${vBasis?.substring(0, 50)}..."`);
    console.log(`  处罚依据: "${pBasis?.substring(0, 50)}..."`);
    problemCount++;
    if (problemCount >= 5) break;
  }
}
