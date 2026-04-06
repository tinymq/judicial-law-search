import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = 'C:/Users/26371/Documents/MLocalCoding/2026Gemini/market-law-search/import-results/2026-01-30-260128-missing-laws.xlsx';

const wb = XLSX.readFile(filePath);
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

console.log(`\n📊 缺失法规统计: 共${data.length}部\n`);
console.log('='.repeat(80));

// 按涉及违法行为数量排序
data.sort((a: any, b: any) => b['涉及违法行为数量'] - a['涉及违法行为数量']);

console.log('\n📋 全部缺失法规列表（按涉及违法行为数量排序）：\n');
for (let i = 0; i < data.length; i++) {
  const row = data[i] as any;
  const num = row['涉及违法行为数量'];
  const name = row['法规名称'];
  console.log(`${i + 1}. [${num}条] ${name}`);
}

console.log('\n' + '='.repeat(80));

// 统计
const majorLaws = data.filter((r: any) => r['涉及违法行为数量'] >= 10);
const totalViolations = data.reduce((sum: number, r: any) => sum + r['涉及违法行为数量'], 0);

console.log(`\n📈 统计摘要：`);
console.log(`   缺失法规总数: ${data.length}部`);
console.log(`   涉及违法行为总数: ${totalViolations}条`);
console.log(`   重点法规（≥10条）: ${majorLaws.length}部`);
console.log(`   平均每部法规涉及: ${(totalViolations / data.length).toFixed(1)}条违法行为`);
