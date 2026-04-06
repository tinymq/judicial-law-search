/**
 * 诊断法规匹配问题
 */

import * as XLSX from 'xlsx';
import { prisma } from '@/src/lib/db';

async function main() {
  console.log('开始诊断匹配问题...\n');

  // 读取Excel
  const excelPath = 'C:/Users/26371/Documents/MLocalCoding/2026Gemini/market-law-search/import-results/2026-01-30-260128-missing-laws.xlsx';
  const wb = XLSX.readFile(excelPath);
  const missingLaws = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  console.log(`缺失法规数量: ${missingLaws.length}\n`);

  // 检查前10部缺失法规
  console.log('='.repeat(80));
  console.log('检查前10部"缺失"法规在数据库中的实际情况：\n');

  for (let i = 0; i < Math.min(10, missingLaws.length); i++) {
    const row = missingLaws[i] as any;
    const lawNameFromExcel = row['法规名称'];

    console.log(`${i + 1}. Excel中的名称: "${lawNameFromExcel}"`);

    // 尝试多种匹配方式
    const exactMatch = await prisma.law.findFirst({
      where: { title: lawNameFromExcel },
      select: { id: true, title: true }
    });

    if (exactMatch) {
      console.log(`   ✅ 精确匹配成功: "${exactMatch.title}"`);
    } else {
      console.log(`   ❌ 精确匹配失败`);

      // 尝试去除括号和年份后匹配
      const cleanName = lawNameFromExcel
        .replace(/[（\(][^））]*[））]/g, '')
        .replace(/《|》/g, '')
        .trim();

      console.log(`   🔍 清理后的名称: "${cleanName}"`);

      const cleanMatch = await prisma.law.findFirst({
        where: {
          title: {
            contains: cleanName
          }
        },
        select: { id: true, title: true },
        take: 3
      });

      if (cleanMatch && (cleanMatch as any).length > 0) {
        console.log(`   ✅ 包含匹配成功，找到 ${(cleanMatch as any).length} 个:`);
        (cleanMatch as any).forEach((l: any) => console.log(`      -> "${l.title}"`));
      } else {
        console.log(`   ❌ 包含匹配也失败`);
      }
    }
    console.log();
  }

  console.log('='.repeat(80));

  await prisma.$disconnect();
}

main();
