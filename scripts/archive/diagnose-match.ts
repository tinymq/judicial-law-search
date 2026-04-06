// @ts-ignore
import * as XLSX from 'xlsx';
// @ts-ignore
import Database from 'better-sqlite3';

const db = new Database('dev.db', { readonly: true });

// 读取可导入的数据
const wb = XLSX.readFile('C:/Users/26371/Documents/MLocalCoding/2026Gemini/market-law-search/import-results/2026-01-30-260128-available-data.json');
const availableData = JSON.parse(wb.Sheets[wb.SheetNames[0]] as any);

console.log(`可导入数据: ${availableData.length}条\n`);

// 查看第一条成功的匹配
if (availableData.length > 0) {
  const first = availableData[0];
  console.log('第一个成功匹配的例子：');
  console.log(`  违法行为: ${first.violation.description}`);

  console.log('\n  违法依据:');
  first.matches.violationBasis.forEach((m: any) => {
    console.log(`    法规: ${m.parsedArticle.lawName}`);
    console.log(`    条款: ${m.parsedArticle.articleTitle}`);
    console.log(`    匹配: ${m.matchSuccess ? '✅' : '❌'} articleId=${m.articleId}`);
    if (m.articleId) {
      const article = db.prepare(`SELECT id, title FROM Article WHERE id = ?`).get(m.articleId) as any;
      console.log(`    数据库中: ${article ? article.title : '未找到'}`);
    }
  });
}

// 读取未匹配的数据
const wb2 = XLSX.readFile('C:/Users/26371/Documents/MLocalCoding/2026Gemini/market-law-search/import-results/2026-01-30-260128-unmatched-articles.xlsx');
const unmatched = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);

console.log(`\n\n未匹配数据: ${unmatched.length}条\n`);

// 查看第一个失败的匹配
if (unmatched.length > 0) {
  const first = unmatched[0] as any;
  console.log('第一个失败匹配的例子：');
  console.log(`  违法行为: ${first['违法行为描述']}`);
  console.log(`  详情: ${first['未匹配条款详情']}`);
}

db.close();
