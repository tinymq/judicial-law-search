/**
 * 法规内容解析工具模块
 *
 * 功能：
 * - parseQuickInput: 快速解析法规元数据（标题、机关、日期等）
 * - parseContent: 将原始法规文本解析为结构化条款（章-节-条-款-项）
 * - reconstructText: 将数据库中的条款结构重构为可编辑文本
 * - detectRegionFromTitle: 从标题自动识别区域
 *
 * @module contentParser
 * @version 1.1.0
 */

import { REGION_OPTIONS } from '@/src/lib/category-config';

// ==================== 类型定义 ====================

/**
 * 项的结构
 */
export interface Item {
  number: string;
  content: string;
  order: number;
}

/**
 * 款的结构
 */
export interface Paragraph {
  number: number;
  content: string | null;
  items?: Item[];
  order: number;
}

/**
 * 条款的结构
 */
export interface Article {
  title: string;
  content: string | null;
  chapter: string | null;
  section: string | null;
  paragraphs: Paragraph[];
  order?: number;
}

/**
 * 表单数据的结构
 */
export interface FormData {
  title?: string;
  preamble?: string;
  issuingAuthority?: string;
  documentNumber?: string;
  promulgationDate?: string;
  effectiveDate?: string;
  status?: string;
  level?: string;
  category?: string;
  region?: string;
  rawContent?: string;
}

// ==================== 配置常量 ====================

/**
 * 标题清理规则（配置化）
 */
export const TITLE_CLEANUP_PATTERNS = [
  /\s*English\s*/gi,
  /\s*尚未生效\s*/g,  // 统一使用"尚未生效"
  /\s*尚未施行\s*/g,  // 兼容旧数据
  /\s*现行有效\s*/g,
  /\s*已被修订\s*/g,  // 保留以兼容旧数据
  /\s*已被修改\s*/g,  // 新的时效性名称
  /\s*已废止\s*/g,
  /【法宝引证码】[^\s]+\s*/g,
];

/**
 * 制定机关清理规则
 */
export const AUTHORITY_CLEANUP_PATTERNS = [
  /\s+机构沿革\s*/g,
  /\s+查看\s*/g,
  /\s+详情\s*/g,
];

// ==================== 工具函数 ====================

/**
 * 日期格式标准化
 *
 * 支持格式：
 * - 2025.12.27 -> 2025-12-27
 * - 2025年12月27日 -> 2025-12-27
 * - 2025-12-27 -> 2025-12-27
 *
 * @param dateStr - 原始日期字符串
 * @returns 标准化后的日期字符串 (YYYY-MM-DD)
 */
export const normalizeDateString = (dateStr: string): string => {
  if (!dateStr) return '';

  let normalized = dateStr.trim();

  // 2025.12.27 -> 2025-12-27
  normalized = normalized.replace(/\./g, '-');

  // 2025年12月27日 -> 2025-12-27
  normalized = normalized.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日?/, (_, y, m, d) => {
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  });

  // 验证日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    console.warn('⚠️ 日期格式可能不正确:', dateStr, '->', normalized);
  }

  return normalized;
};

/**
 * 清理制定机关文本
 *
 * 去除"机构沿革"、"查看"、"详情"等无关文本
 *
 * @param authority - 原始制定机关文本
 * @returns 清理后的制定机关文本
 */
export const cleanAuthority = (authority: string): string => {
  let cleaned = authority.trim();
  AUTHORITY_CLEANUP_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  return cleaned.trim();
};

/**
 * 检测标题是否已有年份标记
 *
 * 匹配格式：(2018年修正)、(2023年公布) 等（格式化的年份标记）
 * 不匹配：(2025) 纯年份
 *
 * @param title - 法规标题
 * @returns 是否包含格式化的年份标记
 */
export const hasYearMarker = (title: string): boolean => {
  return /\([12]\d{3}年(修订|修正|公布|修改|发布)\)/.test(title);
};

/**
 * 添加年份标记到标题
 *
 * 如果标题中没有年份标记，且提供了施行日期，则添加年份标记
 * 格式：标题(YYYY年XX)，其中 XX 为公布/修订/修正
 *
 * @param title - 法规标题
 * @param effectiveDate - 施行日期
 * @param revisionType - 修订类型：'公布' | '修订' | '修正'
 * @returns 添加了年份标记的标题
 */
