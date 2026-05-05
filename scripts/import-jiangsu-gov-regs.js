const path = require('path');
const fs = require('fs');
const https = require('https');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'dev.db'));
const CACHE_FILE = path.join(__dirname, 'data', 'jiangsu-gov-regs-cache.json');
const ATHENA_URL = 'https://sousuoht.www.gov.cn/athena/forward/BD8730CDDA12515E2D9E1B21AA11C0D6';
const ATHENA_APP_KEY = decodeURIComponent('YMLOfDq5psgC%2Bz5HlWUd6RC75WYJ02Ia1eTitC8Pro4bHvRcUNQ4fGiecrxY7OJJ9xgA0E%2B8tn1cHbTtyuAtcCpYRXpKfIb4pDI4wdR45xu5V1GC5D4p96sGxcidhdxF8v9%2F86OMoKtpoZWY%2BuUFu9MKtPF8j7c8ZJ0lGfla53Q%3D');

// ============================================================
// 1. API fetch
// ============================================================

function makeRequestBody(pageNo, pageSize) {
  return JSON.stringify({
    code: '18258ab0ac9',
    preference: null,
    searchFields: [
      { fieldName: 'f_202321807875', searchWord: '地方政府规章', searchType: 'TERM', withHighLight: true },
      { fieldName: 'f_202321360426', searchWord: '', withHighLight: true },
      { fieldName: 'f_202321758948', searchWord: '', withHighLight: true },
      { fieldName: 'f_202321423473', searchWord: '江苏省', withHighLight: true, searchType: 'TERM' },
      { fieldName: 'f_202321159816', searchWord: '', searchType: 'TERM' },
      { fieldName: 'f_20232380533', withHighLight: true, searchType: 'TERM' },
      { fieldName: 'f_202328191239', withHighLight: true, searchType: 'TERM' },
    ],
    sorts: [{}, { sortField: 'f_202321915922', sortOrder: 'DESC' }],
    resultFields: [
      'f_202321360426', 'f_202344311304', 'f_202323394765', 'f_202355832506',
      'f_202328191239', 'f_202321915922', 'f_202321758948', 'doc_pub_url', 'f_20232124962',
    ],
    trackTotalHits: 'true',
    granularity: 'ALL',
    tableName: 't_1860c735d31',
    pageSize,
    pageNo,
  });
}

function fetchPage(pageNo, pageSize) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(makeRequestBody(pageNo, pageSize), 'utf-8');
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
          resolve({
            total: json.result.data.pager.total,
            list: json.result.data.list,
          });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function downloadAll() {
  if (fs.existsSync(CACHE_FILE)) {
    console.log('从缓存加载...');
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  }

  const PAGE_SIZE = 100;
  const first = await fetchPage(1, PAGE_SIZE);
  const total = first.total;
  const pages = Math.ceil(total / PAGE_SIZE);
  console.log(`总量: ${total}, 页数: ${pages}`);

  const all = [...first.list];
  console.log(`  第1/${pages}页: ${first.list.length}条`);

  for (let p = 2; p <= pages; p++) {
    await sleep(800);
    const page = await fetchPage(p, PAGE_SIZE);
    all.push(...page.list);
    console.log(`  第${p}/${pages}页: ${page.list.length}条 (累计: ${all.length})`);
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`已缓存 ${all.length} 条到 ${CACHE_FILE}`);
  return all;
}

// ============================================================
// 2. Text parser: plain text → articles/paragraphs/items
// ============================================================

function parseFullText(text) {
  if (!text) return [];

  const cleaned = text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

  // Split text into semantic segments at chapter/section/article boundaries
  // Works for both line-broken and continuous text
  const CN = '一二三四五六七八九十百千';
  const segmentRe = new RegExp(`(第[${CN}\\d]+章|第[${CN}\\d]+节|第[${CN}\\d]+条)`, 'g');

  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = segmentRe.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: cleaned.substring(lastIndex, match.index).trim() });
    }
    segments.push({ type: 'marker', marker: match[1], pos: match.index });
    lastIndex = match.index + match[1].length;
  }
  if (lastIndex < cleaned.length) {
    segments.push({ type: 'text', content: cleaned.substring(lastIndex).trim() });
  }

  // Build articles from segments
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
      const art = {
        chapter: currentChapter,
        section: currentSection,
        title: marker,
        content: '',
        paragraphs: [],
      };

      if (nextText) {
        parseArticleContent(nextText, art);
      }

      articles.push(art);
    }
  }

  return articles;
}

function parseArticleContent(text, article) {
  // Split by item markers: （一）（二）etc
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
    const para = { content: leadText.join(''), items };
    article.paragraphs.push(para);
  } else {
    article.paragraphs.push({ content: text, items: [] });
  }
}

// ============================================================
// 3. Import logic
// ============================================================

function cleanTitle(raw) {
  return raw.replace(/<[^>]+>/g, '').trim();
}

