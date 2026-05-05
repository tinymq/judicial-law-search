const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'dev.db'));
const CACHE_FILE = path.join(__dirname, 'data', 'guizhangku-cache.json');

// ============================================================
// Text parser (same as import-jiangsu-gov-regs.js)
// ============================================================

function parseFullText(text) {
  if (!text) return [];
  const cleaned = text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

  const CN = '一二三四五六七八九十百千';
  const segmentRe = new RegExp(`(第[${CN}\\d]+章|第[${CN}\\d]+节|第[${CN}\\d]+条)`, 'g');

  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = segmentRe.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: cleaned.substring(lastIndex, match.index).trim() });
    }
    segments.push({ type: 'marker', marker: match[1] });
    lastIndex = match.index + match[1].length;
  }
  if (lastIndex < cleaned.length) {
    segments.push({ type: 'text', content: cleaned.substring(lastIndex).trim() });
  }

  const articles = [];
  let currentChapter = null;
  let currentSection = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type !== 'marker') continue;

    const marker = seg.marker;
    const nextText = (i + 1 < segments.length && segments[i + 1].type === 'text')
      ? segments[i + 1].content : '';

    if (/^第[一二三四五六七八九十百千\d]+章$/.test(marker)) {
      currentChapter = marker + (nextText ? ' ' + nextText : '');
      currentSection = null;
      continue;
    }
    if (/^第[一二三四五六七八九十百千\d]+节$/.test(marker)) {
      currentSection = marker + (nextText ? ' ' + nextText : '');
      continue;
    }
    if (/^第[一二三四五六七八九十百千\d]+条$/.test(marker)) {
      const art = { chapter: currentChapter, section: currentSection, title: marker, content: '', paragraphs: [] };
      if (nextText) parseArticleContent(nextText, art);
      articles.push(art);
    }
  }
  return articles;
}

function parseArticleContent(text, article) {
  const parts = text.split(/(?=[（(][一二三四五六七八九十]+[)）])/);
  const leadText = [];
  const items = [];

  for (const part of parts) {
    const itemMatch = part.match(/^[（(]([一二三四五六七八九十]+)[)）]\s*([\s\S]*)/);
    if (itemMatch) {
      items.push({ number: itemMatch[1], content: itemMatch[2].trim() });
    } else {
      const t = part.trim();
      if (t) leadText.push(t);
    }
  }

  if (items.length > 0) {
    article.paragraphs.push({ content: leadText.join(''), items });
  } else {
    article.paragraphs.push({ content: text, items: [] });
  }
}

// ============================================================
// Metadata extraction
// ============================================================

function cleanTitle(raw) {
  return raw.replace(/<[^>]+>/g, '').trim();
}

