/**
 * 按子分类逐项比对法律和行政法规
 * Usage: node scripts/check-flk-detail.js
 *
 * 依赖已保存的国家库数据:
 *   scripts/data/flk-laws-alignment.json (347条法律)
 *   scripts/data/flk-regs-alignment.json (609条行政法规)
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'dev.db');
const DATA_DIR = path.join(__dirname, 'data');

// 子分类映射
const LAW_SUBCATEGORIES = {
  110: '宪法相关法',
  120: '民法商法',
  130: '行政法',
  140: '经济法',
  150: '社会法',
  155: '生态环境法',
  160: '刑法',
  170: '诉讼与非诉讼程序法',
  180: '法律解释',
  190: '有关法律问题和重大问题的决定',
  195: '修正案',
};

// 项目库位阶→国家库子分类的映射
const LEVEL_TO_SUBCAT = {
  '法律修正案': 195,
  '法律解释': 180,
  '有关法律问题和重大问题的决定': 190,
};

function normalize(title) {
  return title
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, '')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .replace(/\(试行\)/g, '')
    .trim();
}

function main() {
  const db = new Database(DB_PATH, { readonly: true });

  // ====== 法律部分 ======
  console.log('='.repeat(70));
  console.log('一、法律按子分类逐项比对');
  console.log('='.repeat(70));

  const flkLaws = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'flk-laws-alignment.json'), 'utf8'));
  const dbLaws = db.prepare(
    "SELECT id, title, status, level FROM Law WHERE level IN ('法律','法律修正案','法律解释','有关法律问题和重大问题的决定')"
  ).all();

  // 国家库按子分类分组
  const flkBySubcat = {};
  for (const item of flkLaws) {
    const code = item.flfgCodeId;
    if (!flkBySubcat[code]) flkBySubcat[code] = [];
    flkBySubcat[code].push(item);
  }

  // 建国家库标题索引 (norm -> item)
  const flkNormMap = new Map();
  for (const item of flkLaws) {
    flkNormMap.set(normalize(item.title), item);
  }

  // 项目库法律：尝试匹配国家库获取子分类
  const dbMatched = [];    // 匹配到国家库的
  const dbUnmatched = [];  // 未匹配到国家库的

  for (const law of dbLaws) {
    const norm = normalize(law.title);
    const flkItem = flkNormMap.get(norm);
    if (flkItem) {
      dbMatched.push({ ...law, flfgCodeId: flkItem.flfgCodeId, flkTitle: flkItem.title });
    } else {
      // 对于重分类出去的位阶，用映射
      const mappedCode = LEVEL_TO_SUBCAT[law.level];
      dbUnmatched.push({ ...law, guessedCode: mappedCode || null });
    }
  }

  // 按子分类比对
  const subcatCodes = [110, 120, 130, 140, 150, 155, 160, 170, 180, 190, 195];
  const summaryRows = [];

  for (const code of subcatCodes) {
    const label = LAW_SUBCATEGORIES[code];
    const flkItems = flkBySubcat[code] || [];
    const dbItems = dbMatched.filter(d => d.flfgCodeId === code);
    const dbGuessed = dbUnmatched.filter(d => d.guessedCode === code);
    const dbAll = [...dbItems, ...dbGuessed].filter(d => d.status === '现行有效' || d.status === '尚未生效');

    // 国家库有、项目库无
    const flkNorms = new Set(flkItems.map(i => normalize(i.title)));
    const dbNorms = new Set([...dbItems.map(d => normalize(d.title)), ...dbGuessed.map(d => normalize(d.title))]);
    const missing = flkItems.filter(i => !dbNorms.has(normalize(i.title)));

    // 项目库有、国家库无（仅现行有效+尚未生效）
    const extra = dbAll.filter(d => !flkNorms.has(normalize(d.title)));

    console.log(`\n--- ${label} (flfgCodeId=${code}) ---`);
    console.log(`国家库: ${flkItems.length}条 | 项目库匹配: ${dbItems.length}条 + 未匹配归类: ${dbGuessed.filter(d=>d.status==='现行有效'||d.status==='尚未生效').length}条`);
    console.log(`缺失: ${missing.length}条 | 多余: ${extra.length}条`);

    if (missing.length > 0) {
      missing.forEach(m => console.log(`  [-] ${m.title}`));
    }
    if (extra.length > 0) {
      extra.forEach(e => console.log(`  [+] ${e.title} | ${e.status} | id=${e.id}`));
    }

    summaryRows.push({
      code, label,
      flkCount: flkItems.length,
      dbMatchCount: dbItems.length,
      dbExtraCount: dbGuessed.filter(d=>d.status==='现行有效'||d.status==='尚未生效').length,
      missingCount: missing.length,
      extraCount: extra.length,
    });
  }

  // 未匹配且无法归类的
  const unclassified = dbUnmatched.filter(d => !d.guessedCode && (d.status === '现行有效' || d.status === '尚未生效'));
  if (unclassified.length > 0) {
    console.log(`\n--- 未匹配且无法归类 ---`);
    console.log(`数量: ${unclassified.length}条`);
    unclassified.forEach(d => console.log(`  [?] ${d.title} | ${d.level} | ${d.status} | id=${d.id}`));
  }

  // 汇总表
  console.log('\n\n===== 法律子分类汇总表 =====');
  console.log('子分类 | 国家库 | 项目库(匹配) | 项目库(归类) | 缺失 | 多余');
  for (const r of summaryRows) {
    console.log(`${r.label} | ${r.flkCount} | ${r.dbMatchCount} | ${r.dbExtraCount} | ${r.missingCount} | ${r.extraCount}`);
  }
  const totalFlk = summaryRows.reduce((s, r) => s + r.flkCount, 0);
  const totalMatch = summaryRows.reduce((s, r) => s + r.dbMatchCount, 0);
  const totalGuess = summaryRows.reduce((s, r) => s + r.dbExtraCount, 0);
  const totalMissing = summaryRows.reduce((s, r) => s + r.missingCount, 0);
  const totalExtra = summaryRows.reduce((s, r) => s + r.extraCount, 0);
  console.log(`合计 | ${totalFlk} | ${totalMatch} | ${totalGuess} | ${totalMissing} | ${totalExtra}`);
  if (unclassified.length > 0) {
    console.log(`未归类 | - | - | ${unclassified.length} | - | ${unclassified.length}`);
  }

  // ====== 行政法规部分 ======
  console.log('\n\n' + '='.repeat(70));
  console.log('二、行政法规逐项比对');
  console.log('='.repeat(70));

  const flkRegs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'flk-regs-alignment.json'), 'utf8'));
  const dbRegs = db.prepare("SELECT id, title, status, level FROM Law WHERE level = '行政法规'").all();

  // 按时效性分组对比
  const flkRegNorms = new Map();
  for (const item of flkRegs) {
    flkRegNorms.set(normalize(item.title), item);
  }

  const dbRegsByStatus = {};
  for (const r of dbRegs) {
    if (!dbRegsByStatus[r.status]) dbRegsByStatus[r.status] = [];
    dbRegsByStatus[r.status].push(r);
  }

  console.log('\n项目库行政法规按时效性:');
  for (const [status, items] of Object.entries(dbRegsByStatus).sort()) {
    const matched = items.filter(d => flkRegNorms.has(normalize(d.title)));
    const unmatched = items.filter(d => !flkRegNorms.has(normalize(d.title)));
    console.log(`  ${status}: ${items.length}条 (匹配国家库: ${matched.length}, 未匹配: ${unmatched.length})`);
    if (unmatched.length > 0 && unmatched.length <= 20) {
      unmatched.forEach(d => console.log(`    [?] ${d.title} | id=${d.id}`));
    }
  }

  // 国家库有项目库无
  const dbRegNorms = new Set(dbRegs.map(d => normalize(d.title)));
  const regMissing = flkRegs.filter(r => !dbRegNorms.has(normalize(r.title)));
  console.log(`\n国家库有、项目库无: ${regMissing.length}条`);
  regMissing.forEach(r => console.log(`  [-] ${r.title}`));

  // 项目库有(现行有效+尚未生效)国家库无
  const flkRegNormSet = new Set(flkRegs.map(r => normalize(r.title)));
  const regExtra = dbRegs
    .filter(d => (d.status === '现行有效' || d.status === '尚未生效') && !flkRegNormSet.has(normalize(d.title)));
  console.log(`\n项目库有(现行有效/尚未生效)、国家库无: ${regExtra.length}条`);
  regExtra.forEach(d => console.log(`  [+] ${d.title} | ${d.status} | id=${d.id}`));

  db.close();
}

main();
