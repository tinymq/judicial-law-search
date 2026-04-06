// @ts-ignore
import Database from 'better-sqlite3';
const db = new Database('dev.db', { readonly: true });

const laws = db.prepare(`SELECT id, title FROM Law WHERE title LIKE '%产品%' LIMIT 20`).all();
console.log('含有"产品"的法规：');
(laws as any[]).forEach(l => console.log(`  ${l.id}: ${l.title}`));

const laws2 = db.prepare(`SELECT id, title FROM Law WHERE title LIKE '%管理办法%' LIMIT 20`).all();
console.log('\n含有"管理办法"的法规：');
(laws2 as any[]).forEach(l => console.log(`  ${l.id}: ${l.title}`));

const laws3 = db.prepare(`SELECT id, title FROM Law WHERE title LIKE '%湖南省%' LIMIT 20`).all();
console.log('\n含有"湖南省"的法规：');
(laws3 as any[]).forEach(l => console.log(`  ${l.id}: ${l.title}`));

db.close();
