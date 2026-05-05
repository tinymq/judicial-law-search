/**
 * Import 17 missing "修改、废止的决定" from flk.npc.gov.cn (flfgCodeId=200)
 * These are decisions that modify/abolish existing laws.
 * Usage: node scripts/import-modification-decisions.js [--dry-run]
 */
const https = require('https');
const path = require('path');
const mammoth = require('mammoth');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'dev.db');
const DRY_RUN = process.argv.includes('--dry-run');

// ============ Network ============
function httpsPost(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'flk.npc.gov.cn',
      path: '/law-search/search/list',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://flk.npc.gov.cn/',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('Parse error: ' + d.substring(0, 300))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
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
  } catch (e) { return null; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ============ Content parsing ============
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
    if (trimmedStart.startsWith('（') || trimmedStart.startsWith('(')) {
      const openBracket = trimmedStart[0];
      const closeBracket = openBracket === '（' ? '）' : ')';
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

  const itemRegex1 = /^\s*([（(][一二三四五六七八九十]+[）)])\s*(.*)/;
  const itemRegex2 = /^\s*(\d+[.、])\s*(.*)/;
  const itemRegex3 = /^\s*([（(]\d+[）)])\s*(.*)/;
  const isItem = (line) => itemRegex1.test(line) || itemRegex2.test(line) || itemRegex3.test(line);

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

    const artMatch = trimLine.match(articleRegex);
    if (artMatch) {
      if (currentArticle) articles.push(currentArticle);
      currentArticle = {
        chapter: currentChapter || null,
        section: currentSection || null,
        title: artMatch[1],
        paragraphs: [],
        _firstLineText: artMatch[2] || '',
        _isTerminology: false
      };
      continue;
    }

    if (isOrdinalFormat) {
      const ordMatch = trimLine.match(ordinalArticleRegex);
      if (ordMatch) {
        if (currentArticle) articles.push(currentArticle);
        currentArticle = {
          chapter: currentChapter || null,
          section: currentSection || null,
          title: ordMatch[1],
          paragraphs: [{ number: 1, content: ordMatch[2], items: [], order: 1 }],
          _firstLineText: '',
          _isTerminology: false
        };
        continue;
      }
    }

    if (currentArticle) {
      if (currentArticle.paragraphs.length > 0 || currentArticle._firstLineText) {
        if (isItem(trimLine)) {
          const lastParagraph = currentArticle.paragraphs[currentArticle.paragraphs.length - 1] ||
            { number: 1, content: currentArticle._firstLineText || '', items: [], order: 1 };
          if (currentArticle.paragraphs.length === 0) {
            currentArticle.paragraphs.push(lastParagraph);
            currentArticle._firstLineText = '';
          }
          const m = trimLine.match(itemRegex1) || trimLine.match(itemRegex2) || trimLine.match(itemRegex3);
          lastParagraph.items.push({
            number: m[1],
            content: m[2],
            order: lastParagraph.items.length + 1
          });
        } else {
          if (currentArticle._firstLineText) {
            currentArticle.paragraphs.push({ number: 1, content: currentArticle._firstLineText, items: [], order: 1 });
            currentArticle.paragraphs.push({ number: 2, content: trimLine, items: [], order: 2 });
            currentArticle._firstLineText = '';
          } else {
            const n = currentArticle.paragraphs.length + 1;
            currentArticle.paragraphs.push({ number: n, content: trimLine, items: [], order: n });
          }
        }
      } else {
        currentArticle._firstLineText = trimLine;
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

// ============ DB operations ============
function insertLaw(db, lawData, articles, preamble, detectedFormat) {
  const insertLawStmt = db.prepare(`
    INSERT INTO Law (title, issuingAuthority, promulgationDate, effectiveDate, status, level, category, region, articleFormat, preamble, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  const insertArticleStmt = db.prepare(`
    INSERT INTO Article (lawId, chapter, section, title, "order")
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertParagraphStmt = db.prepare(`
    INSERT INTO Paragraph (articleId, number, content, "order")
    VALUES (?, ?, ?, ?)
  `);
  const insertItemStmt = db.prepare(`
    INSERT INTO Item (paragraphId, number, content, "order")
    VALUES (?, ?, ?, ?)
  `);

  const result = insertLawStmt.run(
    lawData.title, lawData.issuingAuthority, lawData.promulgationDate,
    lawData.effectiveDate, lawData.status, lawData.level,
    lawData.category, lawData.region, detectedFormat, preamble || null
  );
  const lawId = result.lastInsertRowid;

  let artOrder = 0;
  for (const art of articles) {
    artOrder++;
    const artResult = insertArticleStmt.run(
      lawId, art.chapter, art.section, art.title, artOrder
    );
    const artId = artResult.lastInsertRowid;
    for (const para of art.paragraphs) {
      const paraResult = insertParagraphStmt.run(artId, para.number, para.content, para.order);
      const paraId = paraResult.lastInsertRowid;
      for (const item of (para.items || [])) {
        insertItemStmt.run(paraId, item.number, item.content, item.order);
      }
    }
  }

  return { lawId, articleCount: artOrder };
}

// ============ Title matching ============
function normalize(t) {
  return t.replace(/[\(（]\d{4}年[^)）]*[\)）]/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
}

// ============ Main ============
(async () => {
  console.log('=== 导入修改、废止的决定 (flfgCodeId=200) ===');
  if (DRY_RUN) console.log('[DRY RUN MODE]');

  // 1. Fetch all 28 items from national library
  console.log('\n1. 获取国家库 flfgCodeId=200 全部条目...');
  const page1 = await httpsPost({ searchRange: 1, searchType: 2, flfgCodeId: [200], searchContent: '', pageNum: 1, size: 20 });
  await sleep(1200);
  const page2 = await httpsPost({ searchRange: 1, searchType: 2, flfgCodeId: [200], searchContent: '', pageNum: 2, size: 20 });
  const allNational = [...page1.rows, ...page2.rows];
  console.log('   获取到 ' + allNational.length + ' 条');

  // 2. Match against existing DB
  const db = new Database(DB_PATH);
  const existingDecisions = db.prepare(`SELECT id, title FROM Law WHERE level = '有关法律问题和重大问题的决定'`).all();
  const existingLaws = db.prepare(`SELECT id, title FROM Law WHERE level = '法律'`).all();
  const allExisting = [...existingDecisions, ...existingLaws];
  const existingNorms = allExisting.map(r => ({ id: r.id, title: r.title, norm: normalize(r.title) }));

  const toImport = [];
  const alreadyExists = [];

  for (const item of allNational) {
    const norm = normalize(item.title);
    // Strict matching: exact match or very close (same core title)
    const found = existingNorms.find(e => {
      if (e.norm === norm) return true;
      // Only match if lengths are within 20% of each other (prevent law matching its modification decision)
      const lenRatio = Math.min(e.norm.length, norm.length) / Math.max(e.norm.length, norm.length);
      if (lenRatio < 0.7) return false;
      return e.norm.includes(norm) || norm.includes(e.norm);
    });
    if (found) {
      alreadyExists.push({ national: item.title, dbId: found.id, dbTitle: found.title });
    } else {
      toImport.push(item);
    }
  }

  console.log('   已存在: ' + alreadyExists.length + ' 条');
  console.log('   需导入: ' + toImport.length + ' 条');

  if (toImport.length === 0) {
    console.log('无需导入，退出。');
    db.close();
    return;
  }

  // 3. Get cookie for downloads
  console.log('\n2. 获取下载cookie...');
  const cookie = await getCookie();
  console.log('   Cookie: ' + (cookie ? '✅' : '❌'));

  // 4. Import each
  console.log('\n3. 开始导入...');
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < toImport.length; i++) {
    const item = toImport[i];
    const title = item.title.replace(/<[^>]+>/g, '');
    const gbrq = item.gbrq;
    const sxrq = item.sxrq;
    const zdjgName = item.zdjgName || '';

    // Build title with year
    const year = gbrq ? gbrq.substring(0, 4) : '';
    const fullTitle = title + (year ? '(' + year + '年公布)' : '');

    console.log('\n[' + (i + 1) + '/' + toImport.length + '] ' + fullTitle);

    // Download docx
    await sleep(1500);
    const dlUrl = await getDownloadUrl(item.bbbs, cookie);

    let articles = [];
    let preamble = '';
    let detectedFormat = 'standard';
    let articleCount = 0;

    if (dlUrl) {
      try {
        await sleep(1000);
        const docxBuf = await httpsGet(dlUrl);
        const result = await mammoth.extractRawText({ buffer: docxBuf });
        const rawText = result.value;
        const stripped = stripTitle(rawText);

        if (stripped.length > 20) {
          const parsed = parseContent(stripped);
          articles = parsed.articles;
          preamble = parsed.preamble;
          detectedFormat = parsed.detectedFormat;
          articleCount = articles.length;
        }
        console.log('   下载+解析: ' + articleCount + '条, 格式=' + detectedFormat);
      } catch (e) {
        console.log('   下载/解析失败: ' + e.message);
      }
    } else {
      console.log('   无下载链接');
    }

    if (DRY_RUN) {
      console.log('   [DRY RUN] 跳过写入');
      continue;
    }

    // Insert into DB
    try {
      const lawData = {
        title: fullTitle,
        issuingAuthority: zdjgName,
        promulgationDate: gbrq ? new Date(gbrq).getTime() : null,
        effectiveDate: sxrq ? new Date(sxrq).getTime() : null,
        status: '现行有效',
        level: '有关法律问题和重大问题的决定',
        category: '综合监管',
        region: '全国'
      };

      // If no articles parsed, store entire content as a single article
      if (articles.length === 0 && preamble) {
        articles = [{
          chapter: null,
          section: null,
          title: '全文',
          content: null,
          paragraphs: [{ number: 1, content: preamble, items: [], order: 1 }]
        }];
        preamble = '';
      }

      const { lawId, articleCount: artCount } = insertLaw(db, lawData, articles, preamble, detectedFormat);
      console.log('   ✅ 导入成功 ID=' + lawId + ', ' + artCount + '条');
      imported++;
    } catch (e) {
      console.log('   ❌ 写入失败: ' + e.message);
      failed++;
    }
  }

  db.close();

  console.log('\n=== 完成 ===');
  console.log('已存在: ' + alreadyExists.length);
  console.log('新导入: ' + imported);
  console.log('失败: ' + failed);
})();