export const addYearMarker = (
  title: string,
  effectiveDate: string,
  revisionType: '公布' | '修订' | '修正' | '修改' | '发布' = '公布'
): string => {
  if (!effectiveDate || hasYearMarker(title)) {
    return title;
  }

  // 提取年份
  const yearMatch = effectiveDate.match(/^(\d{4})/);
  if (yearMatch) {
    const year = yearMatch[1];
    return `${title}(${year}年${revisionType})`;
  }

  return title;
};

/**
 * 从法规标题自动识别区域
 *
 * 识别规则：
 * 1. 前缀匹配：标题以"XX市"或"XX省"开头 → 识别为XX
 * 2. 括号匹配：标题包含"（XX）"或"(XX)" → 识别为XX
 * 3. 跳过模式：标题包含多区域关键词 → 返回"全国"
 * 4. 默认：无匹配 → 返回"全国"
 *
 * @param title - 法规标题
 * @returns 识别的区域（如"北京"、"上海"等）
 */
export const detectRegionFromTitle = (title: string): string => {
  if (!title) return '全国';

  // 特殊区域前缀匹配（优先级最高，在跳过模式之前）
  const SPECIAL_REGION_PREFIXES = [
    { prefix: '海南经济特区', region: '海南' },
    { prefix: '海南自由贸易港', region: '海南' },
    { prefix: '深圳经济特区', region: '深圳' },
    { prefix: '厦门经济特区', region: '厦门' },
    { prefix: '珠海经济特区', region: '珠海' },
    { prefix: '汕头经济特区', region: '汕头' },
  ];

  for (const { prefix, region } of SPECIAL_REGION_PREFIXES) {
    if (title.startsWith(prefix)) {
      console.log('📍 特殊区域前缀匹配:', region);
      return region;
    }
  }

  // 跳过多区域关键词（避免误匹配）
  const SKIP_PATTERNS = [
    '长江三角洲', '京津冀', '经济特区', '华北', '华东', '华南', '西部',
    '东北', '中部', '东部', '沿海', '沿边', '流域', '三角洲', '开发区',
    '试验区', '新区', '合作区'
  ];

  for (const pattern of SKIP_PATTERNS) {
    if (title.includes(pattern)) {
      console.log('🏳️ 跳过多区域关键词:', pattern);
      return '全国';
    }
  }

  // 前缀匹配：标题以"XX市"或"XX省"开头
  const regions = REGION_OPTIONS.filter(r => r !== '全国');
  for (const region of regions) {
    if (title.startsWith(region + '市') || title.startsWith(region + '省')) {
      console.log('📍 前缀匹配识别区域:', region);
      return region;
    }
  }

  // 括号匹配：标题包含"（XX）"或"(XX)"
  for (const region of regions) {
    if (title.includes(`（${region}）`) || title.includes(`(${region})`)) {
      console.log('📍 括号匹配识别区域:', region);
      return region;
    }
  }

  // 默认返回"全国"
  return '全国';
};

// ==================== 主解析函数 ====================

/**
 * 快速解析格式化的法规元数据
 *
 * 支持的字段：
 * - 标题（第一行）
 * - 制定机关
 * - 发文字号
 * - 公布日期
 * - 施行日期
 * - 时效性
 * - 效力位阶
 * - 法规类别
 *
 * @param quickInputText - 格式化的法规元数据文本
 * @param formData - 当前表单数据
 * @param setData - 更新表单数据的函数
 * @param CATEGORY_OPTIONS - 法规类别选项列表
 */