function extractDocNumber(pubInfo) {
  if (!pubInfo) return null;
  const patterns = [
    /([^\s（(]{2,}(?:令|发|函|办|规)[^\s]*?第?\s*\d+\s*号)/,
    /([^\s（(]+〔\d{4}〕\d+号)/,
    /([^\s（(]+\[\d{4}\]\d+号)/,
  ];
  for (const pat of patterns) {
    const m = pubInfo.match(pat);
    if (m) return m[1].replace(/<[^>]+>/g, '').trim();
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

function determineRegion(authority) {
  if (!authority) return '江苏';
  const cityMap = {
    '南京': '南京', '无锡': '无锡', '徐州': '徐州', '常州': '常州',
    '苏州': '苏州', '南通': '南通', '连云港': '连云港', '淮安': '淮安',
    '盐城': '盐城', '扬州': '扬州', '镇江': '镇江', '泰州': '泰州',
    '宿迁': '宿迁',
  };
  for (const [key, val] of Object.entries(cityMap)) {
    if (authority.includes(key)) return val;
  }
  if (authority.includes('江苏省')) return '江苏';
  return '江苏';
}

function extractPreamble(text) {
  if (!text) return null;
  const cleaned = text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const lines = cleaned.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
  const articleRe = /^第[一二三四五六七八九十百千\d]+条/;
  const chapterRe = /^第[一二三四五六七八九十百千\d]+章/;

  const preambleLines = [];
  for (const line of lines) {
    if (articleRe.test(line) || chapterRe.test(line)) break;
    preambleLines.push(line);
  }
  const preamble = preambleLines.join('\n').trim();
  return preamble.length > 10 ? preamble : null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('='.repeat(60));
  console.log('步骤4: 导入江苏地方政府规章');
  console.log('='.repeat(60));

  const records = await downloadAll();
  console.log(`\n获取 ${records.length} 条记录`);

  // Dedup against existing DB
  const existingTitles = new Set();
  const existingLaws = db.prepare("SELECT title FROM Law").all();
  for (const l of existingLaws) {
    existingTitles.add(l.title.replace(/\([^)]*\d{4}[^)]*\)/g, '').replace(/（[^）]*\d{4}[^）]*）/g, '').trim());
  }
  console.log(`数据库现有标题: ${existingTitles.size}`);

  const insertLaw = db.prepare(`
    INSERT INTO Law (title, issuingAuthority, documentNumber, preamble,
      promulgationDate, effectiveDate, status, level, category, region,
      articleFormat, scope, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, '现行有效', '地方政府规章', '行政执法', ?,
      'structured', 'national', datetime('now'), datetime('now'))
  `);
  const insertArticle = db.prepare(`
    INSERT INTO Article (lawId, chapter, section, title, \"order\")
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertParagraph = db.prepare(`
    INSERT INTO Paragraph (articleId, number, content, \"order\")
    VALUES (?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO Item (paragraphId, number, content, \"order\")
    VALUES (?, ?, ?, ?)
  `);

  let imported = 0, skipped = 0, noText = 0, parseErrors = 0;
  const importedTitles = [];

  const transaction = db.transaction(() => {
    for (const record of records) {
      const rawTitle = cleanTitle(record.f_202321360426 || '');
      const normTitle = rawTitle.replace(/\([^)]*\d{4}[^)]*\)/g, '').replace(/（[^）]*\d{4}[^）]*）/g, '').trim();

      if (existingTitles.has(normTitle)) {
        skipped++;
        continue;
      }

      const fullText = record.f_202321758948 || '';
      if (!fullText || fullText.length < 50) {
        noText++;
        continue;
      }

      const authority = (record.f_202323394765 || record.f_202355832506 || record.f_202328191239 || '').replace(/<[^>]+>/g, '').trim() || null;
      const pubInfo = record.f_202344311304 || '';
      const docNumber = extractDocNumber(pubInfo);
      const effDate = extractEffectiveDate(pubInfo);
      const promDate = parseDate(record.f_202321915922);
      const region = determineRegion(authority);
      const preamble = extractPreamble(fullText);

      const articles = parseFullText(fullText);

      if (articles.length === 0) {
        parseErrors++;
        continue;
      }

      const result = insertLaw.run(
        rawTitle, authority, docNumber, preamble,
        promDate, effDate, region
      );
      const lawId = result.lastInsertRowid;

      let artOrder = 0;
      for (const art of articles) {
        artOrder++;

        const artResult = insertArticle.run(
          lawId, art.chapter || null, art.section || null,
          art.title, artOrder
        );
        const articleId = artResult.lastInsertRowid;

        // If article has direct content but no paragraphs, create a single paragraph
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
      importedTitles.push(rawTitle);
      existingTitles.add(normTitle);
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
  console.log(`总处理: ${imported + skipped + noText + parseErrors}`);

  // Verify
  const newTotal = db.prepare("SELECT COUNT(*) as c FROM Law").get().c;
  const newGovRegs = db.prepare("SELECT COUNT(*) as c FROM Law WHERE level = '地方政府规章'").get().c;
  console.log(`\n数据库法规总量: ${newTotal}`);
  console.log(`地方政府规章总量: ${newGovRegs}`);

  // Region distribution
  console.log('\n按地区分布:');
  const byRegion = db.prepare("SELECT region, COUNT(*) as c FROM Law WHERE level = '地方政府规章' GROUP BY region ORDER BY c DESC").all();
  byRegion.forEach(r => console.log(`  ${r.region}: ${r.c}`));

  db.close();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
