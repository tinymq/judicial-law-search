/**
 * 条款解析器
 * 解析Excel中的【条款项】和【内容】字段
 */

import { ParsedArticle, ParsedViolation } from './types';

// 匹配条款层级：第X条、第X条第Y款、第X条第Y款第Z项
const ARTICLE_LEVEL_PATTERN = /第([一二三四五六七八九十百千\d]+)[条款]((?:第([一二三四五六七八九十百千\d]+)[款项])*)?(?:第([\(（][一二三四五六七八九十百千\d]+[\)）])项)？/;

/**
 * 解析单个依据字段（违法依据或处罚依据）
 * Excel格式示例：
 *   【法规】《中华人民共和国招标投标法实施条例》(2019年修订）
 *   【条款项】第七条
 *   【内容】按照国家有关规定需要履行...
 */
export function parseBasisField(basisField: string | undefined | null): ParsedArticle[] {
  if (!basisField || typeof basisField !== 'string' || basisField.trim() === '') {
    return [];
  }

  const articles: ParsedArticle[] = [];

  // 按照法规标签分割
  const parts = basisField.split(/【法规】/);

  for (const part of parts) {
    if (!part || !part.trim()) continue;

    // 提取法规名称（从开头到换行或【标签）
    // 格式可能是： 《法规名》(年份) 或 法规名（年份）
    let lawName = '';

    // 先尝试找到第一个【标签】或换行之前的内容作为法规名
    const lawEndMatch = part.match(/^(.+?)(?=[\n\r【]|$)/s);
    if (lawEndMatch) {
      lawName = lawEndMatch[1].trim();
    } else {
      // 如果没有换行，尝试其他匹配方式
      lawName = part.split('【')[0].trim();
    }

    if (!lawName) continue;

    // 提取年份（如果有的话）
    let lawYear: number | undefined = undefined;
    const yearMatch = lawName.match(/[(\(](\d{4})[年)）]/);
    if (yearMatch) {
      lawYear = parseInt(yearMatch[1]);
      // 从法规名中移除年份部分（包括可能的"修订"说明）
      lawName = lawName.replace(/[(\(]\d{4}[^)）]*[)）]/g, '').trim();
    }

    // 提取【条款项】
    const articleMatch = part.match(/【条款项】(.+?)(?=[\n\r]|【内容】|$)/s);
    const articleTitle = articleMatch ? articleMatch[1].trim() : '';

    // 提取【内容】
    const contentMatch = part.match(/【内容】(.+?)(?=[\n\r]|【法规】|$)/s);
    const content = contentMatch ? contentMatch[1].trim() : '';

    articles.push({
      lawName,
      lawYear,
      articleTitle,
      fullCitation: content || articleTitle, // 如果没有内容，就用条款标题
    });
  }

  return articles;
}

/**
 * 解析条款层级
 * 支持的格式：
 * - "第七条" → { article: "第七条" }
 * - "第七条第一款" → { article: "第七条", paragraph: "第一款" }
 * - "第七条第一项" → { article: "第七条", item: "一" }
 * - "第七条第一款第（一）项" → { article: "第七条", paragraph: "第一款", item: "一" }
 * - "第七条第一款第一项" → { article: "第七条", paragraph: "第一款", item: "一" }
 */
export function parseArticleLevel(articleTitle: string): {
  article: string;
  paragraph?: string;
  item?: string;
} {
  const result: { article: string; paragraph?: string; item?: string } = {
    article: '',
  };

  // 第一步：提取"第X条"或"第X款"
  const articleMatch = articleTitle.match(/^(第[一二三四五六七八九十百千\d]+[条款])/);
  if (articleMatch) {
    result.article = articleMatch[1];
    let remaining = articleTitle.substring(articleMatch[1].length).trim();

    // 第二步：检查剩余内容是否有款
    const paragraphMatch = remaining.match(/^(第[一二三四五六七八九十百千\d]+款)/);
    if (paragraphMatch) {
      result.paragraph = paragraphMatch[1];
      remaining = remaining.substring(paragraphMatch[1].length).trim();
    }

    // 第三步：检查剩余内容是否有项
    // 格式可能是：第（一）项、第一项、第1项
    const itemMatch = remaining.match(/^(第[（\(]?([一二三四五六七八九十百千\d]+)[））]?项)/);
    if (itemMatch) {
      result.item = itemMatch[2]; // 提取项的数字（不含括号）
    }
  } else {
    // 如果无法解析，返回整个标题作为article
    result.article = articleTitle;
  }

  return result;
}

/**
 * 格式化条款层级为完整引用
 */
export function formatArticleCitation(level: {
  article: string;
  paragraph?: string;
  item?: string;
}): string {
  const parts = [level.article];
  if (level.paragraph) parts.push(level.paragraph);
  if (level.item) parts.push(`第${level.item}项`);
  return parts.join('');
}

/**
 * 解析违法行为简称（从描述中提取关键词）
 */
export function extractShortName(description: string): string {
  if (!description) return '';

  // 常见模式：提取前10-15个字符
  const cleanDesc = description.trim();

  // 如果有标点符号，在第一个标点处截断
  const firstPunctuation = cleanDesc.match(/[，。；：,.;:]/);
  if (firstPunctuation && firstPunctuation.index! < 15) {
    return cleanDesc.substring(0, firstPunctuation.index).trim();
  }

  // 否则截取前12个字符
  return cleanDesc.substring(0, Math.min(12, cleanDesc.length)).trim();
}

/**
 * 生成违法行为编号（N001, M002等）
 * 根据Excel序号生成
 */
export function generateViolationCode(excelId: number, type: 'N' | 'M' = 'N'): string {
  return `${type}${String(excelId).padStart(3, '0')}`;
}

/**
 * 解析Excel中的一行数据
 */
export function parseExcelRow(row: any): ParsedViolation | null {
  try {
    const id = row['序号'];
    const description = (row['违法行为'] || '').toString().trim();
    const shortName = (row['违法行为简称'] || '').toString().trim() || extractShortName(description);
    const violationBasisStr = (row['违法依据'] || '').toString().trim();
    const punishmentBasisStr = (row['处罚依据'] || '').toString().trim();
    const discretionStandard = (row['裁量标准'] || '').toString().trim();
    const punishmentSuggestion = (row['处罚建议'] || '').toString().trim();

    // 解析违法依据和处罚依据
    const violationBasis = parseBasisField(violationBasisStr);
    const punishmentBasis = parseBasisField(punishmentBasisStr);

    // 生成编号（根据序号判断类型）
    const code = generateViolationCode(id);

    return {
      id,
      code,
      description,
      shortName,
      violationBasis,
      punishmentBasis,
      discretionStandard,
      punishmentSuggestion,
    };
  } catch (error) {
    console.error(`解析行 ${row?.['序号']} 失败:`, error);
    return null;
  }
}
