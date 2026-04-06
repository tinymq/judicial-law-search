/**
 * 数据验证器
 * 验证解析后的数据，生成三个列表
 */

import { ParsedViolation, ArticleMatchResult, ValidationResult } from './types';
import { matchLaw } from './law-matcher';
import { parseArticleLevel } from './article-parser';
import { prisma } from '@/src/lib/db';

/**
 * 标准化法规名称，用于匹配
 * 移除书名号，统一括号格式
 */
function normalizeLawName(lawName: string): string {
  return lawName
    .replace(/《|》/g, '') // 移除书名号
    .replace(/（/g, '(')  // 中文括号转英文
    .replace(/）/g, ')')  // 中文括号转英文
    .trim();
}

/**
 * 验证单个条款的匹配情况
 */
async function matchArticle(
  lawName: string,
  articleTitle: string,
  allLaws: Map<string, number>,
  allLawsOriginal: Map<string, { id: number; title: string }>
): Promise<ArticleMatchResult> {
  // 尝试多种匹配方式
  let lawId = allLaws.get(lawName);

  // 如果直接匹配失败，尝试标准化后再匹配
  if (!lawId) {
    const normalized = normalizeLawName(lawName);
    lawId = allLaws.get(normalized);
  }

  // 如果还是找不到，尝试包含匹配（移除年份和状态）
  if (!lawId) {
    const cleanName = lawName
      .replace(/《|》/g, '')
      .replace(/[（\(][^））]*[））]/g, '') // 移除所有括号内容
      .trim();

    // 在所有法规中查找包含清理后名称的
    for (const [title, info] of allLawsOriginal.entries()) {
      const normalizedTitle = normalizeLawName(title);
      const cleanTitle = normalizedTitle.replace(/[（\(][^））]*[））]/g, '').trim();

      if (cleanTitle.includes(cleanName) || cleanName.includes(cleanTitle)) {
        lawId = info.id;
        break;
      }
    }
  }

  if (!lawId) {
    return {
      parsedArticle: {
        lawName,
        articleTitle,
        fullCitation: '',
      },
      lawId: null,
      articleId: null,
      paragraphId: null,
      itemId: null,
      matchSuccess: false,
      reason: '法规未找到',
    };
  }

  // 解析条款层级
  const level = parseArticleLevel(articleTitle);

  // 标准化条款标题：移除"第"和"条"，只保留数字部分
  // 例如："第四十六条" -> "四十六"
  const normalizedArticleTitle = level.article
    .replace(/^第/, '')
    .replace(/条$/, '');

  // 查找Article - 使用标准化后的标题
  const article = await prisma.article.findFirst({
    where: {
      lawId,
      title: normalizedArticleTitle, // 使用标准化标题
    },
    select: {
      id: true,
      paragraphs: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          number: true,
          items: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              number: true,
            },
          },
        },
      },
    },
  });

  if (!article) {
    return {
      parsedArticle: {
        lawName,
        articleTitle,
        fullCitation: '',
      },
      lawId,
      articleId: null,
      paragraphId: null,
      itemId: null,
      matchSuccess: false,
      reason: '条款未找到',
    };
  }

  // 如果有款，查找款
  if (level.paragraph) {
    const paragraphIndex = parseParagraphNumber(level.paragraph);
    const paragraph = article.paragraphs[paragraphIndex - 1];

    if (!paragraph) {
      return {
        parsedArticle: {
          lawName,
          articleTitle,
          fullCitation: '',
        },
        lawId,
        articleId: article.id,
        paragraphId: null,
        itemId: null,
        matchSuccess: false,
        reason: '款未找到',
      };
    }

    // 如果有项，查找项
    if (level.item) {
      const itemNumber = normalizeItemNumber(level.item);
      const item = paragraph.items.find((i) => i.number === itemNumber);

      if (!item) {
        return {
          parsedArticle: {
            lawName,
            articleTitle,
            fullCitation: '',
          },
          lawId,
          articleId: article.id,
          paragraphId: paragraph.id,
          itemId: null,
          matchSuccess: false,
          reason: '项未找到',
        };
      }

      return {
        parsedArticle: {
          lawName,
          articleTitle,
          fullCitation: '',
        },
        lawId,
        articleId: article.id,
        paragraphId: paragraph.id,
        itemId: item.id,
        matchSuccess: true,
      };
    }

    // 只有款，没有项
    return {
      parsedArticle: {
        lawName,
        articleTitle,
        fullCitation: '',
      },
      lawId,
      articleId: article.id,
      paragraphId: paragraph.id,
      itemId: null,
      matchSuccess: true,
    };
  }

  // 只有条，没有款和项
  return {
    parsedArticle: {
      lawName,
      articleTitle,
      fullCitation: '',
    },
    lawId,
    articleId: article.id,
    paragraphId: null,
    itemId: null,
    matchSuccess: true,
  };
}

