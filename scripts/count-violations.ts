// @ts-ignore - better-sqlite3 types not available
import Database from 'better-sqlite3';
const db = new Database('dev.db', { readonly: true });

const count = db.prepare('SELECT COUNT(*) as count FROM Violation').get() as any;
console.log(`数据库中的违法行为总数: ${count.count}条\n`);

// 按创建时间查看最近的几条
const recent = db.prepare('SELECT id, code, description FROM Violation ORDER BY id DESC LIMIT 5').all();
console.log('最近导入的5条：\n');
(recent as any[]).forEach((v: any, i: number) => {
  console.log(`${i + 1}. [${v.code}] ${v.description?.substring(0, 40)}...`);
});

db.close();
