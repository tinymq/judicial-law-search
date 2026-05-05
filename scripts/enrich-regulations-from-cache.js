const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'dev.db'));
const CACHE_FILE = path.join(__dirname, 'data', 'guizhangku-cache.json');

function normalizeTitle(t) {
  return t
    .replace(/<[^>]+>/g, '')
    .replace(/[《》''「」【】\s]/g, '')
    .replace(/["""""]/g, '"')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .trim();
}

function normalizeForFuzzy(t) {
  return normalizeTitle(t)
    .replace(/\(试行\)/g, '')
    .replace(/（试行）/g, '');
}

function parsePublicationInfo(info) {
  if (!info) return { documentNumber: null, effectiveDate: null };

  let documentNumber = null;
  const patterns = [
    /([^\s（(]{2,}(?:令|发|函|办|规)[^\s]*?第?\s*\d+\s*号)/,
    /([^\s（(]+〔\d{4}〕\d+号)/,
    /([^\s（(]+\[\d{4}\]\d+号)/,
  ];
  for (const pat of patterns) {
    const m = info.match(pat);
    if (m) { documentNumber = m[1].replace(/<[^>]+>/g, '').trim(); break; }
  }

  let effectiveDate = null;
  const dateMatch = info.match(/自(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (dateMatch) {
    effectiveDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}T00:00:00.000Z`;
  }

  return { documentNumber, effectiveDate };
}

function parsePromulgationDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`;
  return null;
}

function main() {
  console.log('='.repeat(60));
  console.log('步骤3: 从规章库缓存补全637部部门规章元数据');
  console.log('='.repeat(60));

  const records = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  console.log(`缓存记录: ${records.length} 条\n`);

  const titleMap = new Map();
  const fuzzyMap = new Map();
  for (const r of records) {
    const rawTitle = (r.f_202321360426 || '').replace(/<[^>]+>/g, '');
    const exact = normalizeTitle(rawTitle);
    const fuzzy = normalizeForFuzzy(rawTitle);
    if (exact && !titleMap.has(exact)) titleMap.set(exact, r);
    if (fuzzy && !fuzzyMap.has(fuzzy)) fuzzyMap.set(fuzzy, r);
  }
  console.log(`标题索引: exact=${titleMap.size}, fuzzy=${fuzzyMap.size}`);

  const laws = db.prepare(`
    SELECT id, title, documentNumber, effectiveDate, issuingAuthority,
           promulgationDate, preamble
    FROM Law WHERE level = '部门规章'
  `).all();
  console.log(`部门规章总数: ${laws.length}\n`);

  let matched = 0, unmatched = 0;
  const stats = { documentNumber: 0, effectiveDate: 0, issuingAuthority: 0, promulgationDate: 0 };
  const unmatchedList = [];

  const updateStmt = db.prepare(`
    UPDATE Law SET
      documentNumber = COALESCE(?, documentNumber),
      effectiveDate = COALESCE(?, effectiveDate),
      issuingAuthority = COALESCE(?, issuingAuthority),
      promulgationDate = COALESCE(?, promulgationDate)
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    for (const law of laws) {
      const exact = normalizeTitle(law.title);
      const fuzzy = normalizeForFuzzy(law.title);
      const record = titleMap.get(exact) || titleMap.get(fuzzy) || fuzzyMap.get(exact) || fuzzyMap.get(fuzzy);

      if (!record) {
        unmatched++;
        unmatchedList.push(law.title);
        continue;
      }

      matched++;
      const authority = (record.f_202323394765 || record.f_202355832506 || record.f_202328191239 || '').replace(/<[^>]+>/g, '').trim() || null;
      const pubInfo = parsePublicationInfo(record.f_202344311304 || '');
      const promDate = parsePromulgationDate(record.f_202321915922);

      let newDocNum = null, newEffDate = null, newAuth = null, newPromDate = null;

      if (!law.documentNumber && pubInfo.documentNumber) {
        newDocNum = pubInfo.documentNumber;
        stats.documentNumber++;
      }
      if (!law.effectiveDate && pubInfo.effectiveDate) {
        newEffDate = pubInfo.effectiveDate;
        stats.effectiveDate++;
      }
      if (!law.issuingAuthority && authority) {
        newAuth = authority;
        stats.issuingAuthority++;
      }
      if (!law.promulgationDate && promDate) {
        newPromDate = promDate;
        stats.promulgationDate++;
      }

      if (newDocNum || newEffDate || newAuth || newPromDate) {
        updateStmt.run(newDocNum, newEffDate, newAuth, newPromDate, law.id);
      }
    }
  });

  transaction();

  console.log('='.repeat(60));
  console.log('结果');
  console.log('='.repeat(60));
  console.log(`匹配: ${matched} / ${laws.length} (${(matched/laws.length*100).toFixed(1)}%)`);
  console.log(`未匹配: ${unmatched}`);
  console.log('');
  console.log('新填充字段:');
  console.log(`  发文字号: +${stats.documentNumber}`);
  console.log(`  施行日期: +${stats.effectiveDate}`);
  console.log(`  制定机关: +${stats.issuingAuthority}`);
  console.log(`  发布日期: +${stats.promulgationDate}`);

  if (unmatchedList.length > 0) {
    console.log(`\n未匹配标题 (${unmatchedList.length}条):`);
    for (const t of unmatchedList.slice(0, 20)) {
      console.log(`  - ${t}`);
    }
    if (unmatchedList.length > 20) console.log(`  ... 还有 ${unmatchedList.length - 20} 条`);
    fs.writeFileSync(
      path.join(__dirname, 'data', 'unmatched-regulations.json'),
      JSON.stringify(unmatchedList, null, 2), 'utf-8'
    );
  }

  db.close();
}

main();
