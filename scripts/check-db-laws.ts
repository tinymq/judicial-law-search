// @ts-ignore
import Database from 'better-sqlite3';

const db = new Database('dev.db', { readonly: true });

// 查询含有"产品"的法规
console.log('数据库中含有"产品"的法规：\n');
const laws = db.prepare('SELECT id, title FROM Law WHERE title LIKE \"%产品%\" LIMIT 20').all();

laws.forEach((l: any) => {
  console.log(`  ${l.id}: ${l.title}`);
});

console.log(`\n共找到 ${laws.length} 部\n`);

// 查询含有"工业产品"的法规
console.log('数据库中含有"工业产品"的法规：\n');
const laws2 = db.prepare('SELECT id, title FROM Law WHERE title LIKE \"%工业产品%\" LIMIT 10').all();

laws2.forEach((l: any) => {
  console.log(`  ${l.id}: ${l.title}`);
});

console.log(`\n共找到 ${laws2.length} 部\n`);

// 查询含有"管理办法"的法规
console.log('数据库中含有"管理办法"的法规（前20部）：\n');
const laws3 = db.prepare('SELECT id, title FROM Law WHERE title LIKE \"%管理办法%\" LIMIT 20').all();

laws3.forEach((l: any) => {
  console.log(`  ${l.id}: ${l.title}`);
});

console.log(`\n共找到 ${laws3.length} 部\n`);

// 查询含有"湖南省"的法规
console.log('数据库中含有"湖南省"的法规：\n');
const laws4 = db.prepare('SELECT id, title FROM Law WHERE title LIKE \"%湖南省%\" LIMIT 20').all();

laws4.forEach((l: any) => {
  console.log(`  ${l.id}: ${l.title}`);
});

console.log(`\n共找到 ${laws4.length} 部\n`);

db.close();
