// @ts-ignore
import Database from 'better-sqlite3';
const db = new Database('dev.db', { readonly: true });

// 查询"合同行政监督管理办法"
const laws = db.prepare(`SELECT id, title FROM Law WHERE title LIKE '%合同行政监督管理办法%'`).all();
console.log('合同行政监督管理办法相关法规：');
(laws as any[]).forEach(l => {
  console.log(`  ${l.id}: ${l.title}`);
  
  // 查询条款
  const articles = db.prepare(`SELECT id, title FROM Article WHERE lawId = ? ORDER BY id LIMIT 30`).all(l.id);
  console.log(`    条款数量: ${articles.length}`);
  
  // 显示前10条
  console.log('    前10条:');
  (articles as any[]).slice(0, 10).forEach(a => {
    console.log(`      ${a.id}: ${a.title}`);
  });
});

db.close();