export const parseQuickInput = (
  quickInputText: string,
  formData: FormData,
  setData: (data: FormData | ((prev: FormData) => FormData)) => void,
  CATEGORY_OPTIONS: readonly string[]  // 改为 readonly 类型
): void => {
  const text = quickInputText.trim();
  if (!text) return;

  const parsed: any = {};

  try {
    console.log('🔍 开始快速解析元数据');

    // 提取标题（第一行，去掉特殊标记）
    const lines = text.split('\n');
    const firstLine = lines[0];

    // 检测标题中是否已有年份标记：(YYYY修订)、(YYYY修正)、(YYYY公布)、(YYYY修改)
    // 或者是纯年份：(YYYY) -> 默认为"公布"
    const yearMarkerMatch = firstLine.match(/\((\d{4})(修订|修正|公布|修改|发布)?\)/);
    let revisionType: '公布' | '修订' | '修正' | '修改' | '发布' = '公布'; // 默认为公布

    if (yearMarkerMatch) {
      // 已有年份标记，提取类型
      const [, year, type] = yearMarkerMatch;
      // 如果没有指定类型（纯年份），默认为"公布"
      revisionType = (type || '公布') as '公布' | '修订' | '修正' | '修改' | '发布';
      console.log('📅 检测到年份标记:', `(${year}${revisionType})`);

      // 清理并转换格式：(YYYY修订) -> (YYYY年修订)
      let cleanTitle = firstLine;
      TITLE_CLEANUP_PATTERNS.forEach(pattern => {
        cleanTitle = cleanTitle.replace(pattern, '');
      });
      // 移除旧的标记格式（包括纯年份 (YYYY)）
      cleanTitle = cleanTitle.replace(/\(\d{4}(修订|修正|公布|修改|发布)?\)/g, '').trim();
      // 添加新的标记格式
      parsed.title = `${cleanTitle}(${year}年${revisionType})`;
    } else {
      // 没有年份标记，根据标题关键词推断类型
      let cleanTitle = firstLine;
      TITLE_CLEANUP_PATTERNS.forEach(pattern => {
        cleanTitle = cleanTitle.replace(pattern, '');
      });

      // 推断修订类型
      if (cleanTitle.includes('修订')) {
        revisionType = '修订';
      } else if (cleanTitle.includes('修正')) {
        revisionType = '修正';
      } else {
        revisionType = '公布'; // 默认
      }

      parsed.title = cleanTitle.trim();
      console.log('📋 推断修订类型:', revisionType);
    }

    // 自动识别区域（基于标题）
    parsed.region = detectRegionFromTitle(parsed.title);

    // 提取各个字段
    const issuingAuthorityMatch = text.match(/制定机关[：:]\s*([^\n]+)/);
    if (issuingAuthorityMatch) {
      parsed.issuingAuthority = cleanAuthority(issuingAuthorityMatch[1]);
    }

    const documentNumberMatch = text.match(/发文字号[：:]\s*([^\n]+)/);
    if (documentNumberMatch) {
      parsed.documentNumber = documentNumberMatch[1].trim();
    }

    // 日期格式转换（增强版）
    const promulgationDateMatch = text.match(/公布日期[：:]\s*([^\n]+)/);
    if (promulgationDateMatch) {
      parsed.promulgationDate = normalizeDateString(promulgationDateMatch[1]);
    }

    const effectiveDateMatch = text.match(/施行日期[：:]\s*([^\n]+)/);
    if (effectiveDateMatch) {
      parsed.effectiveDate = normalizeDateString(effectiveDateMatch[1]);
    }

    const statusMatch = text.match(/时效性[：:]\s*([^\n]+)/);
    if (statusMatch) {
      let statusValue = statusMatch[1].trim();
      // 自动映射规则
      if (statusValue === '废止或失效') {
        statusValue = '已废止';
      } else if (statusValue === '尚未施行' || statusValue === '尚未生效') {
        statusValue = '尚未生效';  // 统一使用"尚未生效"
      }
      parsed.status = statusValue;
    }

    const levelMatch = text.match(/效力位阶[：:]\s*([^\n]+)/);
    if (levelMatch) {
      let levelValue = levelMatch[1].trim();
      // 自动映射规则
      if (levelValue === '省级地方性法规') {
        levelValue = '地方性法规';
      } else if (levelValue === '部门规范性文件') {
        levelValue = '规范性文件';
      }
      parsed.level = levelValue;
    }

    const categoryMatch = text.match(/法规类别[：:]\s*([^\n]+)/);
    if (categoryMatch) {
      const categoryText = categoryMatch[1].trim();

      // 查找所有匹配的类别
      const matchedCategories = CATEGORY_OPTIONS.filter(opt =>
        categoryText.includes(opt)
      );

      if (matchedCategories.length > 0) {
        // 优先选择最长匹配（更精确）
        const bestMatch = matchedCategories.reduce((a, b) =>
          a.length > b.length ? a : b
        );
        parsed.category = bestMatch;

        // 如果有多个匹配，记录到日志
        if (matchedCategories.length > 1) {
          console.log('📋 发现多个类别匹配:', matchedCategories, '选择:', bestMatch);
        }
      }
    }

    // 标题验证
    if (!parsed.title || parsed.title.length < 3) {
      console.warn('⚠️ 解析失败：未能识别有效的法规标题');
      return;
    }

    // 添加年份标记（仅当标题中还没有格式化的年份标记时）
    // 优先使用公布日期添加年份标记，其次使用施行日期
    const dateForMarker = parsed.promulgationDate || parsed.effectiveDate;
    if (dateForMarker && !yearMarkerMatch) {
      parsed.title = addYearMarker(parsed.title, dateForMarker, revisionType);
    }

    // 记录解析日志到控制台
    console.log('✅ 快速解析成功:', {
      标题: parsed.title,
      制定机关: parsed.issuingAuthority,
      发文字号: parsed.documentNumber,
      公布日期: parsed.promulgationDate,
      施行日期: parsed.effectiveDate,
      时效性: parsed.status,
      效力位阶: parsed.level,
      法规类别: parsed.category
    });

    // 更新表单数据
    setData(prev => ({ ...prev, ...parsed }));

  } catch (error: any) {
    console.error('❌ 快速解析失败:', error);
  }
};

