/**
 * 把 Prisma 查询的 Law（含 articles/paragraphs/items）转换为
 * /smart 页面 RightDetail 组件需要的 LawDetail 结构
 */

import type { LawDetail, Chapter, Section, ArticleItem } from './data';

type PrismaItem = { id: number; number: string; content: string; order: number };
type PrismaParagraph = { id: number; number: number; content: string | null; order: number; items: PrismaItem[] };
type PrismaArticle = { id: number; chapter: string | null; section: string | null; title: string; order: number; paragraphs: PrismaParagraph[] };
type PrismaLaw = {
  id: number;
  title: string;
  level: string;
  status: string | null;
  issuingAuthority: string | null;
  documentNumber: string | null;
  preamble: string | null;
  promulgationDate: Date | null;
  effectiveDate: Date | null;
  articles: PrismaArticle[];
};

function formatDate(d: Date | null): string {
  if (!d) return '暂无';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function extractItems(paragraphs: PrismaParagraph[]): string[] {
  const result: string[] = [];
  for (const p of paragraphs) {
    if (p.items && p.items.length > 0) {
      for (const it of p.items) {
        const prefix = it.number ? `${it.number} ` : '';
        result.push(`${prefix}${it.content}`);
      }
    } else if (p.content) {
      result.push(p.content);
    }
  }
  return result;
}

function articleHasHit(article: PrismaArticle, query: string): boolean {
  if (!query) return false;
  for (const p of article.paragraphs) {
    if (p.content && p.content.includes(query)) return true;
    for (const it of p.items) {
      if (it.content && it.content.includes(query)) return true;
    }
  }
  return false;
}

/**
 * 把 Prisma Law 转为 LawDetail 结构，按 chapter/section 分组
 */
export function convertToLawDetail(law: PrismaLaw, query: string): LawDetail {
  const chaptersMap = new Map<string, Map<string, ArticleItem[]>>();
  const keyword = query ? [query] : [];

  for (const art of law.articles) {
    const chapterKey = art.chapter || '__NO_CHAPTER__';
    const sectionKey = art.section || '__NO_SECTION__';

    if (!chaptersMap.has(chapterKey)) {
      chaptersMap.set(chapterKey, new Map());
    }
    const sections = chaptersMap.get(chapterKey)!;
    if (!sections.has(sectionKey)) {
      sections.set(sectionKey, []);
    }

    const hit = articleHasHit(art, query);
    const item: ArticleItem = {
      no: art.title,
      title: '',
      hit,
      keyword,
      items: extractItems(art.paragraphs),
    };
    sections.get(sectionKey)!.push(item);
  }

  const chapters: Chapter[] = [];
  let chapterIdx = 0;
  for (const [chapterName, sections] of chaptersMap) {
    const chapterSections: Section[] = [];
    let sectionIdx = 0;
    for (const [sectionName, articles] of sections) {
      chapterSections.push({
        id: `s${chapterIdx}-${sectionIdx}`,
        name: sectionName === '__NO_SECTION__' ? '' : sectionName,
        articles,
      });
      sectionIdx++;
    }
    chapters.push({
      id: `ch${chapterIdx}`,
      name: chapterName === '__NO_CHAPTER__' ? '(未分章)' : chapterName,
      sections: chapterSections,
    });
    chapterIdx++;
  }

  // 如果整部法规没有 chapter/section 分组（全部在 __NO_CHAPTER__ 下），折叠成单层展示
  if (chapters.length === 1 && chapters[0].name === '(未分章)') {
    chapters[0].name = law.title;
  }

  // 查找 preamble 里的修订记录作为"最新修订"字段（简单截取）
  let revised = '';
  if (law.preamble) {
    const firstLine = law.preamble.split('\n').find((l) => /修[订正]/.test(l));
    if (firstLine) revised = firstLine.trim().slice(0, 40);
  }

  return {
    id: law.id,
    title: law.title,
    level: law.level,
    status: law.status || '现行有效',
    authority: law.issuingAuthority || '',
    docNumber: law.documentNumber || '',
    promulgated: formatDate(law.promulgationDate),
    effective: formatDate(law.effectiveDate),
    revised: revised || '暂无修订信息',
    chapters,
    // related / cites 暂 mock，M3 引入 ViolationTag 后接真
    related: [
      { name: '销售超过保质期食品', cases: 142 },
      { name: '未及时下架超过保质期食品', cases: 51 },
      { name: '经营标签不符合规定的食品', cases: 86 },
    ],
    cites: [
      { name: '消费者权益保护法 §55', note: '十倍赔偿条款' },
      { name: '产品质量法 §27', note: '标签标识' },
    ],
  };
}

/**
 * 法规标题简写 - 给 mindmap 节点 label 用
 * 如："中华人民共和国食品安全法" → "食品安全法"
 */
export function shortenLawTitle(title: string): string {
  return title
    .replace(/^中华人民共和国/, '')
    .replace(/^中国人民共和国/, '')
    .replace(/（.*?）/g, '')
    .replace(/\(.*?\)/g, '')
    .trim();
}
