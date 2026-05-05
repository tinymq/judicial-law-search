/**
 * 法律与行政法规对齐检查脚本
 * 查询国家库(flk.npc.gov.cn)现行有效+尚未生效数据，与项目库比对
 * Usage: node scripts/check-flk-alignment.js [laws|regs|all]
 *
 * API响应格式: {total, rows} （不是 {code,data:{total,list}}）
 * 分页参数: pageNum（不是page）
 * 不需要cookie
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'dev.db');
const OUTPUT_DIR = path.join(__dirname, 'data');
const PAGE_SIZE = 20; // API实际最多返回20条/页，设大了会漏数据

// ============ HTTP helper (复用 import-jiangsu-local-regs.js 的格式) ============
function httpsPost(hostname, reqPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const r = https.request({
      hostname, path: reqPath, method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Referer': 'https://flk.npc.gov.cn/',
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(raw) }); }
        catch (e) { reject(new Error('Invalid JSON: ' + raw.substring(0, 200))); }
      });
    });
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============ 法律子分类代码 (来自 enumData) ============
const LAW_SUBCODES = [
  { code: 110, label: '宪法相关法' },
  { code: 120, label: '民法商法' },
  { code: 130, label: '行政法' },
  { code: 140, label: '经济法' },
  { code: 150, label: '社会法' },
  { code: 155, label: '生态环境法' },
  { code: 160, label: '刑法' },
  { code: 170, label: '诉讼与非诉讼程序法' },
  { code: 180, label: '法律解释' },
  { code: 190, label: '有关法律问题和重大问题的决定（部分）' },
  { code: 195, label: '修正案' },
];

// ============ 查询国家库 ============
async function fetchFlkPages(flfgCodeId, sxxCode, label) {
  const allItems = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const body = {
      searchRange: 1, searchType: 2,
      sxx: [sxxCode],
      flfgCodeId: [flfgCodeId],
      searchContent: '', pageNum: page, size: PAGE_SIZE
    };

    const resp = await httpsPost('flk.npc.gov.cn', '/law-search/search/list', body);

    if (resp.statusCode === 307) {
      console.log('  触发WAF，等待5分钟...');
      await sleep(5 * 60 * 1000);
      continue;
    }

    // 响应格式: {total, rows}
    const total = resp.data.total || 0;
    const rows = resp.data.rows || [];
    totalPages = Math.ceil(total / PAGE_SIZE);

    for (const item of rows) {
      allItems.push({
        title: (item.title || '').replace(/<[^>]+>/g, '').trim(),
        bbbs: item.bbbs,
        sxx: sxxCode,
        sxxLabel: sxxCode === 3 ? '现行有效' : sxxCode === 9 ? '尚未生效' : String(sxxCode),
        gbrq: item.gbrq,
        sxrq: item.sxrq,
        zdjgName: item.zdjgName,
        flfgCodeId: item.flfgCodeId,
        flxz: item.flxz,
      });
    }

    if (page === 1) {
      console.log(`  ${label}: total=${total}`);
    }
    page++;
    if (page <= totalPages) await sleep(1200);
  }

  return allItems;
}

async function fetchAllLaws(sxxCode, sxxLabel) {
  console.log(`\n查询国家库法律 - ${sxxLabel} (sxx=${sxxCode})...`);
  const allItems = [];

  for (const sub of LAW_SUBCODES) {
    const items = await fetchFlkPages(sub.code, sxxCode, sub.label);
    allItems.push(...items);
    await sleep(1500);
  }

  console.log(`  法律 ${sxxLabel} 合计: ${allItems.length}条`);
  return allItems;
}

async function fetchAllRegs(sxxCode, sxxLabel) {
  console.log(`\n查询国家库行政法规 - ${sxxLabel} (sxx=${sxxCode})...`);
  const items = await fetchFlkPages(210, sxxCode, '行政法规');
  console.log(`  行政法规 ${sxxLabel} 合计: ${items.length}条`);
  return items;
}

// ============ 比对逻辑 ============
function normalizeTitle(title) {
  return title
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '')
    .replace(/（/g, '(').replace(/）/g, ')')
    // 去掉年份后缀: (2023年修订) (2018年修正) (2019年公布) (试行) 等
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .replace(/\(试行\)/g, '')
    .trim();
}

function compareWithDb(flkItems, dbLaws, categoryLabel) {
  console.log(`\n===== ${categoryLabel} 比对 =====`);
  console.log(`国家库: ${flkItems.length}条, 项目库: ${dbLaws.length}条`);

  const dbTitleMap = new Map();
  for (const law of dbLaws) {
    const norm = normalizeTitle(law.title);
    if (!dbTitleMap.has(norm)) dbTitleMap.set(norm, []);
    dbTitleMap.get(norm).push(law);
  }

  const flkTitleMap = new Map();
  for (const item of flkItems) {
    const norm = normalizeTitle(item.title);
    if (!flkTitleMap.has(norm)) flkTitleMap.set(norm, []);
    flkTitleMap.get(norm).push(item);
  }

  // 国家库有、项目库没有
  const missing = [];
  const seen = new Set();
  for (const item of flkItems) {
    const norm = normalizeTitle(item.title);
    if (!dbTitleMap.has(norm) && !seen.has(norm)) {
      missing.push(item);
      seen.add(norm);
    }
  }

  // 项目库有、国家库没有（仅现行有效+尚未生效）
  const extra = [];
  for (const law of dbLaws) {
    if (law.status !== '现行有效' && law.status !== '尚未生效') continue;
    const norm = normalizeTitle(law.title);
    if (!flkTitleMap.has(norm)) {
      extra.push(law);
    }
  }

  // 状态不一致
  const statusMismatch = [];
  for (const item of flkItems) {
    const norm = normalizeTitle(item.title);
    const dbMatches = dbTitleMap.get(norm);
    if (dbMatches) {
      for (const dbLaw of dbMatches) {
        if (dbLaw.status !== item.sxxLabel) {
          statusMismatch.push({
            title: item.title,
            flkStatus: item.sxxLabel,
            dbStatus: dbLaw.status,
            dbId: dbLaw.id,
          });
        }
      }
    }
  }

  console.log(`\n缺失(国家库有,项目库无): ${missing.length}条`);
  missing.forEach(m => console.log(`  [-] ${m.title} | ${m.sxxLabel} | ${m.zdjgName || ''}`));

  console.log(`\n多余(项目库有,国家库无): ${extra.length}条`);
  extra.forEach(e => console.log(`  [+] ${e.title} | ${e.status} | id=${e.id}`));

  console.log(`\n状态不一致: ${statusMismatch.length}条`);
  statusMismatch.forEach(s => console.log(`  [!] ${s.title} | 国家库:${s.flkStatus} → 项目库:${s.dbStatus} | id=${s.dbId}`));

  return { missing, extra, statusMismatch };
}

// ============ Main ============
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'all';

  console.log('='.repeat(60));
  console.log('法律与行政法规对齐检查');
  console.log('时间:', new Date().toISOString());
  console.log('='.repeat(60));

  const db = new Database(DB_PATH, { readonly: true });
  const results = {};

  if (mode === 'laws' || mode === 'all') {
    // 查询国家库法律（逐子分类）
    const flkLawsValid = await fetchAllLaws(3, '现行有效');
    await sleep(2000);
    const flkLawsPending = await fetchAllLaws(9, '尚未生效');
    const flkLaws = [...flkLawsValid, ...flkLawsPending];

    // 保存
    fs.writeFileSync(path.join(OUTPUT_DIR, 'flk-laws-alignment.json'),
      JSON.stringify(flkLaws, null, 2), 'utf-8');
    console.log(`\n已保存: flk-laws-alignment.json (${flkLaws.length}条)`);

    // 按子分类统计
    const byCode = {};
    flkLaws.forEach(l => { byCode[l.flfgCodeId] = (byCode[l.flfgCodeId] || 0) + 1; });
    console.log('国家库法律按flfgCodeId统计:', byCode);

    // 项目库法律（含重分类出去的位阶）
    const dbLaws = db.prepare(
      "SELECT id, title, status, level FROM Law WHERE level IN ('法律','法律修正案','法律解释','有关法律问题和重大问题的决定')"
    ).all();

    results.laws = compareWithDb(flkLaws, dbLaws, '法律（含修正案/解释/决定）');
  }

  if (mode === 'regs' || mode === 'all') {
    await sleep(2000);

    const flkRegsValid = await fetchAllRegs(3, '现行有效');
    await sleep(2000);
    const flkRegsPending = await fetchAllRegs(9, '尚未生效');
    const flkRegs = [...flkRegsValid, ...flkRegsPending];

    fs.writeFileSync(path.join(OUTPUT_DIR, 'flk-regs-alignment.json'),
      JSON.stringify(flkRegs, null, 2), 'utf-8');
    console.log(`\n已保存: flk-regs-alignment.json (${flkRegs.length}条)`);

    const dbRegs = db.prepare(
      "SELECT id, title, status, level FROM Law WHERE level = '行政法规'"
    ).all();

    results.regs = compareWithDb(flkRegs, dbRegs, '行政法规');
  }

  // 保存完整结果
  fs.writeFileSync(path.join(OUTPUT_DIR, 'flk-alignment-result.json'),
    JSON.stringify(results, null, 2), 'utf-8');

  db.close();

  // 摘要
  console.log('\n' + '='.repeat(60));
  console.log('摘要');
  console.log('='.repeat(60));
  if (results.laws) {
    console.log(`法律: 缺失${results.laws.missing.length} | 多余${results.laws.extra.length} | 状态不一致${results.laws.statusMismatch.length}`);
  }
  if (results.regs) {
    console.log(`行政法规: 缺失${results.regs.missing.length} | 多余${results.regs.extra.length} | 状态不一致${results.regs.statusMismatch.length}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
