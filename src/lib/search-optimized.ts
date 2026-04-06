/**
 * 优化的搜索工具函数
 * 提供高效的法规和法条搜索功能
 */

/**
 * 标准化条款搜索输入
 * 支持多种格式：第18条、18条、第十八条等
 */
export function normalizeArticleSearch(keyword: string): string {
  return keyword
    .replace(/第([一二三四五六七八九十百]+)条/g, (match, chinese) => {
      const chineseToArabic: Record<string, string> = {
        '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
        '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
        '十一': '11', '十二': '12', '十三': '13', '十四': '14', '十五': '15',
        '十六': '16', '十七': '17', '十八': '18', '十九': '19', '二十': '20',
        '二十一': '21', '二十二': '22', '二十三': '23', '二十四': '24', '二十五': '25',
        '三十': '30', '四十': '40', '五十': '50', '六十': '60', '七十': '70',
        '八十': '80', '九十': '90', '一百': '100'
      };
      return chineseToArabic[chinese] || chinese;
    })
    .replace(/第?(\d+)条?/g, '$1')
    .replace(/条/g, '');
}

/**
 * 搜索结果类型
 */
export interface SearchResult {
  id: string;
  level: 'law' | 'article' | 'paragraph' | 'item';
  lawId: number;
  lawTitle: string;
  articleId?: number;
  articleTitle?: string;
  paragraphId?: number;
  paragraphNumber?: number;
  itemId?: number;
  itemNumber?: string;
  content: string;
  displayText: string;
  breadcrumb: string;
  score: number; // 相关性分数
}

/**
 * 搜索参数
 */
export interface SearchParams {
  keyword: string;
  lawId?: number; // 限定在某个法规内搜索
  level?: ('law' | 'article' | 'paragraph' | 'item')[]; // 搜索层级
  limit?: number; // 每层最多返回结果数
  offset?: number; // 分页偏移
}

/**
 * 计算相关性分数
 * 规则：
 * 1. 精确匹配：100分
 * 2. 标题开头匹配：80分
 * 3. 标题包含：60分
 * 4. 内容包含：40分
 */
export function calculateRelevanceScore(text: string, keyword: string): number {
  const normalizedText = text.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();

  if (normalizedText === normalizedKeyword) {
    return 100; // 精确匹配
  }

  if (normalizedText.startsWith(normalizedKeyword)) {
    return 80; // 标题开头匹配
  }

  if (normalizedText.includes(normalizedKeyword)) {
    // 根据位置调整分数
    const position = normalizedText.indexOf(normalizedKeyword);
    const ratio = 1 - (position / normalizedText.length);
    return Math.floor(60 * ratio); // 0-60分
  }

  return 0; // 不匹配
}

/**
 * 高亮显示关键词
 */
export function highlightKeyword(text: string, keyword: string): string {
  if (!keyword || !text) return text;

  const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 构建搜索面包屑
 */
export function buildBreadcrumb(
  lawTitle: string,
  articleTitle?: string,
  paragraphNumber?: number,
  itemNumber?: string
): string {
  const parts = [lawTitle];

  if (articleTitle) {
    parts.push(`第${articleTitle}条`);
  }

  if (paragraphNumber) {
    const chineseNumbers = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
      '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
    const cnNum = chineseNumbers[paragraphNumber] || paragraphNumber.toString();
    parts.push(`第${cnNum}款`);
  }

  if (itemNumber) {
    parts.push(`第${itemNumber}项`);
  }

  return parts.join(' > ');
}