function extractDocNumber(pubInfo) {
  if (!pubInfo) return null;
  const clean = pubInfo.replace(/<[^>]+>/g, '');
  const patterns = [
    /([^\s（(]{2,}(?:令|发|函|办|规)\s*第?\s*\d+\s*号)/,
    /([^\s（(]+〔\d{4}〕\d+号)/,
    /([^\s（(]+\[\d{4}\]\d+号)/,
  ];
  for (const pat of patterns) {
    const m = clean.match(pat);
    if (m) return m[1].trim();
  }
  return null;
}

function extractEffectiveDate(pubInfo) {
  if (!pubInfo) return null;
  const m = pubInfo.match(/自(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T00:00:00.000Z`;
  return null;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`;
  return null;
}

function extractPreamble(text) {
  if (!text) return null;
  const cleaned = text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const articleRe = /第[一二三四五六七八九十百千\d]+条/;
  const chapterRe = /第[一二三四五六七八九十百千\d]+章/;
  const idx1 = cleaned.search(articleRe);
  const idx2 = cleaned.search(chapterRe);
  let splitIdx = -1;
  if (idx1 >= 0 && idx2 >= 0) splitIdx = Math.min(idx1, idx2);
  else if (idx1 >= 0) splitIdx = idx1;
  else if (idx2 >= 0) splitIdx = idx2;
  if (splitIdx <= 10) return null;
  const preamble = cleaned.substring(0, splitIdx).trim();
  return preamble.length > 10 ? preamble : null;
}

function normalizeForDedup(title) {
  return title
    .replace(/<[^>]+>/g, '')
    .replace(/\([^)]*\d{4}[^)]*\)/g, '')
    .replace(/（[^）]*\d{4}[^）]*）/g, '')
    .replace(/\(试行\)/g, '').replace(/（试行）/g, '')
    .replace(/[《》\s]/g, '')
    .trim();
}

function main() {
  console.log('='.repeat(60));
  console.log('步骤5: 从本地缓存导入部门规章');
  console.log('='.repeat(60));

  console.log('加载缓存...');
  const records = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  console.log(`缓存记录: ${records.length} 条`);

  // Build dedup set from existing DB
  const existingSet = new Set();
  const existingLaws = db.prepare("SELECT title FROM Law").all();
  for (const l of existingLaws) {
    existingSet.add(normalizeForDedup(l.title));
  }
  console.log(`数据库现有标题(去重): ${existingSet.size}`);

  const insertLaw = db.prepare(`
    INSERT INTO Law (title, issuingAuthority, documentNumber, preamble,
      promulgationDate, effectiveDate, status, level, category, region,
      articleFormat, scope, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, '现行有效', '部门规章', '行政执法', '全国',
      'structured', 'national', datetime('now'), datetime('now'))
  `);
  const insertArticle = db.prepare(`
    INSERT INTO Article (lawId, chapter, section, title, "order")
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertParagraph = db.prepare(`
    INSERT INTO Paragraph (articleId, number, content, "order")
    VALUES (?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO Item (paragraphId, number, content, "order")
    VALUES (?, ?, ?, ?)
  `);

  let imported = 0, skipped = 0, noText = 0, parseErrors = 0;

  const transaction = db.transaction(() => {
    for (const record of records) {
      const rawTitle = cleanTitle(record.f_202321360426 || '');
      if (!rawTitle) continue;

      const normTitle = normalizeForDedup(rawTitle);
      if (existingSet.has(normTitle)) {
        skipped++;
        continue;
      }

      const fullText = record.f_202321758948 || '';
      if (!fullText || fullText.length < 50) {
        noText++;
        continue;
      }

      const authority = (record.f_202323394765 || record.f_202355832506 || record.f_202328191239 || '').replace(/<[^>]+>/g, '').trim() || null;
      const pubInfo = (record.f_202344311304 || '').replace(/<[^>]+>/g, '');
      const docNumber = extractDocNumber(pubInfo);
      const effDate = extractEffectiveDate(pubInfo);
      const promDate = parseDate(record.f_202321915922);
      const preamble = extractPreamble(fullText);

      const articles = parseFullText(fullText);
      if (articles.length === 0) {
        parseErrors++;
        continue;
      }

      const result = insertLaw.run(
        rawTitle, authority, docNumber, preamble,
        promDate, effDate
      );
      const lawId = result.lastInsertRowid;

      let artOrder = 0;
      for (const art of articles) {
        artOrder++;
        const artResult = insertArticle.run(
          lawId, art.chapter || null, art.section || null, art.title, artOrder
        );
        const articleId = artResult.lastInsertRowid;

        if (art.paragraphs.length === 0 && art.content) {
          insertParagraph.run(articleId, 1, art.content, 1);
        }

        if (art.paragraphs.length > 0) {
          let paraOrder = 0;
          for (const para of art.paragraphs) {
            paraOrder++;
            const paraResult = insertParagraph.run(
              articleId, paraOrder, para.content || '', paraOrder
            );
            const paragraphId = paraResult.lastInsertRowid;
            let itemOrder = 0;
            for (const item of para.items) {
              itemOrder++;
              insertItem.run(paragraphId, item.number, item.content, itemOrder);
            }
          }
        }
      }

      imported++;
      existingSet.add(normTitle);
      if (imported % 200 === 0) console.log(`  进度: ${imported} 已导入`);
    }
  });

  transaction();

  console.log('\n' + '='.repeat(60));
  console.log('结果');
  console.log('='.repeat(60));
  console.log(`导入: ${imported}`);
  console.log(`跳过(已存在): ${skipped}`);
  console.log(`无全文: ${noText}`);
  console.log(`解析失败: ${parseErrors}`);

  const total = db.prepare("SELECT COUNT(*) as c FROM Law").get().c;
  const deptRegs = db.prepare("SELECT COUNT(*) as c FROM Law WHERE level = '部门规章'").get().c;
  console.log(`\n数据库法规总量: ${total}`);
  console.log(`部门规章总量: ${deptRegs}`);

  db.close();
}

main();
