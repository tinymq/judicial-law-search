/**
 * Import 3 pending laws (尚未生效) from flk.npc.gov.cn
 * - 民用航空法 (2025修订) -> old id=3008 marked as 已被修改
 * - 供水条例 (2026) -> old id=799 marked as 已被修改
 * - 药品管理法实施条例 (2026) -> old id=80 marked as 已被修改
 */
const https = require('https');
const path = require('path');
const mammoth = require('mammoth');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'dev.db');

const TARGETS = [
  {
    bbbs: '7ee5a369049e412bbd1a96a2fef74abb',
    title: '中华人民共和国民用航空法',
    promulgationDate: '2025-12-27',
    effectiveDate: '2026-07-01',
    level: '法律',
    issuingAuthority: '全国人民代表大会常务委员会',
    oldId: 3008,
    category: '综合监管'
  },
  {
    bbbs: 'ff8081819c46f9bb019c938759470be9',
    title: '供水条例',
    promulgationDate: '2026-02-11',
    effectiveDate: '2026-06-01',
    level: '行政法规',
    issuingAuthority: '国务院',
    oldId: 799,
    category: '综合监管'
  },
  {
    bbbs: 'ff8081819c230ff2019c2b63faec40bf',
    title: '中华人民共和国药品管理法实施条例',
    promulgationDate: '2026-01-16',
    effectiveDate: '2026-05-15',
    level: '行政法规',
    issuingAuthority: '国务院',
    oldId: 80,
    category: '综合监管'
  }
];

// ============ parseContent ============
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

  const isTerminologyDefinition = (firstLine) => {
    return [/下列用语的含义/, /本法所称/, /本条例所称/, /本规定所称/, /本办法所称/].some(p => p.test(firstLine));
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
      if (artMatch) {
        const m = artMatch[1].match(/^第([零一二三四五六七八九十百千0-9]+)条$/);
        articleTitle = m ? m[1] : artMatch[1];
      }
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

// ============ Network ============
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

async function getCookie() {
  const r = await httpsReq('GET', 'flk.npc.gov.cn', '/law-search/index/aggregateData');
  const sc = r.headers['set-cookie'] || [];
  return sc.map(c => c.split(';')[0]).join('; ');
}

async function getDownloadUrl(bbbs, cookie) {
  const dlPath = '/law-search/download/pc?format=docx&bbbs=' + bbbs + '&fileId=';
  const r = await httpsReq('GET', 'flk.npc.gov.cn', dlPath, cookie);
  try {
    const data = JSON.parse(r.body.toString());
    return data.data?.url || null;
  } catch (e) { return null; }
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

// ============ Main ============
async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const cookie = await getCookie();
  console.log('Cookie obtained');

  const insertLawStmt = db.prepare(`
    INSERT INTO Law (title, issuingAuthority, promulgationDate, effectiveDate, status, level, category, region, articleFormat, preamble, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  const insertArticleStmt = db.prepare(`INSERT INTO Article (lawId, chapter, section, title, "order") VALUES (?, ?, ?, ?, ?)`);
  const insertParagraphStmt = db.prepare(`INSERT INTO Paragraph (articleId, number, content, "order") VALUES (?, ?, ?, ?)`);
  const insertItemStmt = db.prepare(`INSERT INTO Item (paragraphId, number, content, "order") VALUES (?, ?, ?, ?)`);
  const updateStatusStmt = db.prepare(`UPDATE Law SET status = '已被修改', updatedAt = datetime('now') WHERE id = ?`);

  for (const target of TARGETS) {
    console.log(`\n--- Processing: ${target.title} ---`);

    const docxUrl = await getDownloadUrl(target.bbbs, cookie);
    if (!docxUrl) { console.log('  FAIL: no download URL'); continue; }
    await new Promise(r => setTimeout(r, 1000));

    const docxBuf = await httpsGet(docxUrl);
    console.log(`  Downloaded: ${docxBuf.length} bytes`);

    const result = await mammoth.extractRawText({ buffer: docxBuf });
    const rawText = result.value;
    if (!rawText || rawText.length < 50) { console.log('  FAIL: text too short'); continue; }

    const content = stripTitle(rawText);
    const parsed = parseContent(content);
    if (parsed.articles.length === 0) { console.log('  FAIL: no articles parsed'); continue; }

    const year = target.promulgationDate.substring(0, 4);
    const revType = parsed.preamble.includes('修订') ? '修订' : (parsed.preamble.includes('修正') ? '修正' : '公布');
    const titleWithYear = `${target.title}(${year}年${revType})`;

    const txn = db.transaction(() => {
      const lawResult = insertLawStmt.run(
        titleWithYear,
        target.issuingAuthority,
        target.promulgationDate + 'T00:00:00.000Z',
        target.effectiveDate + 'T00:00:00.000Z',
        '尚未生效',
        target.level,
        target.category,
        '全国',
        parsed.detectedFormat,
        parsed.preamble || null
      );
      const lawId = lawResult.lastInsertRowid;

      for (let i = 0; i < parsed.articles.length; i++) {
        const art = parsed.articles[i];
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

      updateStatusStmt.run(target.oldId);
      return lawId;
    });

    const newId = txn();
    console.log(`  OK: ${titleWithYear} -> id=${newId}, ${parsed.articles.length} articles`);
    console.log(`  Old version id=${target.oldId} -> 已被修改`);

    await new Promise(r => setTimeout(r, 1500));
  }

  db.close();
  console.log('\nDone!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
