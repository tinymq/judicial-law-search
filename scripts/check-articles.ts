// @ts-ignore
// @ts-ignore
import Database from 'better-sqlite3';
const db = new Database('dev.db', { readonly: true });

// 查询"工业产品生产许可证管理条例实施办法"的条款
const lawId = 43;
const articles = db.prepare(`SELECT id, title, chapter, section FROM Article WHERE lawId = ? ORDER BY id LIMIT 50`).all(lawId);

console.log('法规ID=43的条款列表（前50条）：\n');
(articles as any[]).forEach(a => {
  console.log(`  ${a.id}: ${a.title}`);
});

console.log(`\n共找到 ${articles.length} 条\n`);

// 查询"企业经营异常名录管理办法"的条款
const lawId2 = 533; // 假设的ID，需要先查询
const laws2 = db.prepare(`SELECT id, title FROM Law WHERE title LIKE '%企业经营异常名录%'`).all();

console.log('企业经营异常名录相关的法规：');
(laws2 as any[]).forEach((l: any) => {
  console.log(`  ${l.id}: ${l.title}`);
  
  const articles2 = db.prepare(`SELECT id, title FROM Article WHERE lawId = ? ORDER BY id LIMIT 20`).all(l.id);
  console.log(`    条款数量: ${articles2.length}`);
  (articles2 as any[]).slice(0, 5).forEach((a: any) => {
    console.log(`      ${a.id}: ${a.title}`);
  });
  console.log();
});

db.close();