/**
 * 将原始法规文本解析为结构化条款
 *
 * 解析层级：章 -> 节 -> 条 -> 款 -> 项
 *
 * 特殊处理：
 * - 术语定义条款（累积所有文本到单款）
 * - 多种项格式：（一）、1.、（1）
 * - 序言提取：提取开头的括号内容作为序言
 *
 * @param rawContent - 原始法规文本
 * @returns 解析后的结果，包含条款数组和序言
 */
export const parseContent = (rawContent: string): { articles: Article[]; preamble: string } => {
  console.log('🚀 开始解析法规内容');
  console.log('📊 原始文本行数:', rawContent.split('\n').length);

  let preamble = '';
  let text = rawContent;

  // 提取序言（支持中文括号（）和英文括号()）
  const trimmedStart = rawContent.trimStart();
  if (trimmedStart.startsWith('（') || trimmedStart.startsWith('(')) {
    const openBracket = trimmedStart[0];
    const closeBracket = openBracket === '（' ? '）' : ')';

    const closeIndex = rawContent.indexOf(closeBracket);
    if (closeIndex !== -1) {
      preamble = rawContent.substring(0, closeIndex + 1).trim();
      text = rawContent.substring(closeIndex + 1).trim();
      console.log('📜 提取到序言:', preamble);
    }
  }
  const lines = text.split('\n');
  const articles: Article[] = [];

  let currentChapter = '';
  let currentSection = '';
  let currentArticle: any = null;

  // 正则表达式定义
  const chapterRegex = /^\s*(第[零一二三四五六七八九十百千0-9]+章)\s+(.*)/;
  const sectionRegex = /^\s*(第[零一二三四五六七八九十百千0-9]+节)\s+(.*)/;
  const articleRegex = /^\s*\**\s*(第[零一二三四五六七八九十百千0-9]+条)\s*\**\s*(.*)/;  // 支持 Markdown 加粗 **第X条**
  const pageNumRegex = /^\s*\d+\s*$/;

  // 标准化 Article title：确保存储为纯数字格式（"一" 而不是 "第一条"）
  const normalizeArticleTitle = (fullTitle: string): string => {
    const match = fullTitle.match(/^第([零一二三四五六七八九十百千0-9]+)条$/);
    if (match) {
      return match[1];  // 返回纯数字部分
    }
    return fullTitle;
  };

  // 项的严格匹配：避免把"第X条"误识别为项
  const itemRegex1 = /^\s*([（(][一二三四五六七八九十]+[）)])\s*(.*)/;      // （一）（二）
  const itemRegex2 = /^\s*(\d+[.、])\s*(.*)/;                           // 1. 2. 1、
  const itemRegex3 = /^\s*([（(]\d+[）)])\s*(.*)/;                       // （1）（2）

  // 判断是否是项
  const isItem = (line: string) => {
    return itemRegex1.test(line) || itemRegex2.test(line) || itemRegex3.test(line);
  };

  // 检测是否是术语定义条款（特殊规则）
  const isTerminologyDefinition = (firstLine: string) => {
    const patterns = [
      /下列用语的含义/,
      /本法所称/,
      /本条例所称/,
      /本规定所称/,
      /本办法所称/
    ];
    return patterns.some(pattern => pattern.test(firstLine));
  };

  // 逐行解析
  for (const line of lines) {
    const trimLine = line.trim();
    if (!trimLine || pageNumRegex.test(trimLine)) continue;

    // 匹配章
    const chapMatch = trimLine.match(chapterRegex);
    if (chapMatch) {
      console.log('📖 匹配到章:', chapMatch[1]);
      currentChapter = trimLine;
      currentSection = '';

      // ✅ 修复：如果存在未保存的 Article，先保存
      if (currentArticle) {
        articles.push(currentArticle);
        currentArticle = null;
      }
      continue;
    }

    // 匹配节
    const secMatch = trimLine.match(sectionRegex);
    if (secMatch) {
      console.log('📋 匹配到节:', secMatch[1], '完整行:', trimLine);
      currentSection = trimLine;

      // ✅ 修复：如果存在未保存的 Article，先保存
      if (currentArticle) {
        articles.push(currentArticle);
        currentArticle = null;
      }
      continue;
    }

    // 匹配条
    const artMatch = trimLine.match(articleRegex);
    if (artMatch) {
      if (currentArticle) {
        articles.push(currentArticle);
      }

      const firstLineText = artMatch[2] || '';
      console.log('📝 匹配到条:', artMatch[1], '所属章节:', {
        chapter: currentChapter || null,
        section: currentSection || null
      });

      // 新逻辑：所有条款都使用 paragraphs，不再使用 content
      currentArticle = {
        title: normalizeArticleTitle(artMatch[1]),  // 标准化为纯数字格式
        chapter: currentChapter || null,  // ✅ 如果没有章节，使用 null
        section: currentSection || null,
        content: null,  // 始终为 null
        paragraphs: [] as Paragraph[],
        _firstLineText: firstLineText,  // 临时存储第一行文本
        _isTerminology: isTerminologyDefinition(firstLineText)  // 标记是否是术语定义
      };
      continue;
    }

    // 处理项（必须在有当前条款的情况下）
    if (currentArticle && isItem(trimLine)) {
      // 创建款（如果当前没有款）
      let currentParagraph = currentArticle.paragraphs[currentArticle.paragraphs.length - 1];
      if (!currentParagraph) {
        // 将项之前的内容作为款的引导语
        currentParagraph = {
          number: 1,
          content: currentArticle._firstLineText || null,
          items: [],
          order: 1
        };
        currentArticle.paragraphs.push(currentParagraph);
        currentArticle._firstLineText = '';  // 清空临时文本
      }

      // 提取项的编号和内容
      const match1 = trimLine.match(itemRegex1);
      const match2 = trimLine.match(itemRegex2);
      const match3 = trimLine.match(itemRegex3);

      let itemNumber = '';
      let itemContent = '';

      if (match1) {
        itemNumber = match1[1];
        itemContent = match1[2];
      } else if (match2) {
        itemNumber = match2[1];
        itemContent = match2[2];
      } else if (match3) {
        itemNumber = match3[1];
        itemContent = match3[2];
      }

      // 添加项到款
      currentParagraph.items.push({
        number: itemNumber,
        content: itemContent,
        order: currentParagraph.items.length + 1
      });
      continue;
    }

    // 处理普通文本
    if (currentArticle && trimLine) {
      // 特殊处理：术语定义条款
      if (currentArticle._isTerminology) {
        // 术语定义条款：所有文本累积到临时变量，最后创建单个paragraph
        if (currentArticle._firstLineText) {
          currentArticle._firstLineText += '\n' + trimLine;
        } else {
          currentArticle._firstLineText = trimLine;
        }
        continue;
      }

      // 普通条款：根据换行分段创建多个paragraph
      if (currentArticle.paragraphs.length > 0) {
        // 已经有款了
        const lastParagraph = currentArticle.paragraphs[currentArticle.paragraphs.length - 1];

        if (lastParagraph.items && lastParagraph.items.length > 0) {
          // 最后一款有项，说明项已经结束，这是新的款
          const newParagraphNumber = currentArticle.paragraphs.length + 1;
          currentArticle.paragraphs.push({
            number: newParagraphNumber,
            content: trimLine,
            items: [],
            order: newParagraphNumber
          });
        } else {
          // 最后一款没有项
          if (!lastParagraph.content) {
            // 最后一款的content为空，追加到该款
            lastParagraph.content = trimLine;
          } else {
            // 最后一款的content不为空，说明这是一个完整的款，新文本是新的款
            const newParagraphNumber = currentArticle.paragraphs.length + 1;
            currentArticle.paragraphs.push({
              number: newParagraphNumber,
              content: trimLine,
              items: [],
              order: newParagraphNumber
            });
          }
        }
      } else {
        // 还没有款
        if (currentArticle._firstLineText) {
          // 已经有第一行文本了，说明这是第二行
          // 先用第一行文本创建第一个 paragraph
          currentArticle.paragraphs.push({
            number: 1,
            content: currentArticle._firstLineText,
            items: [],
            order: 1
          });
          // 然后用当前文本创建第二个 paragraph
          currentArticle.paragraphs.push({
            number: 2,
            content: trimLine,
            items: [],
            order: 2
          });
          currentArticle._firstLineText = ''; // 清空临时文本
        } else {
          // 这是第一行文本，先存储
          currentArticle._firstLineText = trimLine;
        }
      }
    }
  }

  // 处理最后一个条款
  if (currentArticle) {
    articles.push(currentArticle);
  }

  // 最终处理：确保所有条款都有至少一个 paragraph
  articles.forEach((art: any) => {
    // 如果还有临时文本未处理，创建 paragraph
    if (art._firstLineText && art.paragraphs.length === 0) {
      art.paragraphs.push({
        number: 1,
        content: art._firstLineText,
        items: [],
        order: 1
      });
    }

    // 清理临时字段
    delete art._firstLineText;
    delete art._isTerminology;

    // 确保 content 始终为 null
    art.content = null;
  });

  console.log('✅ 解析完成，共', articles.length, '条');
  console.log('📦 章节分布:', {
    总章数: new Set(articles.map(a => a.chapter).filter(Boolean)).size,
    总节数: new Set(articles.map(a => a.section).filter(Boolean)).size,
    总条数: articles.length
  });

  return { articles, preamble };
};

