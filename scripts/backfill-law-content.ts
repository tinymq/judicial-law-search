import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CACHE_FILE = path.join(__dirname, 'data', 'guizhangku-cache.json');

interface GZKRecord {
  f_202321360426: string;
  f_202344311304: string;
  f_202321758948: string;
  f_202323394765: string;
  f_202355832506: string;
  f_202321915922: string;
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

const CN_NUM = '一二三四五六七八九十百零〇两千万亿';
const ARTICLE_RE = new RegExp(`第[${CN_NUM}\\d]+条[　\\s]`, 'g');
const CHAPTER_RE = new RegExp(`第[${CN_NUM}\\d]+章[　\\s]*[^第]*?(?=第[${CN_NUM}\\d]+(?:章|节|条))`, 'g');
const ITEM_RE = /[（(]([一二三四五六七八九十百零]+)[）)]/g;

function splitArticles(fullText: string): { preamble: string; articles: ParsedArticle[] } {
  // Bug fix: only extract parenthesized revision info as preamble, not the law title
  let preamble = '';
  const preambleMatch = fullText.match(/[（(].*?(?:公布|修正|修订|修改|施行|通过).*?[）)]/);
  if (preambleMatch) {
    preamble = preambleMatch[0].trim();
  }

  // Find where the first article begins — that's where bodyText starts
  const firstArticleMatch = fullText.match(new RegExp(`第[${CN_NUM}\\d]+条[　\\s]`));
  let bodyText = fullText;
  let gapText = '';
  if (firstArticleMatch && firstArticleMatch.index !== undefined) {
    const gapStart = preambleMatch
      ? (preambleMatch.index! + preambleMatch[0].length)
      : 0;
    gapText = fullText.substring(gapStart, firstArticleMatch.index);
    bodyText = fullText.substring(firstArticleMatch.index);
  }

  const articlePositions: { index: number; title: string }[] = [];
  const articleSplitRe = new RegExp(`(第[${CN_NUM}\\d]+条)[　\\s]`, 'g');
  let m: RegExpExecArray | null;
  while ((m = articleSplitRe.exec(bodyText)) !== null) {
    articlePositions.push({ index: m.index, title: m[1] });
  }

  if (articlePositions.length === 0) {
    return { preamble: preamble || fullText, articles: [] };
  }

  // Bug fix: detect chapter/section headers in the gap before the first article
  let currentChapter: string | null = null;
  let currentSection: string | null = null;
  const chapterReStr = `(第[${CN_NUM}\\d]+章)[　\\s]*([^第]*)`;
  const sectionReStr = `(第[${CN_NUM}\\d]+节)[　\\s]*([^第]*)`;

  const gapChapterMatch = gapText.match(new RegExp(chapterReStr));
  if (gapChapterMatch) {
    currentChapter = `${gapChapterMatch[1]} ${gapChapterMatch[2]}`.trim();
  }
  const gapSectionMatch = gapText.match(new RegExp(sectionReStr));
  if (gapSectionMatch) {
    currentSection = `${gapSectionMatch[1]} ${gapSectionMatch[2]}`.trim();
  }

  const chapterRe = new RegExp(chapterReStr, 'g');
  const sectionRe = new RegExp(sectionReStr, 'g');

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

    for (const cp of chapterPositions) {
      if (cp.index <= pos.index) currentChapter = cp.title;
    }
    for (const sp of sectionPositions) {
      if (sp.index <= pos.index) currentSection = sp.title;
    }

    const startIdx = pos.index + pos.title.length + 1;
    const endIdx = nextPos ? nextPos.index : bodyText.length;
    let rawContent = bodyText.substring(startIdx, endIdx).trim();

    const chapterInContent = new RegExp(`\\s*第[${CN_NUM}\\d]+章[　\\s]+[^第]*$`);
    const sectionInContent = new RegExp(`\\s*第[${CN_NUM}\\d]+节[　\\s]+[^第]*$`);
    rawContent = rawContent.replace(chapterInContent, '').replace(sectionInContent, '').trim();

    const paragraphs = parseParagraphs(rawContent);

    // Bug fix: normalize article title — strip "第" and "条" to store just the number
    const normalizedTitle = pos.title.replace(/^第/, '').replace(/条$/, '');

    articles.push({
      chapter: currentChapter,
      section: currentSection,
      title: normalizedTitle,
      order: i + 1,
      paragraphs,
    });
  }

  return { preamble, articles };
}

function parseParagraphs(articleContent: string): ParsedParagraph[] {
  const itemPositions: number[] = [];
  const itemReLocal = /[（(]([一二三四五六七八九十百零]+)[）)]/g;
  let m: RegExpExecArray | null;
  while ((m = itemReLocal.exec(articleContent)) !== null) {
    itemPositions.push(m.index);
  }

  if (itemPositions.length === 0) {
    return [{
      number: 1,
      content: articleContent,
      order: 1,
      items: [],
    }];
  }

  const beforeItems = articleContent.substring(0, itemPositions[0]).trim();
  const itemsText = articleContent.substring(itemPositions[0]);

  const paragraphs: ParsedParagraph[] = [];
  let pOrder = 1;

  if (beforeItems) {
    paragraphs.push({
      number: pOrder,
      content: beforeItems,
      order: pOrder,
      items: [],
    });
    pOrder++;
  }

  const items = parseItems(itemsText);
  paragraphs.push({
    number: pOrder,
    content: '',
    order: pOrder,
    items,
  });

  const afterLastItem = findTextAfterItems(articleContent, itemPositions);
  if (afterLastItem) {
    pOrder++;
    paragraphs.push({
      number: pOrder,
      content: afterLastItem,
      order: pOrder,
      items: [],
    });
  }

  return paragraphs;
}

