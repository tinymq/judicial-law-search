/**
 * Batch import laws/regs from national law DB (flk.npc.gov.cn)
 * Usage: node scripts/import-from-flk.js [laws|regs|all] [--dry-run] [--limit N]
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'dev.db');
const MISSING_LAWS_PATH = '/tmp/missing_laws.json';
const MISSING_REGS_PATH = '/tmp/missing_regs.json';

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

  const normalizeArticleTitle = (fullTitle) => {
    const match = fullTitle.match(/^第([零一二三四五六七八九十百千0-9]+)条$/);
    return match ? match[1] : fullTitle;
  };

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
      if (/^第[零一二三四五六七八九十百千0-9]+条/.test(t) || /^[一二三四五六七八九��]+、/.test(t)) {
        startIdx = i; break;
      }
    }
  }
  return lines.slice(startIdx).join('\n').trim();
}

function detectRevisionType(preambleOrText) {
  if (preambleOrText.includes('修订')) return '修订'; // 修订
  if (preambleOrText.includes('修正')) return '修正'; // 修正
  return '公布'; // 公布
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

  const txn = db.transaction(() => {
    const promDate = lawData.promulgationDate ? lawData.promulgationDate + 'T00:00:00.000Z' : null;
    const effDate = lawData.effectiveDate ? lawData.effectiveDate + 'T00:00:00.000Z' : null;

    const result = insertLawStmt.run(
      lawData.title,
      lawData.issuingAuthority || null,
      promDate,
      effDate,
      '现行有效', // 现行有效
      lawData.level,
      '综合监管', // 综合监管
      '全国', // 全国
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

// ============ Main ============
async function processItem(db, item, level, cookie, index, total) {
  const tag = `[${index + 1}/${total}]`;

  try {
    // Get download URL
    const docxUrl = await getDownloadUrl(item.bbbs, cookie);
    if (!docxUrl) {
      console.log(`${tag} SKIP ${item.title} - no download URL`);
      return { status: 'skip', reason: 'no_url' };
    }

    await new Promise(r => setTimeout(r, 300));

    // Download docx
    const docxBuf = await httpsGet(docxUrl);
    if (docxBuf.length < 100) {
      console.log(`${tag} SKIP ${item.title} - docx too small (${docxBuf.length}b)`);
      return { status: 'skip', reason: 'tiny_docx' };
    }

    // Extract text
    const result = await mammoth.extractRawText({ buffer: docxBuf });
    const rawText = result.value;
    if (!rawText || rawText.length < 50) {
      console.log(`${tag} SKIP ${item.title} - extracted text too short`);
      return { status: 'skip', reason: 'short_text' };
    }

    // Strip title/header
    const content = stripTitle(rawText);

    // Parse
    const parsed = parseContent(content);
    if (parsed.articles.length === 0) {
      console.log(`${tag} SKIP ${item.title} - no articles parsed`);
      return { status: 'skip', reason: 'no_articles' };
    }

    // Determine title with year marker
    const revisionType = detectRevisionType(parsed.preamble || content.substring(0, 200));
    const year = item.promulgationDate ? item.promulgationDate.substring(0, 4) : '';
    const titleWithYear = year ? `${item.title}(${year}年${revisionType})` : item.title;

    // Insert into DB
    const lawData = {
      title: titleWithYear,
      issuingAuthority: item.issuingAuthority,
      promulgationDate: item.promulgationDate,
      effectiveDate: item.effectiveDate,
      level: level
    };

    const lawId = insertLaw(db, lawData, parsed.articles, parsed.preamble, parsed.detectedFormat);
    console.log(`${tag} OK ${titleWithYear} -> id=${lawId}, ${parsed.articles.length} articles, ${parsed.detectedFormat}`);

    return { status: 'ok', lawId, articleCount: parsed.articles.length };
  } catch (err) {
    console.log(`${tag} FAIL ${item.title} - ${err.message.substring(0, 100)}`);
    return { status: 'fail', error: err.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(a => !a.startsWith('--')) || 'all';
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit'));
  const limit = limitArg ? parseInt(args[args.indexOf(limitArg) + 1]) : Infinity;

  console.log(`Mode: ${mode}, Dry run: ${dryRun}, Limit: ${limit === Infinity ? 'none' : limit}`);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  let cookie = await getCookie();

  const results = { ok: 0, skip: 0, fail: 0, details: [] };

  async function processBatch(items, level) {
    const total = Math.min(items.length, limit);
    console.log(`\nProcessing ${total} ${level} items...`);

    for (let i = 0; i < total; i++) {
      // Refresh cookie every 30 items
      if (i > 0 && i % 30 === 0) {
        console.log('  Refreshing cookie...');
        cookie = await getCookie();
        await new Promise(r => setTimeout(r, 1000));
      }

      const result = await processItem(db, items[i], level, cookie, i, total);
      results[result.status]++;
      results.details.push({ title: items[i].title, ...result });

      // Rate limit
      await new Promise(r => setTimeout(r, 800));
    }
  }

  if (mode === 'laws' || mode === 'all') {
    if (fs.existsSync(MISSING_LAWS_PATH)) {
      const missingLaws = JSON.parse(fs.readFileSync(MISSING_LAWS_PATH, 'utf-8'));
      await processBatch(missingLaws, '法律'); // 法律
    } else {
      console.log('Missing laws file not found:', MISSING_LAWS_PATH);
    }
  }

  if (mode === 'regs' || mode === 'all') {
    if (fs.existsSync(MISSING_REGS_PATH)) {
      const missingRegs = JSON.parse(fs.readFileSync(MISSING_REGS_PATH, 'utf-8'));
      await processBatch(missingRegs, '行政法规'); // 行政法规
    } else {
      console.log('Missing regs file not found:', MISSING_REGS_PATH);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`OK: ${results.ok}, Skip: ${results.skip}, Fail: ${results.fail}`);

  const failedItems = results.details.filter(d => d.status === 'fail');
  if (failedItems.length > 0) {
    console.log('\nFailed items:');
    failedItems.forEach(d => console.log(`  - ${d.title}: ${d.error}`));
  }

  const skippedItems = results.details.filter(d => d.status === 'skip');
  if (skippedItems.length > 0) {
    console.log('\nSkipped items:');
    skippedItems.forEach(d => console.log(`  - ${d.title}: ${d.reason}`));
  }

  db.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
