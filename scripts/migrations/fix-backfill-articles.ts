import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '..', '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CACHE_FILE = path.join(__dirname, '..', 'data', 'guizhangku-cache.json');
const CN_NUM = '一二三四五六七八九十百零〇两千万亿';

interface GZKRecord {
  f_202321360426: string;
  f_202321758948: string;
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

function extractPreambleFromFullText(fullText: string): string | null {
  const match = fullText.match(/[（(].*?(?:公布|修正|修订|修改|施行|通过).*?[）)]/);
  return match ? match[0].trim() : null;
}

function extractChapter1FromFullText(fullText: string): string | null {
  const firstArticleMatch = fullText.match(new RegExp(`第[${CN_NUM}\\d]+条[　\\s]`));
  if (!firstArticleMatch || firstArticleMatch.index === undefined) return null;

  const beforeFirstArticle = fullText.substring(0, firstArticleMatch.index);
  const chapterMatch = beforeFirstArticle.match(new RegExp(`(第[${CN_NUM}\\d]+章)[　\\s]*([^第]*)`));
  if (!chapterMatch) return null;

  return `${chapterMatch[1]} ${chapterMatch[2]}`.trim();
}

async function main() {
  console.log('='.repeat(60));
  console.log('修复 backfill 导入的条款数据');
  console.log('='.repeat(60));

  // Phase 1: Diagnostics
  const affectedArticles = await prisma.article.findMany({
    where: { title: { startsWith: '第' } },
    select: { id: true, lawId: true, title: true, chapter: true, order: true },
  });

  const affectedLawIds = [...new Set(affectedArticles.map(a => a.lawId))];
  console.log(`\n受影响条款: ${affectedArticles.length}`);
  console.log(`受影响法规: ${affectedLawIds.length}`);

  if (affectedArticles.length === 0) {
    console.log('无需修复，退出');
    await prisma.$disconnect();
    return;
  }

  // Load cache for preamble and chapter fix
  let titleMap: Map<string, GZKRecord> | null = null;
  let titleMapNoTrial: Map<string, GZKRecord> | null = null;
  if (fs.existsSync(CACHE_FILE)) {
    const records: GZKRecord[] = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    console.log(`已加载缓存: ${records.length} 条记录`);
    titleMap = new Map();
    titleMapNoTrial = new Map();
    for (const r of records) {
      const rawTitle = (r.f_202321360426 || '').replace(/<[^>]+>/g, '');
      const title = normalizeTitle(rawTitle);
      if (title) {
        titleMap.set(title, r);
        titleMapNoTrial.set(title.replace(/\(试行\)$/, ''), r);
      }
    }
  } else {
    console.log('⚠ 缓存文件不存在，将跳过序言和章节修复');
  }

  // Phase 2: Fix article titles
  console.log('\n--- 修复条款标题 ---');
  let titleFixed = 0;
  for (const art of affectedArticles) {
    const match = art.title.match(/^第(.+)条$/);
    if (match) {
      await prisma.article.update({
        where: { id: art.id },
        data: { title: match[1] },
      });
      titleFixed++;
    }
  }
  console.log(`标题修复: ${titleFixed} 条`);

  // Phase 3: Fix preambles and Chapter 1
  if (titleMap && titleMapNoTrial) {
    console.log('\n--- 修复序言和第一章 ---');
    const affectedLaws = await prisma.law.findMany({
      where: { id: { in: affectedLawIds } },
      select: { id: true, title: true, preamble: true },
    });

    let preambleFixed = 0;
    let chapter1Fixed = 0;

    for (const law of affectedLaws) {
      const nt = normalizeTitle(law.title);
      const ntNoTrial = nt.replace(/\(试行\)$/, '');
      const record = titleMap.get(nt)
        || titleMap.get(ntNoTrial)
        || titleMapNoTrial.get(nt)
        || titleMapNoTrial.get(ntNoTrial);

      if (!record || !record.f_202321758948) continue;

      const fullText = record.f_202321758948;

      // Fix preamble
      const newPreamble = extractPreambleFromFullText(fullText);
      if (law.preamble !== newPreamble) {
        await prisma.law.update({
          where: { id: law.id },
          data: { preamble: newPreamble },
        });
        preambleFixed++;
      }

      // Fix Chapter 1
      const chapter1 = extractChapter1FromFullText(fullText);
      if (chapter1) {
        const lawArticles = affectedArticles
          .filter(a => a.lawId === law.id)
          .sort((a, b) => a.order - b.order);

        const firstChapteredArticle = lawArticles.find(a => a.chapter !== null);
        if (firstChapteredArticle) {
          const nullChapterArticles = lawArticles.filter(
            a => a.chapter === null && a.order < firstChapteredArticle.order
          );
          if (nullChapterArticles.length > 0) {
            await prisma.article.updateMany({
              where: {
                id: { in: nullChapterArticles.map(a => a.id) },
              },
              data: { chapter: chapter1 },
            });
            chapter1Fixed += nullChapterArticles.length;
          }
        }
      }
    }

    console.log(`序言修复: ${preambleFixed} 部法规`);
    console.log(`第一章修复: ${chapter1Fixed} 条`);
  }

  // Phase 4: Verification
  console.log('\n--- 验证 ---');
  const remaining = await prisma.article.count({
    where: { title: { startsWith: '第' } },
  });
  console.log(`残留未修复标题: ${remaining}`);

  const sampleLaw = await prisma.law.findUnique({
    where: { id: 7834 },
    select: { title: true, preamble: true },
  });
  if (sampleLaw) {
    console.log(`\n样本 [7834] ${sampleLaw.title}`);
    console.log(`  序言: ${sampleLaw.preamble ? sampleLaw.preamble.substring(0, 80) + '...' : '(null)'}`);
  }

  const sampleArticles = await prisma.article.findMany({
    where: { lawId: 7834 },
    orderBy: { order: 'asc' },
    take: 5,
    select: { title: true, chapter: true, order: true },
  });
  for (const a of sampleArticles) {
    console.log(`  条${a.order}: title="${a.title}" chapter="${a.chapter}"`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('修复完成');
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
