// @ts-ignore
import Database from 'better-sqlite3';
const db = new Database('dev.db', { readonly: true });

// 查询"合同行政监督管理办法"(2025年修正)的第5条
const lawId = 368;
const articleId = 22709; // 第五条

console.log('查询第五条（ID=22709）的款和项：\n');

const paragraphs = db.prepare(`SELECT id, number, content FROM Paragraph WHERE articleId = ? ORDER BY "order"`).all(articleId);
console.log(`款数量: ${paragraphs.length}\n`);

if ((paragraphs as any[]).length > 0) {
  (paragraphs as any[]).forEach((p: any) => {
    console.log(`  款 ${p.number}: ${p.number || '空'}`);
    console.log(`    内容: ${(p.content || '').substring(0, 50)}...`);

    const items = db.prepare(`SELECT id, number FROM Item WHERE paragraphId = ? ORDER BY "order"`).all(p.id);
    if ((items as any[]).length > 0) {
      console.log(`    项数量: ${(items as any[]).length}`);
      (items as any[]).forEach((item: any) => {
        console.log(`      项 ${item.number}`);
      });
    }
    console.log();
  });
} else {
  console.log('  第五条没有款！');
  console.log('  这说明数据库只解析到"条"层级，没有解析"款"和"项"');
}

db.close();
