// @ts-ignore - better-sqlite3 types not available
import Database from 'better-sqlite3';
const db = new Database('dev.db', { readonly: true });

console.log('检查3部法规的条款解析情况\n');
console.log('='.repeat(80));

// 检查药品网络销售监督管理办法
console.log('\n1. 药品网络销售监督管理办法\n');
console.log('-'.repeat(60));
const law1 = db.prepare(`SELECT id, title FROM Law WHERE title LIKE '%药品网络销售监督管理办法%'`).all();
(law1 as any[]).forEach(l => {
  console.log(`法规ID: ${l.id}`);
  console.log(`法规名称: ${l.title}`);

  const articles = db.prepare(`SELECT id, title FROM Article WHERE lawId = ? ORDER BY id`).all(l.id);
  console.log(`条款总数: ${(articles as any[]).length}`);

  (articles as any[]).slice(-5).forEach(a => {
    console.log(`  最后5条: ${a.id}: ${a.title}`);
  });

  // 检查是否有第四十条
  const art40 = db.prepare(`SELECT id, title FROM Article WHERE lawId = ? AND title LIKE '%四十%'`).all(l.id);
  console.log(`\n包含"四十"的条款: ${(art40 as any[]).length}`);
  (art40 as any[]).forEach(a => {
    console.log(`  ${a.id}: "${a.title}"`);

    // 检查第四十条是否有款
    const paragraphs = db.prepare(`SELECT id FROM Paragraph WHERE articleId = ?`).all(a.id);
    console.log(`    款数量: ${(paragraphs as any[]).length}`);

    if ((paragraphs as any[]).length > 0) {
      const firstPara = paragraphs[0] as any;
      const items = db.prepare(`SELECT id, number FROM Item WHERE paragraphId = ?`).all(firstPara.id);
      console.log(`    第一款的项数量: ${(items as any[]).length}`);
    }
  });
});

// 检查药品注册管理办法
console.log('\n\n2. 药品注册管理办法\n');
console.log('-'.repeat(60));
const law2 = db.prepare(`SELECT id, title FROM Law WHERE title LIKE '%药品注册管理办法%'`).all();
(law2 as any[]).forEach(l => {
  console.log(`法规ID: ${l.id}`);
  console.log(`法规名称: ${l.title}`);

  const articles = db.prepare(`SELECT COUNT(*) as count FROM Article WHERE lawId = ?`).get(l.id) as any;
  console.log(`条款总数: ${articles.count}`);

  // 检查第一百一十一条
  const art111 = db.prepare(`SELECT id, title FROM Article WHERE lawId = ? AND title LIKE '%一百一十一%'`).all(l.id);
  console.log(`\n包含"一百一十一"的条款: ${(art111 as any[]).length}`);
  (art111 as any[]).forEach(a => {
    console.log(`  ${a.id}: "${a.title}"`);
  });
});

// 检查中华人民共和国药品管理法
console.log('\n\n3. 中华人民共和国药品管理法\n');
console.log('-'.repeat(60));
const law3 = db.prepare(`SELECT id, title FROM Law WHERE title LIKE '%中华人民共和国药品管理法%'`).all();
(law3 as any[]).forEach(l => {
  console.log(`法规ID: ${l.id}`);
  console.log(`法规名称: ${l.title}`);

  const articles = db.prepare(`SELECT COUNT(*) as count FROM Article WHERE lawId = ?`).get(l.id) as any;
  console.log(`条款总数: ${articles.count}`);

  // 检查第一百二十五条
  const art125 = db.prepare(`SELECT id, title FROM Article WHERE lawId = ? AND title LIKE '%一百二十五%'`).all(l.id);
  console.log(`\n包含"一百二十五"的条款: ${(art125 as any[]).length}`);
  (art125 as any[]).forEach(a => {
    console.log(`  ${a.id}: "${a.title}"`);
  });
});

db.close();
