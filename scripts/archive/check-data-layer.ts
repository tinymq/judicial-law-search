/**
 * 数据层验证查询脚本 - Steps 1-6 验证
 * 用完后归档到 scripts/archive/
 */
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'dev.db');
const db = new Database(dbPath, { readonly: true });

function query(label: string, sql: string) {
  console.log(`\n=== ${label} ===`);
  const rows = db.prepare(sql).all();
  console.table(rows);
  return rows;
}

function queryGet(label: string, sql: string) {
  console.log(`\n=== ${label} ===`);
  const row = db.prepare(sql).get();
  console.log(row);
  return row;
}

// ─── 1. Industry table counts ───
console.log('\n' + '═'.repeat(60));
console.log('1. INDUSTRY TABLE COUNTS');
console.log('═'.repeat(60));

queryGet('Total industries', 'SELECT COUNT(*) as total FROM Industry');
queryGet('Level-1 (parentCode IS NULL)', 'SELECT COUNT(*) as level1 FROM Industry WHERE parentCode IS NULL');
queryGet('Level-2 (parentCode IS NOT NULL)', 'SELECT COUNT(*) as level2 FROM Industry WHERE parentCode IS NOT NULL');

query('Level-2 per parent (top 5 by count)', `
  SELECT i1.parentCode,
         (SELECT name FROM Industry i2 WHERE i2.code = i1.parentCode) AS parentName,
         COUNT(*) AS level2Count
  FROM Industry i1
  WHERE parentCode IS NOT NULL
  GROUP BY parentCode
  ORDER BY level2Count DESC
  LIMIT 5
`);

// ─── 2. Law.scope distribution ───
console.log('\n' + '═'.repeat(60));
console.log('2. LAW.SCOPE DISTRIBUTION');
console.log('═'.repeat(60));

query('Scope distribution', 'SELECT scope, COUNT(*) as count FROM Law GROUP BY scope ORDER BY count DESC');

// ─── 3. LawIndustry stats ───
console.log('\n' + '═'.repeat(60));
console.log('3. LAWINDUSTRY STATS');
console.log('═'.repeat(60));

queryGet('Total LawIndustry records', 'SELECT COUNT(*) as total FROM LawIndustry');
query('isPrimary breakdown', 'SELECT isPrimary, COUNT(*) as count FROM LawIndustry GROUP BY isPrimary');
queryGet('Distinct laws with LawIndustry', 'SELECT COUNT(DISTINCT lawId) as lawsWithIndustry FROM LawIndustry');
queryGet('Laws WITHOUT any LawIndustry', 'SELECT COUNT(*) as lawsWithoutIndustry FROM Law WHERE id NOT IN (SELECT DISTINCT lawId FROM LawIndustry)');
queryGet('Total laws for reference', 'SELECT COUNT(*) as totalLaws FROM Law');

// ─── 4. Category migration verification ───
console.log('\n' + '═'.repeat(60));
console.log('4. CATEGORY MIGRATION VERIFICATION');
console.log('═'.repeat(60));

queryGet('Laws with category=综合监管', "SELECT COUNT(*) as count FROM Law WHERE category = '综合监管'");
queryGet('Laws with non-综合监管 category', "SELECT COUNT(*) as count FROM Law WHERE category != '综合监管'");
query('Top 10 category values', "SELECT category, COUNT(*) as count FROM Law GROUP BY category ORDER BY count DESC LIMIT 10");

// ─── 5. Enforcement items verification ───
console.log('\n' + '═'.repeat(60));
console.log('5. ENFORCEMENT ITEMS VERIFICATION');
console.log('═'.repeat(60));

queryGet('Hunan (430000) with industryId', "SELECT COUNT(*) as count FROM EnforcementItem WHERE province = '430000' AND industryId IS NOT NULL");
queryGet('Hunan (430000) without industryId', "SELECT COUNT(*) as count FROM EnforcementItem WHERE province = '430000' AND industryId IS NULL");
queryGet('Zhejiang (330000) 市场监督管理 items', "SELECT COUNT(*) as count FROM EnforcementItem WHERE province = '330000' AND enforcementDomain = '市场监督管理'");

// Extra context
queryGet('Total Hunan items', "SELECT COUNT(*) as count FROM EnforcementItem WHERE province = '430000'");
queryGet('Total Zhejiang items', "SELECT COUNT(*) as count FROM EnforcementItem WHERE province = '330000'");
query('All provinces and counts', "SELECT province, COUNT(*) as count FROM EnforcementItem GROUP BY province ORDER BY count DESC");

// ─── 6. Universal laws ───
console.log('\n' + '═'.repeat(60));
console.log('6. UNIVERSAL LAWS (scope=universal)');
console.log('═'.repeat(60));

query('All universal laws', "SELECT id, title FROM Law WHERE scope = 'universal' ORDER BY id");

// ─── 7. Level-2 industries under code '30' ───
console.log('\n' + '═'.repeat(60));
console.log("7. LEVEL-2 INDUSTRIES UNDER CODE '30' (市场监督管理)");
console.log('═'.repeat(60));

query('Industries under 30', `
  SELECT i.code, i.name, COALESCE(li.cnt, 0) AS lawIndustryCount
  FROM Industry i
  LEFT JOIN (SELECT industryId, COUNT(*) AS cnt FROM LawIndustry GROUP BY industryId) li ON li.industryId = i.id
  WHERE i.parentCode = '30'
  ORDER BY i.code
`);

// Also show the parent itself
queryGet('Parent industry 30', "SELECT code, name FROM Industry WHERE code = '30'");

db.close();
console.log('\n✓ All queries completed.');
