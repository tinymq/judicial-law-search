import * as XLSX from 'xlsx';

const wb = XLSX.readFile('C:/Users/26371/Documents/Mo Obsidian/Mo CCLearning/2026工作相关AI生成文档/260128违法行为.xlsx');
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

console.log('列名:', Object.keys(data[0] || {}));
console.log('\n前3行数据:');
for (let i = 0; i < Math.min(3, data.length); i++) {
  console.log(`\n行${i + 1}:`);
  const row = data[i] as any;
  Object.keys(row).forEach(key => {
    console.log(`  ${key}: ${row[key]}`);
  });
}
