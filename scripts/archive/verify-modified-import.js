const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'dev.db'));

// lawGroupId linking: modified → current
const linked = db.prepare(
  "SELECT a.id as mid, a.title as mtitle, b.id as cid, b.title as ctitle " +
  "FROM Law a JOIN Law b ON a.lawGroupId = b.lawGroupId AND a.id != b.id " +
  "WHERE a.status = '已被修改' AND b.status = '现行有效' " +
  "AND a.level IN ('法律','行政法规') AND b.level IN ('法律','行政法规') " +
  "AND a.id >= 13072 LIMIT 10"
).all();
console.log('=== lawGroupId linking samples ===');
linked.forEach(r => console.log('  ', r.mtitle.substring(0,35), '->', r.ctitle.substring(0,35)));

const linkCount = db.prepare(
  "SELECT COUNT(DISTINCT a.id) as cnt FROM Law a JOIN Law b " +
  "ON a.lawGroupId = b.lawGroupId AND a.id != b.id " +
  "WHERE a.status = '已被修改' AND b.status = '现行有效' " +
  "AND a.level IN ('法律','行政法规') AND a.id >= 13072"
).get();
console.log('\nLinked modified->current:', linkCount.cnt, '/ 210');

// Unlinked (no current version found)
const unlinked = db.prepare(
  "SELECT a.id, a.title, a.lawGroupId FROM Law a " +
  "WHERE a.status = '已被修改' AND a.id >= 13072 " +
  "AND NOT EXISTS (SELECT 1 FROM Law b WHERE b.lawGroupId = a.lawGroupId AND b.status = '现行有效' AND b.id != a.id)"
).all();
console.log('Unlinked (no current version):', unlinked.length);
if (unlinked.length > 0) {
  unlinked.slice(0, 5).forEach(r => console.log('  ', r.title));
}

// LawIndustry records
const indCount = db.prepare('SELECT COUNT(*) as cnt FROM LawIndustry WHERE lawId >= 13072').get();
console.log('\nLawIndustry records created:', indCount.cnt);

// Industry distribution
const indDist = db.prepare(
  "SELECT i.name, COUNT(*) as cnt FROM LawIndustry li " +
  "JOIN Industry i ON li.industryId = i.id WHERE li.lawId >= 13072 " +
  "GROUP BY i.name ORDER BY cnt DESC LIMIT 15"
).all();
console.log('\nIndustry distribution (top 15):');
indDist.forEach(r => console.log('  ', r.name + ':', r.cnt));

// Total
const total = db.prepare('SELECT COUNT(*) as cnt FROM Law').get();
console.log('\nTotal laws in DB:', total.cnt);

db.close();
