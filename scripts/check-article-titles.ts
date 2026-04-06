// @ts-ignore
// @ts-ignore
// @ts-ignore
import Database from 'better-sqlite3';
const db = new Database('dev.db', { readonly: true });

console.log('检查数据库中条款标题的实际格式\n');
console.log('='.repeat(80));

// 查询合同行政监督管理办法的所有条款
const articles = db.prepare(`
  SELECT id, title
  FROM Article
  WHERE lawId = 368
  ORDER BY id
`).all();

console.log('合同行政监督管理办法(2025年修正)的条款：\n');
(articles as any[]).forEach((a: any) => {
  console.log(`  ${a.id}: "${a.title}"`);
});

console.log(`\n总计: ${(articles as any[]).length}条`);

db.close();