function findTextAfterItems(content: string, itemPositions: number[]): string | null {
  if (itemPositions.length === 0) return null;
  const lastItemStart = itemPositions[itemPositions.length - 1];
  const itemEndRe = /[。；]/g;
  let lastEnd = lastItemStart;
  let m: RegExpExecArray | null;
  itemEndRe.lastIndex = lastItemStart;

  const remaining = content.substring(lastItemStart);
  const nextItemOrEnd = remaining.match(/[（(][一二三四五六七八九十百零]+[）)]/g);
  if (!nextItemOrEnd) return null;

  const lastItemMatch = remaining.match(/^[（(][一二三四五六七八九十百零]+[）)][^（(]*/);
  if (!lastItemMatch) return null;

  const afterLastItemContent = content.substring(lastItemStart + lastItemMatch[0].length).trim();
  if (afterLastItemContent && !afterLastItemContent.match(/^[（(][一二三四五六七八九十百零]+[）)]/)) {
    return afterLastItemContent;
  }
  return null;
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
    const content = itemsText.substring(start, end).trim();
    items.push({
      number: positions[i].number,
      content,
      order: i + 1,
    });
  }
  return items;
}

function normalizeTitle(t: string): string {
  return t
    .replace(/<[^>]+>/g, '')
    .replace(/[《》''「」【】\s]/g, '')
    .replace(/["""""]/g, '"')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .replace(/\(试行\)/g, '').replace(/（试行）/g, '')
    .trim();
}

async function main() {
  console.log('='.repeat(60));
  console.log('Phase 3: Full Text Backfill');
  console.log('='.repeat(60));

  const records: GZKRecord[] = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  console.log(`Loaded ${records.length} records from cache`);

  const titleMap = new Map<string, GZKRecord>();
  const titleMapNoTrial = new Map<string, GZKRecord>();
  for (const r of records) {
    const rawTitle = (r.f_202321360426 || '').replace(/<[^>]+>/g, '');
    const title = normalizeTitle(rawTitle);
    if (title) {
      titleMap.set(title, r);
      titleMapNoTrial.set(title.replace(/\(试行\)$/, ''), r);
    }
  }

  const stubLaws = await prisma.law.findMany({
    where: {
      level: '部门规章',
      articles: { none: {} },
    },
    select: { id: true, title: true },
  });
  console.log(`Found ${stubLaws.length} laws without articles\n`);

  let processed = 0, backfilled = 0, noText = 0, noMatch = 0, errors = 0;
  let totalArticles = 0, totalParagraphs = 0, totalItems = 0;

  for (const law of stubLaws) {
    const normalizedTitle = normalizeTitle(law.title);
    const noTrialTitle = normalizedTitle.replace(/\(试行\)$/, '');
    const record = titleMap.get(normalizedTitle)
      || titleMap.get(noTrialTitle)
      || titleMapNoTrial.get(normalizedTitle)
      || titleMapNoTrial.get(noTrialTitle);

    if (!record) {
      noMatch++;
      continue;
    }

    const fullText = record.f_202321758948;
    if (!fullText || fullText.length < 50) {
      noText++;
      continue;
    }

    processed++;

    try {
      const { preamble, articles } = splitArticles(fullText);

      if (articles.length === 0) {
        noText++;
        continue;
      }

      if (preamble) {
        await prisma.law.update({
          where: { id: law.id },
          data: { preamble },
        });
      }

      for (const art of articles) {
        const article = await prisma.article.create({
          data: {
            lawId: law.id,
            chapter: art.chapter,
            section: art.section,
            title: art.title,
            order: art.order,
          },
        });
        totalArticles++;

        for (const para of art.paragraphs) {
          const paragraph = await prisma.paragraph.create({
            data: {
              articleId: article.id,
              number: para.number,
              content: para.content || null,
              order: para.order,
            },
          });
          totalParagraphs++;

          for (const item of para.items) {
            await prisma.item.create({
              data: {
                paragraphId: paragraph.id,
                number: item.number,
                content: item.content,
                order: item.order,
              },
            });
            totalItems++;
          }
        }
      }

      backfilled++;
      if (backfilled % 50 === 0) {
        console.log(`  Progress: ${backfilled} laws backfilled (${totalArticles} articles)`);
      }
    } catch (err) {
      errors++;
      console.error(`  ERROR [${law.title}]: ${err}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Laws processed: ${processed}`);
  console.log(`Laws backfilled: ${backfilled}`);
  console.log(`No match in cache: ${noMatch}`);
  console.log(`No text / no articles parsed: ${noText}`);
  console.log(`Errors: ${errors}`);
  console.log(`\nCreated:`);
  console.log(`  Articles: ${totalArticles}`);
  console.log(`  Paragraphs: ${totalParagraphs}`);
  console.log(`  Items: ${totalItems}`);

  const totalLawsWithArticles = await prisma.law.count({
    where: { articles: { some: {} } },
  });
  console.log(`\nTotal laws with articles in DB: ${totalLawsWithArticles}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
