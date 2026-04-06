/**
 * Excel导入相关类型定义
 */

// Excel原始数据结构
export interface ExcelRow {
  序号: number;
  违法行为: string;
  违法依据: string;
  处罚依据: string;
  裁量标准: string;
  处罚建议: string;
  违法行为简称: string;
}

// 解析后的法条引用
export interface ParsedArticle {
  lawName: string;
  lawYear?: number;
  articleTitle: string; // 如 "第七条", "第七条第一款"
  fullCitation: string; // 完整引用文本，包含内容
}

// 解析后的违法行为数据
export interface ParsedViolation {
  id: number; // Excel中的序号
  code: string; // 自动生成的编号
  description: string; // 违法行为描述
  shortName: string; // 违法行为简称

  // 违法依据（可能多个）
  violationBasis: ParsedArticle[];

  // 处罚依据（可能多个）
  punishmentBasis: ParsedArticle[];

  // 其他信息
  discretionStandard: string; // 裁量标准
  punishmentSuggestion: string; // 处罚建议
}

// 法规匹配结果
export interface LawMatchResult {
  lawName: string;
  lawId: number | null;
  matchType: 'exact' | 'contains' | 'fuzzy' | 'none';
  confidence: number; // 0-1
  suggestions?: number[]; // 候选法规ID列表
}

// 条款匹配结果
export interface ArticleMatchResult {
  parsedArticle: ParsedArticle;
  lawId: number | null;
  articleId: number | null;
  paragraphId: number | null;
  itemId: number | null;
  matchSuccess: boolean;
  reason?: string; // 匹配失败的原因
}

// 验证后的数据分类
export interface ValidationResult {
  // 可导入的数据
  availableData: {
    violation: ParsedViolation;
    matches: {
      violationBasis: ArticleMatchResult[];
      punishmentBasis: ArticleMatchResult[];
    };
  }[];

  // 缺失的法规列表
  missingLaws: {
    lawName: string;
    violationsCount: number;
    violationIds: number[]; // 涉及的违法行为Excel序号
  }[];

  // 含有缺失法规的违法行为（单独列表，不导入）
  violationsWithMissingLaws: {
    violation: ParsedViolation;
    missingLawNames: string[];
  }[];

  // 条款未匹配的违法行为
  unmatchedArticles: {
    violation: ParsedViolation;
    unmatchedBasis: {
      type: 'violation' | 'punishment';
      article: ParsedArticle;
      reason: string;
    }[];
  }[];

  // 统计信息
  statistics: {
    totalViolations: number;
    availableCount: number;
    missingLawsCount: number;
    violationsWithMissingLawsCount: number;
    unmatchedArticlesCount: number;
    successRate: number; // 可直接导入的比例
  };
}