/**
 * 将数据库中的条款结构重构为可编辑的文本
 *
 * 这是 parseContent 的反向操作
 * 用于编辑页面将数据库中的条款转换为文本格式
 *
 * @param articles - 条款数组
 * @returns 重构后的文本
 */
export const reconstructText = (articles: Article[]): string => {
  console.log('🔄 开始重构文本，共', articles.length, '条');

  let text = '';
  let lastChapter = '';
  let lastSection = '';

  articles.forEach(article => {
    // 如果章变化，添加章标题
    if (article.chapter && article.chapter !== lastChapter) {
      if (text) text += '\n\n';
      text += article.chapter + '\n';
      lastChapter = article.chapter;
      lastSection = '';
    }

    // 如果节变化，添加节标题
    if (article.section && article.section !== lastSection) {
      if (text) text += '\n';
      text += article.section + '\n';
      lastSection = article.section;
    }

    // 添加条款标题
    text += '第' + article.title + '条';

    // 添加款（所有条款都应该有款）
    if (article.paragraphs && article.paragraphs.length > 0) {
      article.paragraphs.forEach(para => {
        if (para.content) {
          text += '\n' + para.content;
        }
        if (para.items && para.items.length > 0) {
          para.items.forEach(item => {
            text += '\n' + item.number + ' ' + item.content;
          });
        }
      });
    }

    text += '\n';
  });

  console.log('✅ 文本重构完成，共', text.split('\n').length, '行');

  return text;
};
