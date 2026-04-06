import * as XLSX from 'xlsx';

// 检查缺失法规
const wb1 = XLSX.readFile('C:/Users/26371/Documents/MLocalCoding/2026Gemini/market-law-search/import-results/2026-01-30-260128-missing-laws.xlsx');
const missingLaws = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);

console.log(`\n剩余的7部缺失法规:\n`);
missingLaws.forEach((row: any, i: number) => {
  console.log(`${i+1}. ${row['法规名称']} - ${row['涉及违法行为数量']}条`);
});

// 检查条款未匹配的情况
const wb2 = XLSX.readFile('C:/Users/26371/Documents/MLocalCoding/2026Gemini/market-law-search/import-results/2026-01-30-260128-unmatched-articles.xlsx');
const unmatched = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);

console.log(`\n条款未匹配的前10条:\n`);
for (let i = 0; i < Math.min(10, unmatched.length); i++) {
  const row = unmatched[i] as any;
  console.log(`${i+1}. [${row['违法行为代码']}] ${row['违法行为描述']}`);
  console.log(`   未匹配: ${row['未匹配数量']}条`);
  console.log(`   详情: ${(row['未匹配条款详情'] as string).substring(0, 150)}...`);
  console.log();
}

console.log(`总计: ${unmatched.length}条违法行为的条款未匹配\n`);
