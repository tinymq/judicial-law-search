/**
 * 分析剩余920条未匹配数据的组成
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

// 读取三个分类文件
const wb1 = XLSX.readFile('import-results/2026-01-30-260128-missing-laws.xlsx');
const missingLaws = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);

const wb2 = XLSX.readFile('import-results/2026-01-30-260128-violations-with-missing-laws.xlsx');
const violationsWithMissingLaws = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);

const wb3 = XLSX.readFile('import-results/2026-01-30-260128-unmatched-articles.xlsx');
const unmatchedArticles = XLSX.utils.sheet_to_json(wb3.Sheets[wb3.SheetNames[0]]);

console.log('='.repeat(80));
console.log('剩余920条数据组成分析');
console.log('='.repeat(80));

console.log('\n📊 分类统计：\n');
console.log(`1. 含缺失法规的违法行为: ${violationsWithMissingLaws.length} 条`);
console.log(`2. 条款未匹配的违法行为: ${unmatchedArticles.length} 条`);
console.log(`   总计: ${violationsWithMissingLaws.length + unmatchedArticles.length} 条\n`);

// 分析缺失法规涉及的违法行为数量
console.log('📋 缺失法规详细分析：\n');
missingLaws.forEach((law: any, i: number) => {
  console.log(`${i + 1}. ${law['法规名称']}`);
  console.log(`   涉及违法行为: ${law['涉及违法行为数量']} 条\n`);
});

// 统计缺失法规涉及的违法行为总数
const totalMissingLawViolations = (law: any) => law['涉及违法行为数量'];
const sumMissing = missingLaws.reduce((sum: number, law: any) => sum + totalMissingLawViolations(law), 0);

console.log(`\n缺失法规涉及的违法行为总数: ${sumMissing} 条`);
console.log(`条款未匹配的违法行为: ${unmatchedArticles.length} 条`);

// 进一步分析条款未匹配的原因
console.log('\n' + '='.repeat(80));
console.log('条款未匹配原因分析（前20条样本）\n');
console.log('='.repeat(80) + '\n');

let articleNotFound = 0;
let paragraphNotFound = 0;
let itemNotFound = 0;

for (let i = 0; i < Math.min(20, unmatchedArticles.length); i++) {
  const row = unmatchedArticles[i] as any;
  const details = row['未匹配条款详情'] as string;

  console.log(`${i + 1}. [${row['违法行为代码']}] ${row['违法行为描述']}`);
  console.log(`   ${details.substring(0, 150)}...`);

  // 统计原因
  if (details.includes('条款未找到')) articleNotFound++;
  if (details.includes('款未找到')) paragraphNotFound++;
  if (details.includes('项未找到')) itemNotFound++;

  console.log();
}

console.log('\n未匹配原因统计（前20条样本）：');
console.log(`  条款未找到: ${articleNotFound} 次`);
console.log(`  款未找到: ${paragraphNotFound} 次`);
console.log(`  项未找到: ${itemNotFound} 次`);

console.log('\n' + '='.repeat(80));
