/**
 * 阿拉伯数字转中文数字（简单版，支持到99）
 */
function numberToChineseNumeral(num: number): string {
  if (num < 10) return ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][num];
  if (num === 10) return '十';
  if (num < 20) return '十' + numberToChineseNumeral(num % 10);
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return numberToChineseNumeral(tens) + '十' + (ones > 0 ? numberToChineseNumeral(ones) : '');
}

/**
 * 标准化条款搜索输入
 *
 * 支持格式：
 * - "第十八条" → "十八"
 * - "18条" → "十八"
 * - "第18条" → "十八"
 * - "十八条" → "十八"
 * - "18" → "十八"
 *
 * @param input 用户输入的搜索关键词
 * @returns 标准化后的条款编号（中文数字）
 */
export function normalizeArticleSearch(input: string): string {
  if (!input) return '';

  // 去除所有空格
  let cleaned = input.replace(/\s+/g, '');

  // 提取数字或中文数字的模式
  const patterns = [
    /^第([零一二三四五六七八九十百千0-9]+)条$/,  // 第X条
    /^([零一二三四五六七八九十百千0-9]+)条$/,    // X条
    /^([0-9]+)$/,                                 // 纯数字
    /^([零一二三四五六七八九十百千]+)$/          // 纯中文数字
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let num = match[1];

      // 如果是阿拉伯数字，转换为中文
      if (/^[0-9]+$/.test(num)) {
        const numValue = parseInt(num);
        if (numValue < 100) {
          num = numberToChineseNumeral(numValue);
        } else {
          // 超过99的数字，暂不转换，返回原始输入
          return input;
        }
      }

      return num;
    }
  }

  // 如果不匹配任何模式，返回原始输入
  return input;
}
