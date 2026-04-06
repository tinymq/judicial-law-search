import * as XLSX from 'xlsx';

const wb = XLSX.readFile('C:/Users/26371/Documents/MLocalCoding/2026Gemini/market-law-search/import-results/2026-01-30-260128-missing-laws.xlsx');
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

console.log('缺失的7部法规：\n');
console.log('='.repeat(80));

data.forEach((row: any, i: number) => {
  console.log(`${i + 1}. ${row['法规名称']}`);
  console.log(`   涉及违法行为: ${row['涉及违法行为数量']}条`);
  console.log(`   违法行为序号: ${row['违法行为序号列表']}`);
  console.log();
});
