/**
 * P4: 逐条查国家库，确认5条多余行政法规的真实状态
 * Usage: node scripts/check-p4-regs.js
 */
const https = require('https');

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
        try { resolve({ statusCode: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (e) { reject(new Error('Invalid JSON')); }
      });
    });
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SXX_LABELS = { 1: '已废止', 3: '现行有效', 5: '已被修改', 9: '尚未生效' };

const targets = [
  { id: 108, title: '产品质量监督试行办法', keyword: '产品质量监督' },
  { id: 119, title: '信访工作条例', keyword: '信访工作条例' },
  { id: 169, title: '国务院关于预防煤矿生产安全事故的特别规定', keyword: '预防煤矿' },
  { id: 270, title: '煤矿安全监察条例', keyword: '煤矿安全监察' },
  { id: 813, title: '中华人民共和国增值税暂行条例', keyword: '增值税暂行' },
];

async function searchFlk(keyword) {
  // 搜所有时效性状态
  const body = {
    searchRange: 1, searchType: 2,
    searchContent: keyword,
    pageNum: 1, size: 20,
  };
  const resp = await httpsPost('flk.npc.gov.cn', '/law-search/search/list', body);
  return resp.data.rows || [];
}

(async () => {
  console.log('P4: 逐条查国家库确认多余行政法规状态\n');

  for (const t of targets) {
    console.log(`--- id=${t.id} ${t.title} ---`);

    try {
      const rows = await searchFlk(t.keyword);

      if (rows.length === 0) {
        console.log('  国家库搜索无结果');
      } else {
        for (const r of rows) {
          const title = (r.title || '').replace(/<[^>]+>/g, '');
          const sxxLabel = SXX_LABELS[r.sxx] || `未知(${r.sxx})`;
          const flxz = r.flxz || '';
          console.log(`  ${title} | ${sxxLabel} | ${flxz} | ${r.gbrq || ''}`);
        }
      }
    } catch (e) {
      console.log('  查询失败:', e.message);
    }

    console.log();
    await sleep(1500);
  }
})();
