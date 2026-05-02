import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CACHE_FILE = path.join(__dirname, 'data', 'guizhangku-cache.json');

const TITLES_21 = [
  '个体工商户年度报告办法',
  '事业单位登记管理暂行条例实施细则',
  '互联网广告管理暂行办法',
  '企业投资项目核准和备案管理办法',
  '公共场所卫生管理条例实施细则',
  '兽药广告审查发布标准',
  '兽药进口管理办法',
  '农民专业合作社年度报告公示办法',
  '土地调查条例实施办法',
  '地质资料管理条例实施办法',
  '城市公共汽车和电车客运管理规定',
  '城市建筑垃圾管理规定',
  '城市生活垃圾管理办法',
  '工业产品生产单位落实质量安全主体责任监督管理规定',
  '房屋建筑和市政基础设施工程质量监督管理规定',
  '报废机动车回收管理办法实施细则',
  '植物检疫条例实施细则(农业部分)',
  '植物检疫条例实施细则(林业部分)',
  '禁止非医学需要的胎儿性别鉴定和选择性别人工终止妊娠的规定',
  '铺设海底电缆管道管理规定实施办法',
  '食品检验机构资质认定管理办法',
];

interface GZKRecord {
  f_202321360426: string;
  f_202344311304: string;
  f_202323394765: string;
  f_202355832506: string;
  f_202328191239: string;
  f_202321915922: string;
  f_202321758948: string;
}

interface ParsedArticle {
  chapter: string | null;
  section: string | null;
  title: string;
  order: number;
  paragraphs: ParsedParagraph[];
}
interface ParsedParagraph {
  number: number;
  content: string;
  order: number;
  items: ParsedItem[];
}
interface ParsedItem {
  number: string;
  content: string;
  order: number;
}

function normalizeTitle(t: string): string {
  return t
    .replace(/<[^>]+>/g, '')
    .replace(/[《》‘’「」【】\s]/g, '')
    .replace(/[“”„‟"]/g, '"')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .replace(/\(试行\)/g, '').replace(/（试行）/g, '')
    .trim();
}

function inferCategory(title: string): string {
  const keywords: Record<string, string[]> = {
    '安全生产': ['安全生产', '安全监督'],
    '食品安全': ['食品', '食用'],
    '医疗卫生': ['医疗', '卫生', '诊疗', '妊娠', '胎儿'],
    '药品监管': ['药品', '兽药'],
    '市场监管': ['市场监督', '产品质量', '广告', '工商户', '工业产品'],
    '农业农村': ['农业', '农产品', '农药', '饲料', '兽医', '植物检疫', '合作社'],
    '自然资源': ['矿山', '矿产', '地质', '土地'],
    '住房城建': ['房屋', '建筑', '城市', '城镇', '垃圾'],
    '交通运输': ['交通', '运输', '客运', '公共汽车', '机动车', '海底电缆'],
    '商务贸易': ['进出口', '外商', '进口'],
    '民政管理': ['事业单位', '登记管理', '救灾'],
    '网络信息': ['互联网', '网络', '信息安全'],
  };
  for (const [category, kws] of Object.entries(keywords)) {
    if (kws.some(kw => title.includes(kw))) return category;
  }
  return '综合监管';
}

function buildLawBaseTitle(title: string): string {
  const VERSION_RE = /[(\[（【]\s*\d{4}\s*(?:年)?(?:[^)\]）】]{0,20})[)\]）】]\s*$/g;
  const TRAILING_RE = /(修订|修正|修改|公布|发布|施行|实施|暂行|试行)\s*$/g;
  let normalized = title
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/【/g, '[').replace(/】/g, ']')
    .replace(/　/g, ' ')
    .replace(/[《》“‘”’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  let current = normalized, previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(VERSION_RE, '').trim();
    current = current.replace(TRAILING_RE, '').trim();
  }
  return current.replace(/\s+/g, ' ').trim();
}

function generateLawGroupId(title: string): string {
  const baseTitle = buildLawBaseTitle(title);
  const hash = crypto.createHash('md5').update(baseTitle).digest('hex');
  return `LAW_${hash.substring(0, 12).toUpperCase()}`;
}

