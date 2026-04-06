/**
 * 分析剩余未导入的26条数据
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
  console.log('分析剩余未导入的26条数据\n');
  console.log('='.repeat(80));

  // 读取最新的验证结果（重新运行验证）
  const filePath = "C:\\Users\\26371\\Desktop\\260128违法行为-缺失法规.xlsx";
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  console.log(`原始Excel: ${data.length}条\n`);

  // 读取未匹配数据
  const wb1 = XLSX.readFile('import-results/2026-01-30-260128-unmatched-articles.xlsx');
  const unmatchedArticles = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);

  // 从原始Excel中找出未匹配的行
  const missingDesc = new Set<string>();
  unmatchedArticles.slice(0, 30).forEach((row: any) => {
    const desc = row['违法行为描述'];
    if (desc) {
      missingDesc.add(desc.substring(0, 30)); // 用前30个字符作为key
    }
  });

  console.log('前10条未匹配的违法行为：\n');
  let count = 0;
  for (const row of data) {
    const desc = (row as any)['违法行为'];
    if (desc && missingDesc.has(desc.substring(0, 30))) {
      count++;
      console.log(`${count}. ${desc.substring(0, 50)}...`);
      console.log(`   违法依据: ${(row as any)['违法依据']?.substring(0, 60)}...`);
      console.log();
      if (count >= 10) break;
    }
  }

  console.log('\n可能的原因：');
  console.log('1. 数据库中该法规的条款解析不完整（只有条，没有款和项）');
  console.log('2. 条款编号不匹配（如Excel引用第X条，但数据库只有Y条）');
  console.log('3. 正则表达式解析边界情况');
}

main();
