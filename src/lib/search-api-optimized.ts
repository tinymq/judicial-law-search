/**
 * 优化的搜索 API
 * 使用 UNION ALL 一次查询所有层级，支持分页
 */

import { prisma } from '@/src/lib/db';
import { normalizeArticleSearch, calculateRelevanceScore, buildBreadcrumb } from './search-optimized';

/**
 * 优化的法条搜索
 * 使用 UNION ALL 一次查询所有层级
 */
export async function searchLegalProvisionsOptimized(
  keyword: string,
  lawId?: number,
  limit: number = 50,
  offset: number = 0
) {
  if (!keyword || keyword.trim().length < 2) {
    return {
      results: [],
      total: 0,
      hasMore: false
    };
  }

  const normalizedKeyword = normalizeArticleSearch(keyword.trim());
  const searchTerm = `%${normalizedKeyword}%`;
  const originalSearchTerm = `%${keyword.trim()}%`;

  // 使用 UNION ALL 一次查询所有层级
  // 注意：SQLite 不支持 OFFSET 在子查询中，所以我们在应用层处理分页
  const results = await prisma.$queryRaw`
    -- Article 层
    SELECT
      'article' as level,
      CAST(a.id AS TEXT) as id,
      l.id as lawId,
      l.title as lawTitle,
      a.id as articleId,
      a.title as articleTitle,
      NULL as paragraphId,
      NULL as paragraphNumber,
      NULL as itemId,
      NULL as itemNumber,
      COALESCE(
        (SELECT GROUP_CONCAT(p.content, ' ')
         FROM Paragraph p
         WHERE p.articleId = a.id),
        ''
      ) as content,
      '第' || a.title || '条' as displayText
    FROM Article a
    JOIN Law l ON a.lawId = l.id
    WHERE
      ${lawId ? prisma.Prisma.sql`a.lawId = ${lawId} AND` : prisma.Prisma.empty}
      (
        a.title LIKE ${searchTerm}
        OR EXISTS (
          SELECT 1 FROM Paragraph p
          WHERE p.articleId = a.id AND p.content LIKE ${originalSearchTerm}
        )
      )

    UNION ALL

    -- Paragraph 层
    SELECT
      'paragraph' as level,
      'p-' || CAST(p.id AS TEXT) as id,
      l.id as lawId,
      l.title as lawTitle,
      a.id as articleId,
      a.title as articleTitle,
      p.id as paragraphId,
      p.number as paragraphNumber,
      NULL as itemId,
      NULL as itemNumber,
      p.content as content,
      '第' || a.title || '条第' ||
        CASE p.number
          WHEN 1 THEN '一'
          WHEN 2 THEN '二'
          WHEN 3 THEN '三'
          WHEN 4 THEN '四'
          WHEN 5 THEN '五'
          WHEN 6 THEN '六'
          WHEN 7 THEN '七'
          WHEN 8 THEN '八'
          WHEN 9 THEN '九'
          WHEN 10 THEN '十'
          ELSE CAST(p.number AS TEXT)
        END || '款' as displayText
    FROM Paragraph p
    JOIN Article a ON p.articleId = a.id
    JOIN Law l ON a.lawId = l.id
    WHERE
      ${lawId ? prisma.Prisma.sql`a.lawId = ${lawId} AND` : prisma.Prisma.empty}
      p.content LIKE ${originalSearchTerm}

    UNION ALL

    -- Item 层
    SELECT
      'item' as level,
      'i-' || CAST(i.id AS TEXT) as id,
      l.id as lawId,
      l.title as lawTitle,
      a.id as articleId,
      a.title as articleTitle,
      p.id as paragraphId,
      p.number as paragraphNumber,
      i.id as itemId,
      i.number as itemNumber,
      i.content as content,
      '第' || a.title || '条第' ||
        CASE p.number
          WHEN 1 THEN '一'
          WHEN 2 THEN '二'
          WHEN 3 THEN '三'
          WHEN 4 THEN '四'
          WHEN 5 THEN '五'
          WHEN 6 THEN '六'
          WHEN 7 THEN '七'
          WHEN 8 THEN '八'
          WHEN 9 THEN '九'
          WHEN 10 THEN '十'
          ELSE CAST(p.number AS TEXT)
        END || '款第' || i.number || '项' as displayText
    FROM Item i
    JOIN Paragraph p ON i.paragraphId = p.id
    JOIN Article a ON p.articleId = a.id
    JOIN Law l ON a.lawId = l.id
    WHERE
      ${lawId ? prisma.Prisma.sql`a.lawId = ${lawId} AND` : prisma.Prisma.empty}
      i.content LIKE ${originalSearchTerm}

    LIMIT ${limit + offset + 100}
  `;

  // 计算相关性分数并排序
  const scoredResults = (results as any[]).map(result => {
    const score = calculateRelevanceScore(
      result.displayText + ' ' + result.content,
      keyword
    );

    return {
      ...result,
      score,
      breadcrumb: buildBreadcrumb(
        result.lawTitle,
        result.articleTitle,
        result.paragraphNumber,
        result.itemNumber
      )
    };
  });

  // 按相关性分数排序
  scoredResults.sort((a, b) => b.score - a.score);

  // 应用分页
  const total = scoredResults.length;
  const paginatedResults = scoredResults.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return {
    results: paginatedResults,
    total,
    hasMore,
    keyword: keyword,
    normalizedKeyword: normalizedKeyword
  };
}

/**
 * 搜索法规（优化版）
 * 添加分页支持
 */
export async function searchLawsOptimized(
  keyword: string,
  limit: number = 20,
  offset: number = 0
) {
  if (!keyword || keyword.trim().length < 2) {
    return {
      results: [],
      total: 0,
      hasMore: false
    };
  }

  const searchTerm = `%${keyword.trim()}%`;

  // 查询总数
  const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM Law
    WHERE title LIKE ${searchTerm}
  `;
  const total = Number(countResult[0].count);

  // 查询结果（带分页）
  const laws = await prisma.$queryRaw`
    SELECT
      id,
      title,
      lawGroupId,
      effectiveDate,
      status,
      level,
      region
    FROM Law
    WHERE title LIKE ${searchTerm}
    ORDER BY
      CASE
        WHEN title = ${keyword.trim()} THEN 0
        WHEN title LIKE ${keyword.trim() + '%'} THEN 1
        ELSE 2
      END,
      effectiveDate DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const hasMore = offset + limit < total;

  return {
    results: laws,
    total,
    hasMore,
    keyword: keyword
  };
}
