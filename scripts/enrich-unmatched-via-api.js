const path = require('path');
const fs = require('fs');
const https = require('https');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'dev.db'));
const ATHENA_URL = 'https://sousuoht.www.gov.cn/athena/forward/BD8730CDDA12515E2D9E1B21AA11C0D6';
const ATHENA_APP_KEY = decodeURIComponent('YMLOfDq5psgC%2Bz5HlWUd6RC75WYJ02Ia1eTitC8Pro4bHvRcUNQ4fGiecrxY7OJJ9xgA0E%2B8tn1cHbTtyuAtcCpYRXpKfIb4pDI4wdR45xu5V1GC5D4p96sGxcidhdxF8v9%2F86OMoKtpoZWY%2BuUFu9MKtPF8j7c8ZJ0lGfla53Q%3D');

function extractCoreName(title) {
  return title
    .replace(/\([^)]*\d{4}[^)]*\)/g, '')
    .replace(/（[^）]*\d{4}[^）]*）/g, '')
    .replace(/\(FBM-[^)]+\)/g, '')
    .replace(/\(试行\)/g, '').replace(/（试行）/g, '')
    .replace(/[《》]/g, '')
    .trim();
}

function searchByTitle(keyword) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify({
      code: '18258ab0ac9',
      preference: null,
      searchFields: [
        { fieldName: 'f_202321807875', searchWord: '部门规章', searchType: 'TERM', withHighLight: true },
        { fieldName: 'f_202321360426', searchWord: keyword, withHighLight: true },
        { fieldName: 'f_202321758948', searchWord: '', withHighLight: true },
        { fieldName: 'f_202321423473', withHighLight: true, searchType: 'TERM' },
        { fieldName: 'f_202321159816', searchWord: '', searchType: 'TERM' },
        { fieldName: 'f_20232380533', withHighLight: true, searchType: 'TERM' },
        { fieldName: 'f_202328191239', withHighLight: true, searchType: 'TERM' },
      ],
      sorts: [{}, { sortField: 'f_202321915922', sortOrder: 'DESC' }],
      resultFields: [
        'f_202321360426', 'f_202344311304', 'f_202323394765', 'f_202355832506',
        'f_202328191239', 'f_202321915922',
      ],
      trackTotalHits: 'true',
      granularity: 'ALL',
      tableName: 't_1860c735d31',
      pageSize: 10,
      pageNo: 1,
    }), 'utf-8');

    const url = new URL(ATHENA_URL);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        'Content-Length': body.length,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://www.gov.cn',
        'Referer': 'https://www.gov.cn/zhengce/xxgk/gjgzk/index.htm',
        'athenaAppKey': ATHENA_APP_KEY,
        'athenaAppName': '%E8%A7%84%E7%AB%A0%E5%BA%93',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.resultCode?.code !== 200) {
            reject(new Error(`API error: ${JSON.stringify(json.resultCode)}`));
            return;
          }
          resolve(json.result.data.list || []);
        } catch (e) {
          reject(new Error(`Parse error: ${e}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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

function normalizeForCompare(t) {
  return t.replace(/<[^>]+>/g, '').replace(/[《》''「」【】\s]/g, '').replace(/（/g, '(').replace(/）/g, ')');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('='.repeat(60));
  console.log('步骤3B: 规章库API逐条搜索未匹配的部门规章');
  console.log('='.repeat(60));

  const unmatched = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'unmatched-regulations.json'), 'utf-8'));
  console.log(`待搜索: ${unmatched.length} 条\n`);

  const laws = db.prepare(`
    SELECT id, title, documentNumber, effectiveDate, issuingAuthority, promulgationDate
    FROM Law WHERE level = '部门规章' AND title IN (${unmatched.map(() => '?').join(',')})
  `).all(...unmatched);

  console.log(`数据库匹配: ${laws.length} 条\n`);

  const updateStmt = db.prepare(`
    UPDATE Law SET
      documentNumber = COALESCE(?, documentNumber),
      effectiveDate = COALESCE(?, effectiveDate),
      issuingAuthority = COALESCE(?, issuingAuthority),
      promulgationDate = COALESCE(?, promulgationDate)
    WHERE id = ?
  `);

  let apiMatched = 0, apiMissed = 0, updated = 0, errors = 0;
  const stats = { documentNumber: 0, effectiveDate: 0, issuingAuthority: 0, promulgationDate: 0 };
  const stillUnmatched = [];

  for (let i = 0; i < laws.length; i++) {
    const law = laws[i];
    const coreName = extractCoreName(law.title);

    try {
      await sleep(800);
      const results = await searchByTitle(coreName);

      if (results.length === 0) {
        apiMissed++;
        stillUnmatched.push(law.title);
        process.stdout.write(`[${i+1}/${laws.length}] ✗ ${law.title.substring(0, 40)}\n`);
        continue;
      }

      const coreNorm = normalizeForCompare(coreName);
      const bestMatch = results.find(r => {
        const rTitle = normalizeForCompare(r.f_202321360426 || '');
        return rTitle.includes(coreNorm) || coreNorm.includes(rTitle.replace(/\(试行\)/g, ''));
      }) || results[0];

      apiMatched++;
      const authority = (bestMatch.f_202323394765 || bestMatch.f_202355832506 || bestMatch.f_202328191239 || '').replace(/<[^>]+>/g, '').trim() || null;
      const pubInfo = parsePublicationInfo(bestMatch.f_202344311304 || '');
      const promDate = parsePromulgationDate(bestMatch.f_202321915922);

      let newDocNum = null, newEffDate = null, newAuth = null, newPromDate = null;
      if (!law.documentNumber && pubInfo.documentNumber) { newDocNum = pubInfo.documentNumber; stats.documentNumber++; }
      if (!law.effectiveDate && pubInfo.effectiveDate) { newEffDate = pubInfo.effectiveDate; stats.effectiveDate++; }
      if (!law.issuingAuthority && authority) { newAuth = authority; stats.issuingAuthority++; }
      if (!law.promulgationDate && promDate) { newPromDate = promDate; stats.promulgationDate++; }

      if (newDocNum || newEffDate || newAuth || newPromDate) {
        updateStmt.run(newDocNum, newEffDate, newAuth, newPromDate, law.id);
        updated++;
      }
      process.stdout.write(`[${i+1}/${laws.length}] ✓ ${law.title.substring(0, 40)}\n`);

    } catch (err) {
      errors++;
      console.error(`[${i+1}/${laws.length}] ERROR ${law.title}: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('结果');
  console.log('='.repeat(60));
  console.log(`API匹配: ${apiMatched} / ${laws.length}`);
  console.log(`API未找到: ${apiMissed}`);
  console.log(`更新: ${updated}`);
  console.log(`错误: ${errors}`);
  console.log('');
  console.log('新填充字段:');
  console.log(`  发文字号: +${stats.documentNumber}`);
  console.log(`  施行日期: +${stats.effectiveDate}`);
  console.log(`  制定机关: +${stats.issuingAuthority}`);
  console.log(`  发布日期: +${stats.promulgationDate}`);

  if (stillUnmatched.length > 0) {
    console.log(`\n仍未匹配 (${stillUnmatched.length}条):`);
    stillUnmatched.forEach(t => console.log(`  - ${t}`));
  }

  db.close();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
