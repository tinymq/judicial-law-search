/**
 * Import "已被修改" (sxx=2) laws and administrative regulations from flk.npc.gov.cn
 *
 * Usage: node scripts/import-modified-from-flk.js [laws|regs|all] [--dry-run] [--limit N] [--skip-fetch]
 *
 * Three-phase pipeline (same pattern as import-province-local-regs.js):
 *   Phase 1: Fetch from flk API (paginated) → cache to scripts/data/
 *   Phase 2: Compare with DB, find missing
 *   Phase 3: Import: download docx → mammoth → parseContent → insert DB
 *
 * Enrichment (inline, no post-processing needed):
 *   - lawGroupId: generated from normalized base title (MD5)
 *   - industryId + LawIndustry: keyword matching against title + authority
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const mammoth = require('mammoth');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'dev.db');

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
    .replace(/[《》''「」【】\s]/g, '')
    .replace(/[""„‟"]/g, '"')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .replace(/\(试行\)/g, '')
    .trim();
}

// ============ lawGroupId generation (from fix-lawgroupid.ts) ============
const VERSION_MARKER_RE = /[\(\[（【]\s*\d{4}\s*(?:年)?(?:[^)\]）】]{0,20})[\)\]）】]\s*$/g;
const TRAILING_MARKER_RE = /(修订|修正|修改|公布|发布|施行|实施|暂行|试行)\s*$/g;
const EXTRA_WHITESPACE_RE = /\s+/g;
const PUNCTUATION_RE = /[《》"'""'']/g;

function normalizeLawTitle(title) {
  return title
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/【/g, '[').replace(/】/g, ']')
    .replace(/　/g, ' ')
    .replace(PUNCTUATION_RE, '')
    .replace(EXTRA_WHITESPACE_RE, ' ')
    .trim();
}

function buildLawBaseTitle(title) {
  const normalized = normalizeLawTitle(title);
  let current = normalized.trim();
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(VERSION_MARKER_RE, '').trim();
    current = current.replace(TRAILING_MARKER_RE, '').trim();
  }
  return current.replace(EXTRA_WHITESPACE_RE, ' ').trim();
}

function generateLawGroupId(title) {
  const baseTitle = buildLawBaseTitle(title);
  const hash = crypto.createHash('md5').update(baseTitle).digest('hex');
  return `LAW_${hash.substring(0, 12).toUpperCase()}`;
}

// ============ Industry matching (from fix-industry.ts) ============
const INDUSTRY_KEYWORDS = [
  { code: "00", name: "人民政府", authorities: ["国务院", "人民政府"], titleKeywords: ["人民政府", "国务院", "行政区划", "地方组织"] },
  { code: "01", name: "外交", authorities: ["外交部"], titleKeywords: ["外交", "领事", "使馆", "条约"] },
  { code: "02", name: "国防", authorities: ["国防部", "中央军委"], titleKeywords: ["国防", "军事", "兵役", "民兵", "军人", "军队", "武装"] },
  { code: "03", name: "发展和改革", authorities: ["发展和改革委员会", "发改委"], titleKeywords: ["发展规划", "价格", "收费", "物价", "招标投标", "节能", "循环经济", "清洁生产"] },
  { code: "04", name: "教育", authorities: ["教育部", "教育厅", "教育局"], titleKeywords: ["教育", "学校", "教师", "义务教育", "高等教育", "职业教育", "学位", "学前教育", "民办教育"] },
  { code: "05", name: "科学技术", authorities: ["科学技术部", "科技厅"], titleKeywords: ["科学技术", "科技进步", "科技成果", "科普"] },
  { code: "06", name: "工业和信息化", authorities: ["工业和信息化部", "工信部"], titleKeywords: ["工业", "信息化", "电信", "通信", "无线电", "互联网", "网络安全", "数据安全", "电子签名"] },
  { code: "07", name: "民族事务", authorities: ["民族事务委员会"], titleKeywords: ["民族", "少数民族", "民族区域自治"] },
  { code: "08", name: "公安", authorities: ["公安部", "公安厅", "公安局"], titleKeywords: ["公安", "治安", "出入境", "户籍", "身份证", "居住证", "枪支", "爆炸物", "道路交通", "交通安全", "机动车", "驾驶"] },
  { code: "09", name: "国家安全", authorities: ["国家安全部"], titleKeywords: ["国家安全", "反间谍", "反恐", "保密"] },
  { code: "10", name: "民政", authorities: ["民政部", "民政厅", "民政局"], titleKeywords: ["民政", "社会团体", "基金会", "社会组织", "社会救助", "殡葬", "婚姻", "收养", "地名", "社区", "村民", "居民", "社会福利", "慈善", "养老", "未成年人保护", "老年人", "残疾人"] },
  { code: "11", name: "司法", authorities: ["司法部", "司法厅", "司法局"], titleKeywords: ["司法", "律师", "公证", "仲裁", "调解", "法律援助", "司法鉴定", "监狱", "社区矫正", "法治", "行政复议", "行政诉讼", "行政执法", "立法", "法规规章"] },
  { code: "12", name: "财政", authorities: ["财政部", "财政厅"], titleKeywords: ["财政", "预算", "政府采购", "会计"] },
  { code: "13", name: "人力资源和社会保障", authorities: ["人力资源和社会保障部", "人社厅"], titleKeywords: ["劳动", "就业", "社会保险", "工伤", "劳动合同", "工资", "社会保障", "职业技能"] },
  { code: "14", name: "自然资源", authorities: ["自然资源部", "自然资源厅", "国土资源"], titleKeywords: ["自然资源", "土地", "矿产", "国土", "测绘", "地质", "不动产", "海域", "海岛"] },
  { code: "15", name: "生态环境", authorities: ["生态环境部", "环境保护", "生态环境厅"], titleKeywords: ["环境保护", "生态环境", "污染", "环境影响", "排污", "环保", "噪声", "水污染", "大气污染", "土壤污染", "固体废物", "危险废物", "放射性"] },
  { code: "16", name: "住房和城乡建设", authorities: ["住房和城乡建设部", "住建厅", "建设厅"], titleKeywords: ["建筑", "建设工程", "城乡规划", "城市规划", "住房", "房地产", "物业", "市容", "环境卫生", "园林", "绿化", "城市道路", "城市供水", "燃气", "供热", "排水", "污水", "垃圾", "城镇"] },
  { code: "17", name: "交通运输", authorities: ["交通运输部", "交通厅", "交通局"], titleKeywords: ["交通运输", "公路", "道路运输", "水路", "港口", "航道", "船舶", "出租汽车", "公共汽车", "城市公共交通", "客运", "货运"] },
  { code: "18", name: "水利", authorities: ["水利部", "水利厅", "水务局"], titleKeywords: ["水利", "水法", "防洪", "水土保持", "河道", "水库", "灌区", "水资源", "节约用水", "抗旱", "河湖"] },
  { code: "19", name: "农业农村", authorities: ["农业农村部", "农业厅", "农业局"], titleKeywords: ["农业", "农村", "农民", "种子", "农药", "化肥", "农产品", "畜牧", "兽医", "动物防疫", "渔业", "农机", "农田", "耕地", "粮食", "植物", "乡村"] },
  { code: "20", name: "商务", authorities: ["商务部", "商务厅"], titleKeywords: ["商务", "外贸", "进出口", "对外贸易", "外商投资", "自由贸易", "电子商务", "拍卖", "典当"] },
  { code: "21", name: "文化和旅游", authorities: ["文化和旅游部", "文化厅", "旅游局"], titleKeywords: ["文化", "旅游", "非物质文化遗产", "文化遗产", "古建筑", "图书馆", "博物馆", "娱乐", "演出", "导游", "景区", "风景名胜"] },
  { code: "22", name: "卫生健康", authorities: ["卫生健康委", "卫计委", "卫生厅"], titleKeywords: ["卫生", "医疗", "医院", "医师", "护士", "传染病", "献血", "母婴", "计划生育", "精神卫生", "职业病", "中医药", "中药"] },
  { code: "23", name: "退役军人事务", authorities: ["退役军人事务部"], titleKeywords: ["退役军人", "退伍", "复员"] },
  { code: "24", name: "应急管理", authorities: ["应急管理部", "应急管理厅"], titleKeywords: ["应急", "安全生产", "危险化学品", "烟花爆竹", "防灾", "减灾", "救灾"] },
  { code: "25", name: "审计", authorities: ["审计署", "审计厅"], titleKeywords: ["审计"] },
  { code: "26", name: "海关", authorities: ["海关总署"], titleKeywords: ["海关", "进出境", "检验检疫", "关税"] },
  { code: "27", name: "税务", authorities: ["税务总局", "税务局"], titleKeywords: ["税务", "税收", "增值税", "所得税", "印花税", "契税", "发票"] },
  { code: "28", name: "统计", authorities: ["统计局"], titleKeywords: ["统计"] },
  { code: "29", name: "体育", authorities: ["体育总局"], titleKeywords: ["体育", "全民健身"] },
  { code: "30", name: "市场监督管理", authorities: ["市场监督管理", "市场监管", "工商行政"], titleKeywords: ["市场监管", "市场监督", "营业执照", "市场主体", "登记注册", "特种设备", "电梯", "锅炉", "计量", "标准化", "认证", "检测", "产品质量", "反垄断", "竞争", "消费者", "广告", "直销", "传销", "网络交易"] },
  { code: "31", name: "粮食和物资储备", authorities: ["粮食和物资储备局"], titleKeywords: ["粮食安全保障", "物资储备"] },
  { code: "32", name: "能源", authorities: ["能源局"], titleKeywords: ["能源", "电力", "煤炭", "石油", "天然气", "可再生能源"] },
  { code: "33", name: "烟草", authorities: ["烟草局"], titleKeywords: ["烟草", "卷烟"] },
  { code: "34", name: "林业和草原", authorities: ["林业和草原局", "林业厅"], titleKeywords: ["森林", "林业", "草原", "湿地", "野生动物", "自然保护区", "国家公园"] },
  { code: "35", name: "铁路", authorities: ["铁路局"], titleKeywords: ["铁路"] },
  { code: "36", name: "民用航空", authorities: ["民用航空局", "民航局"], titleKeywords: ["民用航空", "航空", "机场"] },
  { code: "37", name: "邮政", authorities: ["邮政局"], titleKeywords: ["邮政", "快递"] },
  { code: "38", name: "文物", authorities: ["文物局"], titleKeywords: ["文物", "考古", "古建筑"] },
  { code: "39", name: "药品监督管理", authorities: ["药品监督管理局", "药监局"], titleKeywords: ["药品", "医疗器械", "化妆品", "疫苗"] },
  { code: "40", name: "知识产权", authorities: ["知识产权局"], titleKeywords: ["知识产权", "专利", "商标", "著作权", "版权"] },
  { code: "41", name: "密码管理", authorities: ["密码管理局"], titleKeywords: ["密码法", "密码管理"] },
  { code: "42", name: "档案", authorities: ["档案局"], titleKeywords: ["档案"] },
  { code: "43", name: "金融", authorities: ["金融监管", "银保监", "证监"], titleKeywords: ["金融", "银行", "保险", "证券", "基金", "信托", "期货"] },
  { code: "44", name: "医疗保障", authorities: ["医疗保障局"], titleKeywords: ["医疗保障", "医保"] },
  { code: "45", name: "信访", authorities: ["信访局"], titleKeywords: ["信访"] },
  { code: "46", name: "广播电视", authorities: ["广播电视"], titleKeywords: ["广播电视", "广播", "电视"] },
  { code: "47", name: "新闻出版", authorities: ["新闻出版"], titleKeywords: ["新闻出版", "出版"] },
  { code: "48", name: "电影", authorities: ["电影局"], titleKeywords: ["电影"] },
  { code: "49", name: "城市管理", authorities: ["城市管理", "城管"], titleKeywords: ["城市管理", "城管"] },
  { code: "50", name: "气象", authorities: ["气象局"], titleKeywords: ["气象"] },
  { code: "51", name: "地震", authorities: ["地震局"], titleKeywords: ["地震", "防震减灾"] },
  { code: "52", name: "人民防空", authorities: ["人民防空"], titleKeywords: ["人民防空", "防空", "人防"] },
  { code: "53", name: "消防救援", authorities: ["消防救援"], titleKeywords: ["消防"] },
  { code: "54", name: "矿山安全", authorities: ["矿山安全"], titleKeywords: ["矿山", "煤矿"] },
  { code: "55", name: "海事", authorities: ["海事局"], titleKeywords: ["海事", "海上交通"] },
  { code: "56", name: "移民管理", authorities: ["移民管理局"], titleKeywords: ["出入境管理", "外国人管理", "移民"] },
  { code: "57", name: "海警", authorities: ["海警"], titleKeywords: ["海警"] },
  { code: "58", name: "国有资产监管", authorities: ["国有资产监督"], titleKeywords: ["国有资产"] },
  { code: "63", name: "乡村振兴", authorities: ["乡村振兴"], titleKeywords: ["乡村振兴", "扶贫"] },
  { code: "64", name: "疾病预防控制", authorities: ["疾控"], titleKeywords: ["疾病预防", "传染病防治"] },
  { code: "65", name: "数据管理", authorities: ["数据局"], titleKeywords: ["数据管理", "大数据", "数字经济"] },
];

function matchIndustries(title, authority) {
  const matches = [];
  for (const ind of INDUSTRY_KEYWORDS) {
    let score = 0;
    if (authority) {
      for (const auth of ind.authorities) {
        if (authority.includes(auth)) { score += 10; break; }
      }
    }
    for (const kw of ind.titleKeywords) {
      if (title.includes(kw)) score += 3;
    }
    if (score > 0) matches.push({ code: ind.code, name: ind.name, score });
  }
  matches.sort((a, b) => b.score - a.score);
  const result = matches.slice(0, 3).map((m, i) => ({ code: m.code, name: m.name, isPrimary: i === 0 }));
  if (result.length === 0) result.push({ code: "99", name: "其他", isPrimary: true });
  return result;
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
function insertLaw(db, lawData, articles, preamble, detectedFormat, industryByCode) {
  const insertLawStmt = db.prepare(`
    INSERT INTO Law (title, issuingAuthority, promulgationDate, effectiveDate, status, level, category, region, articleFormat, preamble, lawGroupId, industryId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  const insertArticleStmt = db.prepare(`INSERT INTO Article (lawId, chapter, section, title, "order") VALUES (?, ?, ?, ?, ?)`);
  const insertParagraphStmt = db.prepare(`INSERT INTO Paragraph (articleId, number, content, "order") VALUES (?, ?, ?, ?)`);
  const insertItemStmt = db.prepare(`INSERT INTO Item (paragraphId, number, content, "order") VALUES (?, ?, ?, ?)`);
  const insertLawIndustryStmt = db.prepare(`INSERT OR IGNORE INTO LawIndustry (lawId, industryId, isPrimary) VALUES (?, ?, ?)`);

  const txn = db.transaction(() => {
    const promDate = lawData.promulgationDate ? lawData.promulgationDate + 'T00:00:00.000Z' : null;
    const effDate = lawData.effectiveDate ? lawData.effectiveDate + 'T00:00:00.000Z' : null;

    const lawGroupId = generateLawGroupId(lawData.title);
    const industryMatches = matchIndustries(lawData.title, lawData.issuingAuthority);
    const primaryIndustry = industryMatches.find(m => m.isPrimary);
    const primaryIndustryRow = primaryIndustry ? industryByCode.get(primaryIndustry.code) : null;

    const result = insertLawStmt.run(
      lawData.title,
      lawData.issuingAuthority || null,
      promDate, effDate,
      '已被修改',
      lawData.level,
      '综合监管',
      '全国',
      detectedFormat,
      preamble || null,
      lawGroupId,
      primaryIndustryRow ? primaryIndustryRow.id : null
    );

    const lawId = Number(result.lastInsertRowid);

    for (const m of industryMatches) {
      const indRow = industryByCode.get(m.code);
      if (indRow) {
        insertLawIndustryStmt.run(lawId, indRow.id, m.isPrimary ? 1 : 0);
      }
    }

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

    return { lawId, lawGroupId, industry: primaryIndustry?.name || '其他' };
  });

  return txn();
}

// ============ Phase 1: Fetch from flk API ============
const LAW_SUB_CATEGORIES = [
  { flfgCodeId: 110, label: '宪法相关法' },
  { flfgCodeId: 120, label: '民法商法' },
  { flfgCodeId: 130, label: '行政法' },
  { flfgCodeId: 140, label: '经济法' },
  { flfgCodeId: 150, label: '社会法' },
  { flfgCodeId: 155, label: '生态环境法' },
  { flfgCodeId: 160, label: '刑法' },
  { flfgCodeId: 170, label: '诉讼与非诉讼程序法' },
];

async function fetchOnePage(flfgCodeId, page) {
  const body = {
    searchRange: 1, searchType: 2,
    sxx: [2],
    flfgCodeId: [flfgCodeId],
    searchContent: '', pageNum: page, size: 20
  };
  return httpsPost('flk.npc.gov.cn', '/law-search/search/list', body);
}

async function fetchLaws(cachePath) {
  if (fs.existsSync(cachePath)) {
    console.log(`Using cached 已被修改-法律 from ${cachePath}`);
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }

  console.log('Fetching 已被修改-法律 (sxx=2) by sub-categories...');
  const allRows = [];

  for (const cat of LAW_SUB_CATEGORIES) {
    console.log(`\n  ${cat.label} (flfgCodeId=${cat.flfgCodeId}):`);
    let page = 1;
    let total = 0;
    let catFetched = 0;

    while (true) {
      const data = await fetchOnePage(cat.flfgCodeId, page);

      if (page === 1) {
        total = data.total;
        console.log(`    Total: ${total}`);
        if (total === 0) break;
      }

      if (!data.rows || data.rows.length === 0) break;

      allRows.push(...data.rows);
      catFetched += data.rows.length;
      console.log(`    Page ${page}: +${data.rows.length} (cat: ${catFetched}/${total})`);

      if (catFetched >= total) break;
      page++;
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  fs.writeFileSync(cachePath, JSON.stringify(allRows, null, 2), 'utf-8');
  console.log(`\n  Saved ${allRows.length} law entries to ${cachePath}\n`);
  return allRows;
}

async function fetchRegs(cachePath) {
  if (fs.existsSync(cachePath)) {
    console.log(`Using cached 已被修改-行政法规 from ${cachePath}`);
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  }

  console.log('Fetching 已被修改-行政法规 (sxx=2, flfgCodeId=210)...');
  const allRows = [];
  let page = 1;
  let total = 0;

  while (true) {
    const data = await fetchOnePage(210, page);

    if (page === 1) {
      total = data.total;
      console.log(`  Total: ${total}, ${Math.ceil(total / 20)} pages`);
      if (total === 0) break;
    }

    if (!data.rows || data.rows.length === 0) break;

    allRows.push(...data.rows);
    console.log(`  Page ${page}: +${data.rows.length} (fetched: ${allRows.length}/${total})`);

    if (allRows.length >= total) break;
    page++;
    await new Promise(r => setTimeout(r, 1500));
  }

  fs.writeFileSync(cachePath, JSON.stringify(allRows, null, 2), 'utf-8');
  console.log(`  Saved ${allRows.length} reg entries to ${cachePath}\n`);
  return allRows;
}

// ============ Phase 2: Compare with DB ============
function findMissing(flkRows, db, label) {
  const allLaws = db.prepare('SELECT id, title FROM Law').all();
  const localTitleSet = new Set(allLaws.map(l => l.title));

  // Dedup by bbbs (unique document ID), not by normalized title
  // Multiple versions of the same law (different gbrq) are DIFFERENT documents
  const flkByBbbs = new Map();
  for (const row of flkRows) {
    if (!flkByBbbs.has(row.bbbs)) {
      flkByBbbs.set(row.bbbs, row);
    }
  }

  const missing = [];
  const matched = [];

  for (const row of flkByBbbs.values()) {
    // Generate candidate titles with year marker to check against DB
    const year = row.gbrq ? row.gbrq.substring(0, 4) : '';
    const candidates = year ? [
      `${row.title}(${year}年修订)`,
      `${row.title}(${year}年修正)`,
      `${row.title}(${year}年公布)`,
      row.title,
    ] : [row.title];

    const existsInDb = candidates.some(c => localTitleSet.has(c));
    if (existsInDb) {
      matched.push(row.title + (year ? ` (${year})` : ''));
    } else {
      missing.push(row);
    }
  }

  console.log(`=== ${label} Dedup Results ===`);
  console.log(`  国家库 (raw): ${flkRows.length}`);
  console.log(`  国家库 (unique docs): ${flkByBbbs.size}`);
  console.log(`  已匹配(DB已有): ${matched.length}`);
  console.log(`  需要导入: ${missing.length}\n`);

  return missing;
}

// ============ Phase 3: Import ============
async function processItem(db, item, level, cookie, index, total, industryByCode, retries = 0) {
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
        return processItem(db, item, level, _cookie, index, total, industryByCode, retries + 1);
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
      console.log(`${tag} SKIP ${item.title} - extracted text too short`);
      return { status: 'skip', reason: 'short_text' };
    }

    const content = stripTitle(rawText);
    const parsed = parseContent(content);
    if (parsed.articles.length === 0) {
      console.log(`${tag} SKIP ${item.title} - no articles parsed`);
      return { status: 'skip', reason: 'no_articles' };
    }

    const revisionType = detectRevisionType(parsed.preamble || content.substring(0, 200));
    const year = item.gbrq ? item.gbrq.substring(0, 4) : '';
    const titleWithYear = year ? `${item.title}(${year}年${revisionType})` : item.title;

    const lawData = {
      title: titleWithYear,
      issuingAuthority: item.zdjgName,
      promulgationDate: item.gbrq,
      effectiveDate: item.sxrq,
      level,
    };

    const result = insertLaw(db, lawData, parsed.articles, parsed.preamble, parsed.detectedFormat, industryByCode);
    console.log(`${tag} OK ${titleWithYear} -> id=${result.lawId}, ${parsed.articles.length} arts, grp=${result.lawGroupId}, ind=${result.industry}`);

    return { status: 'ok', lawId: result.lawId, articleCount: parsed.articles.length, lawGroupId: result.lawGroupId, industry: result.industry };
  } catch (err) {
    if (retries < 2 && (err.message.includes('307') || err.message.includes('central directory'))) {
      const waitSec = (retries + 1) * 60;
      console.log(`${tag} WAF/error: ${err.message.substring(0, 60)}, waiting ${waitSec}s... (retry ${retries + 1})`);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      _cookie = await getCookie();
      return processItem(db, item, level, _cookie, index, total, industryByCode, retries + 1);
    }
    console.log(`${tag} FAIL ${item.title} - ${err.message.substring(0, 100)}`);
    return { status: 'fail', error: err.message };
  }
}

// ============ Main ============
async function main() {
  const args = process.argv.slice(2);
  const mode = args.find(a => !a.startsWith('--')) || 'all';
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit'));
  const limit = limitArg ? parseInt(args[args.indexOf(limitArg) + 1]) : Infinity;
  const skipFetch = args.includes('--skip-fetch');

  console.log(`=== 已被修改法规导入 (sxx=2) ===`);
  console.log(`Mode: ${mode}, Dry run: ${dryRun}, Limit: ${limit === Infinity ? 'none' : limit}, Skip fetch: ${skipFetch}\n`);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Load industry table for enrichment
  const industries = db.prepare('SELECT id, code, name FROM Industry').all();
  const industryByCode = new Map(industries.map(i => [i.code, i]));
  console.log(`Loaded ${industries.length} industries\n`);

  // Backup
  const backupPath = DB_PATH + '.bak-modified';
  if (!dryRun && !fs.existsSync(backupPath)) {
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`Backed up DB to ${backupPath}\n`);
  }

  const lawsCachePath = path.join(__dirname, 'data', 'flk-modified-laws.json');
  const regsCachePath = path.join(__dirname, 'data', 'flk-modified-regs.json');

  let allMissing = [];

  // Phase 1 + 2: Fetch and compare for each category
  if (mode === 'laws' || mode === 'all') {
    let lawRows;
    if (skipFetch && fs.existsSync(lawsCachePath)) {
      lawRows = JSON.parse(fs.readFileSync(lawsCachePath, 'utf-8'));
      console.log(`Loaded ${lawRows.length} cached law entries\n`);
    } else {
      lawRows = await fetchLaws(lawsCachePath);
    }
    const missingLaws = findMissing(lawRows, db, '法律');
    allMissing.push(...missingLaws.map(r => ({ ...r, _level: '法律' })));
  }

  if (mode === 'regs' || mode === 'all') {
    let regRows;
    if (skipFetch && fs.existsSync(regsCachePath)) {
      regRows = JSON.parse(fs.readFileSync(regsCachePath, 'utf-8'));
      console.log(`Loaded ${regRows.length} cached reg entries\n`);
    } else {
      regRows = await fetchRegs(regsCachePath);
    }
    const missingRegs = findMissing(regRows, db, '行政法规');
    allMissing.push(...missingRegs.map(r => ({ ...r, _level: '行政法规' })));
  }

  console.log(`=== Total to import: ${allMissing.length} ===\n`);

  if (dryRun) {
    console.log('=== Dry Run - Would import: ===');
    const toShow = allMissing.slice(0, limit === Infinity ? allMissing.length : limit);
    for (let i = 0; i < toShow.length; i++) {
      const m = toShow[i];
      console.log(`  ${i + 1}. [${m._level}] ${m.title} [${m.zdjgName}] (${m.gbrq})`);
    }
    db.close();
    return;
  }

  if (allMissing.length === 0) {
    console.log('Nothing to import!');
    db.close();
    return;
  }

  // Phase 3: Import
  let cookie = await getCookie();
  const total = Math.min(allMissing.length, limit);
  const results = { ok: 0, skip: 0, fail: 0, details: [] };

  console.log(`Importing ${total} laws...\n`);

  for (let i = 0; i < total; i++) {
    if (i > 0 && i % 30 === 0) {
      console.log('  Refreshing cookie...');
      cookie = await getCookie();
      await new Promise(r => setTimeout(r, 1000));
    }

    const item = allMissing[i];
    const result = await processItem(db, item, item._level, cookie, i, total, industryByCode);
    results[result.status]++;
    results.details.push({ title: item.title, level: item._level, ...result });

    await new Promise(r => setTimeout(r, 1500));
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`OK: ${results.ok}, Skip: ${results.skip}, Fail: ${results.fail}`);

  const lawOk = results.details.filter(d => d.level === '法律' && d.status === 'ok').length;
  const regOk = results.details.filter(d => d.level === '行政法规' && d.status === 'ok').length;
  console.log(`  法律导入成功: ${lawOk}`);
  console.log(`  行政法规导入成功: ${regOk}`);

  const skipped = results.details.filter(d => d.status === 'skip');
  if (skipped.length > 0) {
    console.log('\nSkipped:');
    skipped.forEach(d => console.log(`  - [${d.level}] ${d.title}: ${d.reason}`));
  }

  const failed = results.details.filter(d => d.status === 'fail');
  if (failed.length > 0) {
    console.log('\nFailed:');
    failed.forEach(d => console.log(`  - [${d.level}] ${d.title}: ${d.error}`));
  }

  // Post-import verification
  const countByStatus = db.prepare("SELECT status, level, COUNT(*) as cnt FROM Law WHERE level IN ('法律','行政法规') GROUP BY status, level ORDER BY level, status").all();
  console.log('\n=== Post-import verification ===');
  countByStatus.forEach(r => console.log(`  ${r.level} | ${r.status}: ${r.cnt}`));

  db.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
