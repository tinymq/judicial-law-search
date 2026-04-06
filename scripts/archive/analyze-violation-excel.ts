import xlsx from 'xlsx';
import fs from 'fs';

const excelPath = 'C:\\Users\\26371\\Documents\\Mo Obsidian\\Mo CCLearning\\2026工作相关AI生成文档\\入库版【违法行为】260130.xlsx';

console.log('读取Excel文件:', excelPath);

try {
  const workbook = xlsx.readFile(excelPath);
  const sheetNames = workbook.SheetNames;

  console.log('\n工作表列表:', sheetNames);

  sheetNames.forEach((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`\n========================================`);
    console.log(`工作表 ${index + 1}: ${sheetName}`);
    console.log(`总行数: ${data.length}`);
    console.log(`========================================`);

    // 显示前10行
    console.log('\n前10行数据:');
    const preview = data.slice(0, 10);
    preview.forEach((row, i) => {
      console.log(`\n第${i + 1}行:`);
      console.log(JSON.stringify(row, null, 2));
    });

    // 如果数据超过10行，显示最后几行
    if (data.length > 10) {
      console.log('\n...');
      console.log(`\n最后5行数据:`);
      const tail = data.slice(-5);
      tail.forEach((row, i) => {
        console.log(`\n第${data.length - 5 + i + 1}行:`);
        console.log(JSON.stringify(row, null, 2));
      });
    }

    // 分析列名（第一行）
    if (data.length > 0) {
      console.log('\n列名分析:');
      const headers = data[0] as any;
      headers.forEach((header: any, i: number) => {
        console.log(`  列${i + 1}: "${header}"`);
      });
    }
  });

} catch (error) {
  console.error('读取失败:', error);
}
