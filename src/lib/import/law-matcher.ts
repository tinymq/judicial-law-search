/**
 * 法规匹配器
 * 三层匹配算法：精确匹配 → 包含匹配 → 关键词匹配
 */

import { LawMatchResult } from './types';

/**
 * 匹配法规名称到数据库中的法规
 * @param lawName - Excel中的法规名称
 * @param allLaws - 数据库中所有法规的列表
 * @returns 匹配结果
 */
export function matchLaw(
  lawName: string,
  allLaws: Array<{ id: number; title: string }>
): LawMatchResult {
  const cleanLawName = lawName.trim().toLowerCase();

  // 第一层：精确匹配
  const exactMatch = allLaws.find((law) => law.title.toLowerCase() === cleanLawName);
  if (exactMatch) {
    return {
      lawName,
      lawId: exactMatch.id,
      matchType: 'exact',
      confidence: 1.0,
    };
  }

  // 第二层：包含匹配（处理Excel中名称是数据库名称的子串）
  const containsMatch = allLaws.find((law) => {
    const cleanTitle = law.title.toLowerCase();
    // Excel名称包含在数据库标题中，或数据库标题包含在Excel名称中
    return (
      cleanTitle.includes(cleanLawName) || cleanLawName.includes(cleanTitle)
    );
  });

  if (containsMatch) {
    return {
      lawName,
      lawId: containsMatch.id,
      matchType: 'contains',
      confidence: 0.8,
    };
  }

  // 第三层：关键词匹配（提取核心关键词）
  const keywords = extractKeywords(lawName);
  const fuzzyMatches = allLaws
    .map((law) => ({
      law,
      score: calculateKeywordScore(keywords, law.title),
    }))
    .filter((item) => item.score > 0.5)
    .sort((a, b) => b.score - a.score);

  if (fuzzyMatches.length > 0) {
    const bestMatch = fuzzyMatches[0];
    return {
      lawName,
      lawId: bestMatch.law.id,
      matchType: 'fuzzy',
      confidence: bestMatch.score,
      suggestions: fuzzyMatches.slice(0, 3).map((m) => m.law.id),
    };
  }

  // 未匹配
  return {
    lawName,
    lawId: null,
    matchType: 'none',
    confidence: 0,
    suggestions: fuzzyMatches.slice(0, 5).map((m) => m.law.id),
  };
}

/**
 * 提取法规名称中的关键词
 * 去除常见的前缀、后缀和虚词
 */
function extractKeywords(lawName: string): string[] {
  const commonPrefixes = [
    '中华人民共和国',
    '市',
    '省',
    '自治区',
    '直辖市',
    '县',
    '区',
  ];
  const commonSuffixes = [
    '办法',
    '规定',
    '条例',
    '实施细则',
    '暂行',
    '试行',
  ];

  let keywords = lawName.trim();

  // 移除前缀
  for (const prefix of commonPrefixes) {
    if (keywords.startsWith(prefix)) {
      keywords = keywords.substring(prefix.length);
      break;
    }
  }

  // 移除后缀
  for (const suffix of commonSuffixes) {
    keywords = keywords.replace(suffix, '');
  }

  // 分词（按中文分词，简单实现：每2-4个字符为一组）
  const words: string[] = [];
  for (let i = 0; i < keywords.length; i += 2) {
    const len = Math.min(4, keywords.length - i);
    words.push(keywords.substring(i, i + len));
  }

  return words.filter((w) => w.length >= 2);
}

/**
 * 计算关键词匹配分数
 */
function calculateKeywordScore(keywords: string[], title: string): number {
  const lowerTitle = title.toLowerCase();
  let matchCount = 0;

  for (const keyword of keywords) {
    if (lowerTitle.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  return keywords.length > 0 ? matchCount / keywords.length : 0;
}

/**
 * 批量匹配法规名称
 */
export function matchLawsBatch(
  lawNames: string[],
  allLaws: Array<{ id: number; title: string }>
): Map<string, LawMatchResult> {
  const results = new Map<string, LawMatchResult>();
  const processed = new Set<string>();

  for (const lawName of lawNames) {
    const key = lawName.trim();
    if (!key || processed.has(key)) continue;

    processed.add(key);
    const result = matchLaw(key, allLaws);
    results.set(key, result);
  }

  return results;
}

/**
 * 获取缺失的法规列表（匹配失败的法规）
 */
export function getMissingLaws(
  matchResults: Map<string, LawMatchResult>
): Array<{ lawName: string; suggestions: number[] }> {
  const missing: Array<{ lawName: string; suggestions: number[] }> = [];

  for (const [lawName, result] of matchResults.entries()) {
    if (result.matchType === 'none') {
      missing.push({
        lawName,
        suggestions: result.suggestions || [],
      });
    }
  }

  return missing.sort((a, b) => a.lawName.localeCompare(b.lawName));
}
