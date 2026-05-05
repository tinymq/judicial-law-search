/**
 * Import judicial interpretations (司法解释) from flk.npc.gov.cn
 *
 * Usage: node scripts/import-judicial-interpretations.js [--dry-run] [--limit N] [--skip-fetch]
 *
 * Covers three subcategories:
 *   flfgCodeId=320: 高法司法解释 (最高人民法院)
 *   flfgCodeId=330: 高检司法解释 (最高人民检察院)
 *   flfgCodeId=340: 联合发布司法解释
 *
 * Steps:
 * 1. Fetch all valid judicial interpretations from flk API (paginated, 3 categories)
 * 2. Compare with project DB to find missing
 * 3. Import missing: download docx -> mammoth -> parseContent -> insert DB
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const mammoth = require('mammoth');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'dev.db');

const CATEGORIES = [
  { flfgCodeId: 320, label: '高法司法解释' },
  { flfgCodeId: 330, label: '高检司法解释' },
  { flfgCodeId: 340, label: '联合发布司法解释' },
];

// ============ parseContent (from contentParser.ts) ============
function parseContent(rawContent) {
  let preamble = '';
  let text = rawContent;

  const ordinalArticleRegex = /^\s*([一二三四五六七八九十百]+)、\s*(.*)/;
  const allLines = rawContent.split('\n');
  const hasOrdinal = allLines.some(l => ordinalArticleRegex.test(l.trim()));
  const hasStandard = allLines.some(l => /^\s*\**\s*第[零一二三四五六七八九十百千0-9]+条/.test(l.trim()));
  const firstOrdinalLine = hasOrdinal ? allLines.findIndex(l => ordinalArticleRegex.test(l.trim())) : Infinity;
  const firstStandardLine = hasStandard ? allLines.findIndex(l => /^\s*\**\s*第[零一二三四五六七八九十百千0-9]+条/.test(l.trim())) : Infinity;
  const isOrdinalFormat = hasOrdinal && (!hasStandard || firstOrdinalLine < firstStandardLine);

  if (isOrdinalFormat) {
    const firstOrdIdx = allLines.findIndex(l => ordinalArticleRegex.test(l.trim()));
    if (firstOrdIdx > 0) {
      preamble = allLines.slice(0, firstOrdIdx).join('\n').trim();
      text = allLines.slice(firstOrdIdx).join('\n');
    }
  } else {
    const trimmedStart = rawContent.trimStart();
    if (trimmedStart.startsWith('(') || trimmedStart.startsWith('(')) {
      const openBracket = trimmedStart[0];
      const closeBracket = openBracket === '(' ? ')' : ')';
      const closeIndex = rawContent.indexOf(closeBracket);
      if (closeIndex !== -1) {
        preamble = rawContent.substring(0, closeIndex + 1).trim();
        text = rawContent.substring(closeIndex + 1).trim();
      }
    }
  }

  const lines = text.split('\n');
  const articles = [];
  let currentChapter = '';
  let currentSection = '';
  let currentArticle = null;

  const chapterRegex = /^\s*(第[零一二三四五六七八九十百千0-9]+章)\s+(.*)/;
  const sectionRegex = /^\s*(第[零一二三四五六七八九十百千0-9]+节)\s+(.*)/;
  const articleRegex = /^\s*\**\s*(第[零一二三四五六七八九十百千0-9]+条)\s*\**\s*(.*)/;
  const pageNumRegex = /^\s*\d+\s*$/;

  const normalizeArticleTitle = (fullTitle) => {
    const match = fullTitle.match(/^第([零一二三四五六七八九十百千0-9]+)条$/);
    return match ? match[1] : fullTitle;
  };

  const itemRegex1 = /^\s*([（(][一二三四五六七八九十]+[）)])\s*(.*)/;
  const itemRegex2 = /^\s*(\d+[.、])\s*(.*)/;
  const itemRegex3 = /^\s*([（(]\d+[）)])\s*(.*)/;
  const isItem = (line) => itemRegex1.test(line) || itemRegex2.test(line) || itemRegex3.test(line);

  const isTerminologyDefinition = (firstLine) => {
    return [/下列用语的含义/, /本法所称/, /本条例所称/, /本规定所称/, /本办法所称/, /本解释所称/].some(p => p.test(firstLine));
  };

  for (const line of lines) {
    const trimLine = line.trim();
    if (!trimLine || pageNumRegex.test(trimLine)) continue;

    const chapMatch = trimLine.match(chapterRegex);
    if (chapMatch) {
      currentChapter = trimLine;
      currentSection = '';
      if (currentArticle) { articles.push(currentArticle); currentArticle = null; }
      continue;
    }

    const secMatch = trimLine.match(sectionRegex);
    if (secMatch) {
      currentSection = trimLine;
      if (currentArticle) { articles.push(currentArticle); currentArticle = null; }
      continue;
    }

    let artMatch = null, articleTitle = '';
    if (isOrdinalFormat) {
      const ordMatch = trimLine.match(ordinalArticleRegex);
      if (ordMatch) { artMatch = ordMatch; articleTitle = ordMatch[1]; }
    } else {
      artMatch = trimLine.match(articleRegex);
      if (artMatch) articleTitle = normalizeArticleTitle(artMatch[1]);
    }

    if (artMatch) {
      if (currentArticle) articles.push(currentArticle);
      const firstLineText = artMatch[2] || '';
      currentArticle = {
        title: articleTitle, chapter: currentChapter || null, section: currentSection || null,
        content: null, paragraphs: [], _firstLineText: firstLineText,
        _isTerminology: isTerminologyDefinition(firstLineText)
      };
      continue;
    }

    if (currentArticle && isItem(trimLine)) {
      let currentParagraph = currentArticle.paragraphs[currentArticle.paragraphs.length - 1];
      if (!currentParagraph) {
        currentParagraph = { number: 1, content: currentArticle._firstLineText || null, items: [], order: 1 };
        currentArticle.paragraphs.push(currentParagraph);
        currentArticle._firstLineText = '';
      }
      const match1 = trimLine.match(itemRegex1);
      const match2 = trimLine.match(itemRegex2);
      const match3 = trimLine.match(itemRegex3);
      let itemNumber = '', itemContent = '';
      if (match1) { itemNumber = match1[1]; itemContent = match1[2]; }
      else if (match2) { itemNumber = match2[1]; itemContent = match2[2]; }
      else if (match3) { itemNumber = match3[1]; itemContent = match3[2]; }
      currentParagraph.items.push({ number: itemNumber, content: itemContent, order: currentParagraph.items.length + 1 });
      continue;
    }

    if (currentArticle && trimLine) {
      if (currentArticle._isTerminology) {
        currentArticle._firstLineText = currentArticle._firstLineText
          ? currentArticle._firstLineText + '\n' + trimLine : trimLine;
        continue;
      }
      if (currentArticle.paragraphs.length > 0) {
        const lastParagraph = currentArticle.paragraphs[currentArticle.paragraphs.length - 1];
        if (lastParagraph.items && lastParagraph.items.length > 0) {
          const n = currentArticle.paragraphs.length + 1;
          currentArticle.paragraphs.push({ number: n, content: trimLine, items: [], order: n });
        } else {
          if (!lastParagraph.content) { lastParagraph.content = trimLine; }
          else {
            const n = currentArticle.paragraphs.length + 1;
            currentArticle.paragraphs.push({ number: n, content: trimLine, items: [], order: n });
          }
        }
      } else {
        if (currentArticle._firstLineText) {
          currentArticle.paragraphs.push({ number: 1, content: currentArticle._firstLineText, items: [], order: 1 });
          currentArticle.paragraphs.push({ number: 2, content: trimLine, items: [], order: 2 });
          currentArticle._firstLineText = '';
        } else {
          currentArticle._firstLineText = trimLine;
        }
      }
    }
  }

  if (currentArticle) articles.push(currentArticle);

  articles.forEach(art => {
    if (art._firstLineText && art.paragraphs.length === 0) {
      art.paragraphs.push({ number: 1, content: art._firstLineText, items: [], order: 1 });
    }
    delete art._firstLineText;
    delete art._isTerminology;
    art.content = null;
  });

  return { articles, preamble, detectedFormat: isOrdinalFormat ? 'ordinal' : 'standard' };
}

// ============ Network helpers ============
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
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(new Error('Invalid JSON response')); }
      });
    });
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}

function httpsReq(method, hostname, reqPath, cookies) {
  return new Promise((resolve, reject) => {
    const h = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://flk.npc.gov.cn/',
      'Accept': '*/*'
    };
    if (cookies) h['Cookie'] = cookies;
    const r = https.request({ hostname, path: reqPath, method, headers: h }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    r.end();
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

let _cookie = null;
async function getCookie() {
  const r = await httpsReq('GET', 'flk.npc.gov.cn', '/law-search/index/aggregateData');
  const sc = r.headers['set-cookie'] || [];
  _cookie = sc.map(c => c.split(';')[0]).join('; ');
  return _cookie;
}

async function getDownloadUrl(bbbs, cookie) {
  const dlPath = '/law-search/download/pc?format=docx&bbbs=' + bbbs + '&fileId=';
  const r = await httpsReq('GET', 'flk.npc.gov.cn', dlPath, cookie);
  try {
    const data = JSON.parse(r.body.toString());
    return data.data?.url || null;
  } catch (e) {
    return null;
  }
}

// ============ Title normalization ============
function normalize(t) {
  return t
    .replace(/<[^>]+>/g, '')
    .replace(/[《》‘’「」【】\s]/g, '')
    .replace(/[“”„‟"]/g, '"')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .replace(/\(试行\)/g, '')
    .trim();
}

// ============ Text processing ============
function stripTitle(rawText) {
  let text = rawText.replace(/​/g, '').trim();
  const lines = text.split('\n');
  let startIdx = 0;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (/^[（(]\d{4}年/.test(lines[i].trim())) { startIdx = i; break; }
  }
  if (startIdx === 0) {
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const t = lines[i].trim();
      if (/^第[零一二三四五六七八九十百千0-9]+条/.test(t) || /^[一二三四五六七八九十]+、/.test(t)) {
        startIdx = i; break;
      }
    }
  }
  return lines.slice(startIdx).join('\n').trim();
}

function detectRevisionType(preambleOrText) {
  if (preambleOrText.includes('修订')) return '修订';
  if (preambleOrText.includes('修正')) return '修正';
  return '公布';
}

// ============ DB operations ============
function insertLaw(db, lawData, articles, preamble, detectedFormat) {
  const insertLawStmt = db.prepare(`
    INSERT INTO Law (title, issuingAuthority, promulgationDate, effectiveDate, status, level, category, region, articleFormat, preamble, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  const insertArticleStmt = db.prepare(`INSERT INTO Article (lawId, chapter, section, title, "order") VALUES (?, ?, ?, ?, ?)`);
  const insertParagraphStmt = db.prepare(`INSERT INTO Paragraph (articleId, number, content, "order") VALUES (?, ?, ?, ?)`);
  const insertItemStmt = db.prepare(`INSERT INTO Item (paragraphId, number, content, "order") VALUES (?, ?, ?, ?)`);

  const txn = db.transaction(() => {
    const promDate = lawData.promulgationDate ? lawData.promulgationDate + 'T00:00:00.000Z' : null;
    const effDate = lawData.effectiveDate ? lawData.effectiveDate + 'T00:00:00.000Z' : null;

    const result = insertLawStmt.run(
      lawData.title,
      lawData.issuingAuthority || null,
      promDate, effDate,
      '现行有效',
      '司法解释',
      '综合监管',
      'national',
      detectedFormat,
      preamble || null
    );

    const lawId = result.lastInsertRowid;

    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      const artResult = insertArticleStmt.run(lawId, art.chapter, art.section, art.title, i + 1);
      const articleId = artResult.lastInsertRowid;

      for (const para of art.paragraphs) {
        const paraResult = insertParagraphStmt.run(articleId, para.number, para.content, para.order);
        const paragraphId = paraResult.lastInsertRowid;

        if (para.items && para.items.length > 0) {
          for (const item of para.items) {
            insertItemStmt.run(paragraphId, item.number, item.content, item.order);
          }
        }
      }
    }

    return lawId;
  });

  return txn();
}

// ============ Phase 1: Fetch all from flk API ============
async function fetchAllFromFlk(cachePath) {
  if (fs.existsSync(cachePath)) {
    console.log('Using cached flk data from', cachePath);
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }

  console.log('Fetching all judicial interpretations from flk.npc.gov.cn...');
  const allRows = [];
  const PAGE_SIZE = 20;

  for (const cat of CATEGORIES) {
    console.log(`\n  Category: ${cat.label} (flfgCodeId=${cat.flfgCodeId})`);
    let page = 1;
    let total = 0;
    let catFetched = 0;

    while (true) {
      const body = {
        searchRange: 1, searchType: 2,
        sxx: [3],
        flfgCodeId: [cat.flfgCodeId],
        searchContent: '', pageNum: page, size: PAGE_SIZE
      };

      const data = await httpsPost('flk.npc.gov.cn', '/law-search/search/list', body);

      if (page === 1) {
        total = data.total;
        console.log(`    Total: ${total}, ${Math.ceil(total / PAGE_SIZE)} pages`);
      }

      if (!data.rows || data.rows.length === 0) break;

      allRows.push(...data.rows);
      catFetched += data.rows.length;
      console.log(`    Page ${page}: +${data.rows.length} (cat: ${catFetched}/${total})`);

      if (catFetched >= total) break;
      page++;
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  fs.writeFileSync(cachePath, JSON.stringify(allRows, null, 2), 'utf-8');
  console.log(`\nSaved ${allRows.length} entries to cache\n`);
  return allRows;
}

// ============ Phase 2: Compare with DB ============
function findMissing(flkRows, db) {
  const allLaws = db.prepare('SELECT id, title FROM Law').all();
  const localNormSet = new Set(allLaws.map(l => normalize(l.title)));

  const existingCount = db.prepare("SELECT COUNT(*) as c FROM Law WHERE level = '司法解释'").get().c;
  console.log(`本地司法解释: ${existingCount}`);

  const flkByNorm = new Map();
  for (const row of flkRows) {
    const norm = normalize(row.title);
    const existing = flkByNorm.get(norm);
    if (!existing || (row.gbrq || '') > (existing.gbrq || '')) {
      flkByNorm.set(norm, row);
    }
  }

  const missing = [];
  const matched = [];

  for (const [norm, row] of flkByNorm) {
    if (localNormSet.has(norm)) {
      matched.push(row.title);
    } else {
      missing.push(row);
    }
  }

  console.log(`\n=== Dedup Results ===`);
  console.log(`国家库 (raw): ${flkRows.length} entries`);
  console.log(`国家库 (deduped): ${flkByNorm.size} unique`);
  console.log(`本地库 (全量): ${allLaws.length} laws`);
  console.log(`匹配: ${matched.length}`);
  console.log(`需要导入: ${missing.length} 部\n`);

  return missing;
}

// ============ Phase 3: Import ============
async function processItem(db, item, cookie, index, total, retries = 0) {
  const tag = `[${index + 1}/${total}]`;

  try {
    const docxUrl = await getDownloadUrl(item.bbbs, cookie);
    if (!docxUrl) {
      console.log(`${tag} SKIP ${item.title} - no download URL`);
      return { status: 'skip', reason: 'no_url' };
    }

    await new Promise(r => setTimeout(r, 500));

    const fileBuf = await httpsGet(docxUrl);

    if (fileBuf.length < 100) {
      console.log(`${tag} SKIP ${item.title} - file too small (${fileBuf.length}b)`);
      return { status: 'skip', reason: 'tiny_file' };
    }

    const isDocx = fileBuf[0] === 0x50 && fileBuf[1] === 0x4B;
    const isDoc = fileBuf[0] === 0xD0 && fileBuf[1] === 0xCF;

    if (!isDocx && !isDoc) {
      if (retries < 2) {
        const waitSec = (retries + 1) * 60;
        console.log(`${tag} WAF detected (unknown format, ${fileBuf.length}b), waiting ${waitSec}s... (retry ${retries + 1})`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        _cookie = await getCookie();
        return processItem(db, item, _cookie, index, total, retries + 1);
      }
      console.log(`${tag} SKIP ${item.title} - unknown format after ${retries} retries (${fileBuf.length}b)`);
      return { status: 'skip', reason: 'unknown_format' };
    }

    let rawText;
    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer: fileBuf });
      rawText = result.value;
    } else {
      const tmpDoc = path.join(os.tmpdir(), `flk_${Date.now()}.doc`);
      const tmpTxt = tmpDoc + '.txt';
      try {
        fs.writeFileSync(tmpDoc, fileBuf);
        execSync(`python "${path.join(__dirname, 'extract-doc-text.py')}" "${tmpDoc}" "${tmpTxt}"`, { timeout: 30000 });
        rawText = fs.readFileSync(tmpTxt, 'utf-8');
      } finally {
        try { fs.unlinkSync(tmpDoc); } catch(e) {}
        try { fs.unlinkSync(tmpTxt); } catch(e) {}
      }
    }

    if (!rawText || rawText.length < 50) {
      console.log(`${tag} SKIP ${item.title} - extracted text too short (${isDoc ? 'doc' : 'docx'})`);
      return { status: 'skip', reason: 'short_text' };
    }

    const content = stripTitle(rawText);
    const parsed = parseContent(content);
    if (parsed.articles.length === 0) {
      console.log(`${tag} SKIP ${item.title} - no articles parsed`);
      return { status: 'skip', reason: 'no_articles' };
    }

    const lawData = {
      title: item.title,
      issuingAuthority: item.zdjgName,
      promulgationDate: item.gbrq,
      effectiveDate: item.sxrq,
    };

    const lawId = insertLaw(db, lawData, parsed.articles, parsed.preamble, parsed.detectedFormat);
    console.log(`${tag} OK ${item.title} -> id=${lawId}, ${parsed.articles.length} articles, ${parsed.detectedFormat}`);

    return { status: 'ok', lawId, articleCount: parsed.articles.length };
  } catch (err) {
    if (retries < 2 && (err.message.includes('307') || err.message.includes('central directory') || err.message.includes('ECONNRESET'))) {
      const waitSec = (retries + 1) * 60;
      console.log(`${tag} WAF/error: ${err.message.substring(0, 60)}, waiting ${waitSec}s... (retry ${retries + 1})`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      _cookie = await getCookie();
      return processItem(db, item, _cookie, index, total, retries + 1);
    }
    console.log(`${tag} FAIL ${item.title} - ${err.message.substring(0, 100)}`);
    return { status: 'fail', error: err.message };
  }
}

// ============ Main ============
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit'));
  const limit = limitArg ? parseInt(args[args.indexOf(limitArg) + 1]) : Infinity;
  const skipFetch = args.includes('--skip-fetch');

  const cachePath = path.join(__dirname, 'data', 'flk-judicial-interpretations.json');

  console.log('=== 司法解释补全 ===');
  console.log(`Categories: ${CATEGORIES.map(c => `${c.label}(${c.flfgCodeId})`).join(', ')}`);
  console.log(`Dry run: ${dryRun}, Limit: ${limit === Infinity ? 'none' : limit}\n`);

  // Phase 1: Fetch
  let flkRows;
  if (skipFetch && fs.existsSync(cachePath)) {
    flkRows = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    console.log(`Loaded ${flkRows.length} cached entries\n`);
  } else {
    flkRows = await fetchAllFromFlk(cachePath);
  }

  // Phase 2: Compare
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const missing = findMissing(flkRows, db);

  if (dryRun) {
    console.log('=== Dry Run - Would import: ===');
    const toImport = missing.slice(0, limit === Infinity ? missing.length : limit);
    for (let i = 0; i < toImport.length; i++) {
      const m = toImport[i];
      console.log(`  ${i + 1}. ${m.title} [${m.zdjgName}] (${m.gbrq})`);
    }
    console.log(`\nTotal: ${toImport.length} to import`);
    db.close();
    return;
  }

  if (missing.length === 0) {
    console.log('Nothing to import!');
    db.close();
    return;
  }

  // Phase 3: Import
  let cookie = await getCookie();
  const total = Math.min(missing.length, limit);
  const results = { ok: 0, skip: 0, fail: 0, details: [] };

  console.log(`\nImporting ${total} judicial interpretations...\n`);

  for (let i = 0; i < total; i++) {
    if (i > 0 && i % 30 === 0) {
      console.log('  Refreshing cookie...');
      cookie = await getCookie();
      await new Promise(r => setTimeout(r, 1000));
    }

    const result = await processItem(db, missing[i], cookie, i, total);
    results[result.status]++;
    results.details.push({ title: missing[i].title, ...result });

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n=== Summary ===');
  console.log(`OK: ${results.ok}, Skip: ${results.skip}, Fail: ${results.fail}`);

  if (results.details.filter(d => d.status === 'fail').length > 0) {
    console.log('\nFailed:');
    results.details.filter(d => d.status === 'fail').forEach(d => console.log(`  - ${d.title}: ${d.error}`));
  }
  if (results.details.filter(d => d.status === 'skip').length > 0) {
    console.log('\nSkipped:');
    results.details.filter(d => d.status === 'skip').forEach(d => console.log(`  - ${d.title}: ${d.reason}`));
  }

  const finalCount = db.prepare("SELECT COUNT(*) as c FROM Law WHERE level = '司法解释'").get().c;
  console.log(`\n司法解释 total after import: ${finalCount}`);

  db.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
