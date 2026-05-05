/**
 * 导入4条缺失法规（P3）
 * Usage: node scripts/import-missing-4.js
 */
const https = require('https');
const mammoth = require('mammoth');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'dev.db');

function httpsReq(method, hostname, reqPath) {
  return new Promise((resolve, reject) => {
    const h = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://flk.npc.gov.cn/',
      'Accept': '*/*'
    };
    const r = https.request({ hostname, path: reqPath, method, headers: h }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

function parseContent(rawContent) {
  let preamble = '';
  let text = rawContent;

  const ordinalRegex = /^\s*([一二三四五六七八九十]+)、\s*(.*)/;
  const allLines = rawContent.split('\n');
  const hasOrdinal = allLines.some(l => ordinalRegex.test(l.trim()));
  const hasStandard = allLines.some(l => /^\s*\**\s*第[零一二三四五六七八九十百千0-9]+条/.test(l.trim()));
  const isOrdinal = hasOrdinal && !hasStandard;

  // Extract preamble
  const trimmedStart = rawContent.trimStart();
  if (trimmedStart.startsWith('（') || trimmedStart.startsWith('(')) {
    const closeBracket = trimmedStart[0] === '（' ? '）' : ')';
    const closeIndex = rawContent.indexOf(closeBracket);
    if (closeIndex !== -1) {
      preamble = rawContent.substring(0, closeIndex + 1).trim();
      text = rawContent.substring(closeIndex + 1).trim();
    }
  }

  if (isOrdinal) {
    const firstIdx = allLines.findIndex(l => ordinalRegex.test(l.trim()));
    if (firstIdx > 0) preamble = allLines.slice(0, firstIdx).join('\n').trim();
    const articles = [];
    let current = null, order = 0;
    for (const line of allLines.slice(firstIdx >= 0 ? firstIdx : 0)) {
      const m = line.trim().match(ordinalRegex);
      if (m) {
        if (current) articles.push(current);
        current = { chapter: '', section: '', title: m[1] + '、', content: m[2], order: order++ };
      } else if (line.trim() && current) {
        current.content += '\n' + line.trim();
      }
    }
    if (current) articles.push(current);
    return { articles, preamble, detectedFormat: 'ordinal' };
  }

  const lines = text.split('\n');
  const articles = [];
  let currentChapter = '', currentSection = '', currentArticle = null, order = 0;
  const chapterRegex = /^\s*(第[零一二三四五六七八九十百千0-9]+章)\s+(.*)/;
  const sectionRegex = /^\s*(第[零一二三四五六七八九十百千0-9]+节)\s+(.*)/;
  const articleRegex = /^\s*\**\s*(第[零一二三四五六七八九十百千0-9]+条)\s*\**\s*(.*)/;

  for (const line of lines) {
    const trimLine = line.trim();
    if (!trimLine || /^\s*\d+\s*$/.test(trimLine)) continue;

    const chapMatch = trimLine.match(chapterRegex);
    if (chapMatch) {
      currentChapter = trimLine; currentSection = '';
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
      currentArticle = { chapter: currentChapter, section: currentSection, title: artMatch[1], content: artMatch[2] || '', order: order++ };
      continue;
    }
    if (currentArticle) {
      currentArticle.content += (currentArticle.content ? '\n' : '') + trimLine;
    }
  }
  if (currentArticle) articles.push(currentArticle);
  return { articles, preamble, detectedFormat: 'standard' };
}

const items = [
  {
    title: '全国人民代表大会常务委员会关于《中华人民共和国香港特别行政区维护国家安全法》第十四条和第四十七条的解释',
    bbbs: 'ff808181855675b3018562fae41706b0',
    gbrq: '2022-12-30',
    zdjgName: '全国人民代表大会常务委员会',
    level: '法律解释'
  },
  {
    title: '城市民族工作条例',
    bbbs: 'ff8080816f3cbb3c016f410dd25113f9',
    gbrq: '1993-09-15',
    zdjgName: '国务院',
    level: '行政法规'
  },
  {
    title: '森林和野生动物类型自然保护区管理办法',
    bbbs: 'ff8080816f3cbb3c016f41032dff1161',
    gbrq: '1985-07-06',
    zdjgName: '国务院',
    level: '行政法规'
  },
  {
    title: '全国中小学勤工俭学暂行工作条例',
    bbbs: 'ff8080816f3cbb3c016f40e5fdb309e4',
    gbrq: '1983-02-20',
    zdjgName: '国务院',
    level: '行政法规'
  },
];

(async () => {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const insertLaw = db.prepare(
    `INSERT INTO Law (title, issuingAuthority, promulgationDate, status, level, region, preamble, createdAt, updatedAt)
     VALUES (?, ?, ?, '现行有效', ?, '全国', ?, datetime('now'), datetime('now'))`
  );
  const insertArticle = db.prepare(
    `INSERT INTO Article (lawId, chapter, section, title, "order") VALUES (?, ?, ?, ?, ?)`
  );
  const insertParagraph = db.prepare(
    `INSERT INTO Paragraph (articleId, number, content, "order") VALUES (?, ?, ?, ?)`
  );

  const results = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n[${i + 1}/${items.length}] ${item.title}`);

    try {
      const dlPath = '/law-search/download/pc?format=docx&bbbs=' + item.bbbs + '&fileId=';
      const dlResp = await httpsReq('GET', 'flk.npc.gov.cn', dlPath);
      const dlData = JSON.parse(dlResp.body.toString());
      const docxUrl = dlData.data && dlData.data.url;
      if (!docxUrl) {
        console.log('  SKIP: no download URL');
        results.push({ title: item.title, status: 'skip', reason: 'no_url' });
        continue;
      }

      await sleep(500);

      const docxBuf = await httpsGet(docxUrl);
      console.log('  Downloaded:', docxBuf.length, 'bytes');

      const extracted = await mammoth.extractRawText({ buffer: docxBuf });
      const rawText = extracted.value;
      if (!rawText || rawText.length < 20) {
        console.log('  SKIP: text too short');
        results.push({ title: item.title, status: 'skip', reason: 'short_text' });
        continue;
      }

      const content = stripTitle(rawText);
      const parsed = parseContent(content);
      console.log('  Parsed:', parsed.articles.length, 'articles,', parsed.detectedFormat);

      const year = item.gbrq ? item.gbrq.substring(0, 4) : '';
      const fullTitle = year ? `${item.title}(${year}年公布)` : item.title;
      const promDate = item.gbrq ? new Date(item.gbrq).getTime() : null;

      const txn = db.transaction(() => {
        const lawResult = insertLaw.run(fullTitle, item.zdjgName, promDate, item.level, parsed.preamble || null);
        const lawId = Number(lawResult.lastInsertRowid);

        for (const art of parsed.articles) {
          const artResult = insertArticle.run(lawId, art.chapter || null, art.section || null, art.title, art.order);
          const artId = Number(artResult.lastInsertRowid);
          if (art.content) {
            insertParagraph.run(artId, '1', art.content, 0);
          }
        }
        return lawId;
      });

      const lawId = txn();
      console.log(`  OK: id=${lawId}, ${fullTitle}`);
      results.push({ title: fullTitle, status: 'ok', lawId, articles: parsed.articles.length });

    } catch (e) {
      console.log('  FAIL:', e.message.substring(0, 150));
      results.push({ title: item.title, status: 'fail', error: e.message.substring(0, 100) });
    }

    await sleep(1000);
  }

  db.close();
  console.log('\n=== Results ===');
  results.forEach(r => console.log(`${r.status === 'ok' ? '✅' : '❌'} ${r.title} ${r.status === 'ok' ? 'id=' + r.lawId + ' (' + r.articles + ' articles)' : r.reason || r.error || ''}`));
})();