/**
 * 解析款的数字：第一款 -> 1, 第二款 -> 2
 */
function parseParagraphNumber(paragraphTitle: string): number {
  const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const match = paragraphTitle.match(/第([一二三四五六七八九十百千\d]+)款/);
  if (!match) return 1;

  const num = match[1];
  const index = chineseNums.indexOf(num);
  if (index !== -1) return index;

  return parseInt(num) || 1;
}

/**
 * 标准化项的编号：（一）-> （一）, 1 -> （1）
 */
function normalizeItemNumber(itemNumber: string): string {
  // 如果已经有括号，直接返回
  if (/^[\(（].*[\)）]$/.test(itemNumber)) {
    return itemNumber;
  }

  // 否则添加括号
  return `（${itemNumber}）`;
}

/**
 * 验证解析后的违法行为数据
 */
export async function validateViolations(
  violations: ParsedViolation[]
): Promise<ValidationResult> {
  console.log('开始验证数据...');

  // 加载所有法规
  const allLawsData = await prisma.law.findMany({
    select: {
      id: true,
      title: true,
    },
  });

  // 创建两个Map：原始标题和标准化标题
  const allLaws = new Map<string, number>();
  const allLawsOriginal = new Map<string, { id: number; title: string }>();

  for (const law of allLawsData) {
    const normalizedTitle = normalizeLawName(law.title);
    allLaws.set(law.title.trim(), law.id);
    allLaws.set(normalizedTitle, law.id); // 同时存储标准化名称
    allLawsOriginal.set(law.title, { id: law.id, title: law.title });
  }

  console.log(`数据库中共有 ${allLawsData.length} 部法规`);

  // 分类存储
  const availableData: ValidationResult['availableData'] = [];
  const violationsWithMissingLaws: ValidationResult['violationsWithMissingLaws'] = [];
  const unmatchedArticles: ValidationResult['unmatchedArticles'] = [];
  const missingLawsMap = new Map<string, number[]>(); // lawName -> violationIds

  // 逐个验证违法行为
  for (const violation of violations) {
    const lawNames = new Set<string>();

    // 收集所有涉及的法规名称
    violation.violationBasis.forEach((v) => lawNames.add(v.lawName));
    violation.punishmentBasis.forEach((v) => lawNames.add(v.lawName));

    // 检查是否有缺失的法规
    const missingLawNames: string[] = [];
    for (const lawName of lawNames) {
      // 尝试多种匹配方式
      let found = false;

      // 1. 直接匹配
      if (allLaws.has(lawName)) {
        found = true;
      }

      // 2. 标准化后匹配
      if (!found) {
        const normalized = normalizeLawName(lawName);
        if (allLaws.has(normalized)) {
          found = true;
        }
      }

      // 3. 清理后匹配（移除括号内容）
      if (!found) {
        const cleanName = lawName
          .replace(/《|》/g, '')
          .replace(/[（\(][^））]*[））]/g, '')
          .trim();

        for (const [title, info] of allLawsOriginal.entries()) {
          const normalizedTitle = normalizeLawName(title);
          const cleanTitle = normalizedTitle.replace(/[（\(][^））]*[））]/g, '').trim();

          if (cleanTitle.includes(cleanName) || cleanName.includes(cleanTitle)) {
            found = true;
            break;
          }
        }
      }

      if (!found) {
        missingLawNames.push(lawName);
      }
    }

    // 如果有缺失法规，加入单独列表
    if (missingLawNames.length > 0) {
      violationsWithMissingLaws.push({
        violation,
        missingLawNames,
      });

      // 记录到缺失法规统计
      for (const lawName of missingLawNames) {
        if (!missingLawsMap.has(lawName)) {
          missingLawsMap.set(lawName, []);
        }
        missingLawsMap.get(lawName)!.push(violation.id);
      }

      continue;
    }

    // 匹配所有条款
    const violationBasisMatches: ArticleMatchResult[] = [];
    const punishmentBasisMatches: ArticleMatchResult[] = [];

    const hasUnmatchedViolationBasis = await Promise.all(
      violation.violationBasis.map(async (article) => {
        const match = await matchArticle(article.lawName, article.articleTitle, allLaws, allLawsOriginal);
        violationBasisMatches.push(match);
        return !match.matchSuccess;
      })
    );

    const hasUnmatchedPunishmentBasis = await Promise.all(
      violation.punishmentBasis.map(async (article) => {
        const match = await matchArticle(article.lawName, article.articleTitle, allLaws, allLawsOriginal);
        punishmentBasisMatches.push(match);
        return !match.matchSuccess;
      })
    );

    // 检查是否有未匹配的条款
    const unmatchedBasis: typeof unmatchedArticles[0]['unmatchedBasis'] = [];

    violationBasisMatches.forEach((match, idx) => {
      if (!match.matchSuccess) {
        unmatchedBasis.push({
          type: 'violation',
          article: violation.violationBasis[idx],
          reason: match.reason || '未知原因',
        });
      }
    });

    punishmentBasisMatches.forEach((match, idx) => {
      if (!match.matchSuccess) {
        unmatchedBasis.push({
          type: 'punishment',
          article: violation.punishmentBasis[idx],
          reason: match.reason || '未知原因',
        });
      }
    });

    // 如果有未匹配条款
    if (unmatchedBasis.length > 0) {
      unmatchedArticles.push({
        violation,
        unmatchedBasis,
      });
    }

    // 如果全部匹配成功，加入可导入列表
    if (unmatchedBasis.length === 0) {
      availableData.push({
        violation,
        matches: {
          violationBasis: violationBasisMatches,
          punishmentBasis: punishmentBasisMatches,
        },
      });
    }
  }

  // 生成缺失法规列表
  const missingLaws = Array.from(missingLawsMap.entries()).map(([lawName, violationIds]) => ({
    lawName,
    violationsCount: violationIds.length,
    violationIds,
  }));

  // 计算统计信息
  const statistics = {
    totalViolations: violations.length,
    availableCount: availableData.length,
    missingLawsCount: missingLaws.length,
    violationsWithMissingLawsCount: violationsWithMissingLaws.length,
    unmatchedArticlesCount: unmatchedArticles.length,
    successRate: (availableData.length / violations.length) * 100,
  };

  console.log('验证完成！');
  console.log(`总计: ${statistics.totalViolations} 条`);
  console.log(`可导入: ${statistics.availableCount} 条 (${statistics.successRate.toFixed(1)}%)`);
  console.log(`缺失法规: ${statistics.missingLawsCount} 部`);
  console.log(`含缺失法规的违法行为: ${statistics.violationsWithMissingLawsCount} 条`);
  console.log(`条款未匹配: ${statistics.unmatchedArticlesCount} 条`);

  return {
    availableData,
    missingLaws,
    violationsWithMissingLaws,
    unmatchedArticles,
    statistics,
  };
}