function parsePublicationInfo(info: string): { documentNumber: string | null; effectiveDate: string | null } {
  if (!info) return { documentNumber: null, effectiveDate: null };
  let documentNumber: string | null = null;
  const altMatch = info.match(/([^\s（(]+(?:令|发|函|办|规)[^\s]*第?\d+号)/);
  if (altMatch) documentNumber = altMatch[1];
  let effectiveDate: string | null = null;
  const dateMatch = info.match(/自(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (dateMatch) effectiveDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
  return { documentNumber, effectiveDate };
}

const CN_NUM = '一二三四五六七八九十百零〇两千万亿';

function splitArticles(fullText: string): { preamble: string; articles: ParsedArticle[] } {
  const titleAndPreambleMatch = fullText.match(new RegExp(`^(.*?)(?=第[${CN_NUM}\\d]+条[　\\s])`));
  let preamble = '';
  let bodyText = fullText;
  if (titleAndPreambleMatch) {
    preamble = titleAndPreambleMatch[1].trim();
    bodyText = fullText.substring(titleAndPreambleMatch[0].length);
  }
  const articlePositions: { index: number; title: string }[] = [];
  const articleSplitRe = new RegExp(`(第[${CN_NUM}\\d]+条)[　\\s]`, 'g');
  let m: RegExpExecArray | null;
  while ((m = articleSplitRe.exec(bodyText)) !== null) {
    articlePositions.push({ index: m.index, title: m[1] });
  }
  if (articlePositions.length === 0) return { preamble: preamble || fullText, articles: [] };

  let currentChapter: string | null = null;
  let currentSection: string | null = null;
  const chapterRe = new RegExp(`(第[${CN_NUM}\\d]+章)[　\\s]*([^第]*)`, 'g');
  const sectionRe = new RegExp(`(第[${CN_NUM}\\d]+节)[　\\s]*([^第]*)`, 'g');
  const chapterPositions: { index: number; title: string }[] = [];
  while ((m = chapterRe.exec(bodyText)) !== null) {
    chapterPositions.push({ index: m.index, title: `${m[1]} ${m[2]}`.trim() });
  }
  const sectionPositions: { index: number; title: string }[] = [];
  while ((m = sectionRe.exec(bodyText)) !== null) {
    sectionPositions.push({ index: m.index, title: `${m[1]} ${m[2]}`.trim() });
  }

  const articles: ParsedArticle[] = [];
  for (let i = 0; i < articlePositions.length; i++) {
    const pos = articlePositions[i];
    const nextPos = articlePositions[i + 1];
    for (const cp of chapterPositions) { if (cp.index <= pos.index) currentChapter = cp.title; }
    for (const sp of sectionPositions) { if (sp.index <= pos.index) currentSection = sp.title; }
    const startIdx = pos.index + pos.title.length + 1;
    const endIdx = nextPos ? nextPos.index : bodyText.length;
    let rawContent = bodyText.substring(startIdx, endIdx).trim();
    const chapterInContent = new RegExp(`\\s*第[${CN_NUM}\\d]+章[　\\s]+[^第]*$`);
    const sectionInContent = new RegExp(`\\s*第[${CN_NUM}\\d]+节[　\\s]+[^第]*$`);
    rawContent = rawContent.replace(chapterInContent, '').replace(sectionInContent, '').trim();
    articles.push({
      chapter: currentChapter, section: currentSection, title: pos.title, order: i + 1,
      paragraphs: parseParagraphs(rawContent),
    });
  }
  return { preamble, articles };
}

function parseParagraphs(articleContent: string): ParsedParagraph[] {
  const itemPositions: number[] = [];
  const itemReLocal = /[（(]([一二三四五六七八九十百零]+)[）)]/g;
  let m: RegExpExecArray | null;
  while ((m = itemReLocal.exec(articleContent)) !== null) { itemPositions.push(m.index); }
  if (itemPositions.length === 0) {
    return [{ number: 1, content: articleContent, order: 1, items: [] }];
  }
  const beforeItems = articleContent.substring(0, itemPositions[0]).trim();
  const itemsText = articleContent.substring(itemPositions[0]);
  const paragraphs: ParsedParagraph[] = [];
  let pOrder = 1;
  if (beforeItems) {
    paragraphs.push({ number: pOrder, content: beforeItems, order: pOrder, items: [] });
    pOrder++;
  }
  paragraphs.push({ number: pOrder, content: '', order: pOrder, items: parseItems(itemsText) });
  return paragraphs;
}

function parseItems(itemsText: string): ParsedItem[] {
  const itemRe = /[（(]([一二三四五六七八九十百零]+)[）)]/g;
  const positions: { index: number; number: string; fullMatch: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(itemsText)) !== null) {
    positions.push({ index: m.index, number: `（${m[1]}）`, fullMatch: m[0] });
  }
  const items: ParsedItem[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index + positions[i].fullMatch.length;
    const end = positions[i + 1] ? positions[i + 1].index : itemsText.length;
    items.push({ number: positions[i].number, content: itemsText.substring(start, end).trim(), order: i + 1 });
  }
  return items;
}

async function main() {
  console.log('=== 21条错误匹配法规：导入+补全+回填 ===\n');

  const records: GZKRecord[] = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  const titleMap = new Map<string, GZKRecord>();
  for (const r of records) {
    const rawTitle = (r.f_202321360426 || '').replace(/<[^>]+>/g, '');
    const title = normalizeTitle(rawTitle);
    if (title) titleMap.set(title, r);
  }
  console.log(`规章库缓存: ${records.length} 条\n`);

  let created = 0, enriched = 0, backfilled = 0, noMatch = 0, noText = 0;
  let totalArticles = 0, totalParagraphs = 0, totalItems = 0;

  for (const title of TITLES_21) {
    const existing = await prisma.law.findFirst({ where: { title } });
    if (existing) {
      console.log(`⏭️  已存在: ${title} (lawId=${existing.id})`);
      continue;
    }

    const level = '部门规章';
    const category = inferCategory(title);
    const lawGroupId = generateLawGroupId(title);

    const law = await prisma.law.create({
      data: { title, level, category, status: '现行有效', lawGroupId, articleFormat: 'standard' },
    });
    created++;

    const norm = normalizeTitle(title);
    const record = titleMap.get(norm);

    if (!record) {
      console.log(`❌ ${title} → stub创建 (lawId=${law.id})，规章库无匹配`);
      noMatch++;
      continue;
    }

    const authority = (record.f_202323394765 || record.f_202355832506 || record.f_202328191239 || '').replace(/<[^>]+>/g, '') || null;
    const pubInfo = parsePublicationInfo(record.f_202344311304 || '');
    const promulgationDate = record.f_202321915922?.match(/(\d{4})-(\d{2})-(\d{2})/)?.[0] || null;

    await prisma.law.update({
      where: { id: law.id },
      data: {
        issuingAuthority: authority || undefined,
        documentNumber: pubInfo.documentNumber || undefined,
        promulgationDate: promulgationDate ? new Date(promulgationDate) : undefined,
        effectiveDate: pubInfo.effectiveDate ? new Date(pubInfo.effectiveDate) : undefined,
      },
    });
    enriched++;

    const fullText = record.f_202321758948;
    if (!fullText || fullText.length < 50) {
      console.log(`⚠️  ${title} → 元数据已补全，但无全文 (lawId=${law.id})`);
      noText++;
      continue;
    }

    const { preamble, articles } = splitArticles(fullText);
    if (articles.length === 0) {
      console.log(`⚠️  ${title} → 元数据已补全，全文无法解析为条文 (lawId=${law.id})`);
      noText++;
      continue;
    }

    if (preamble) {
      await prisma.law.update({ where: { id: law.id }, data: { preamble } });
    }

    let lawArticles = 0, lawParagraphs = 0, lawItemCount = 0;
    for (const art of articles) {
      const article = await prisma.article.create({
        data: { lawId: law.id, chapter: art.chapter, section: art.section, title: art.title, order: art.order },
      });
      lawArticles++;
      for (const para of art.paragraphs) {
        const paragraph = await prisma.paragraph.create({
          data: { articleId: article.id, number: para.number, content: para.content || null, order: para.order },
        });
        lawParagraphs++;
        for (const item of para.items) {
          await prisma.item.create({
            data: { paragraphId: paragraph.id, number: item.number, content: item.content, order: item.order },
          });
          lawItemCount++;
        }
      }
    }

    totalArticles += lawArticles;
    totalParagraphs += lawParagraphs;
    totalItems += lawItemCount;
    backfilled++;
    console.log(`✅ ${title} → 完整导入 (lawId=${law.id}, ${lawArticles}条/${lawParagraphs}款/${lawItemCount}项)`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('结果');
  console.log('='.repeat(60));
  console.log(`Stub创建: ${created}`);
  console.log(`元数据补全: ${enriched}`);
  console.log(`全文回填: ${backfilled}`);
  console.log(`规章库无匹配: ${noMatch}`);
  console.log(`无全文/无法解析: ${noText}`);
  console.log(`创建: 条文${totalArticles} / 款${totalParagraphs} / 项${totalItems}`);

  await prisma.$disconnect();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
