/**
 * 行政检查事项编码工具
 *
 * 18 位编码结构：省(2) + 领域(2) + 主体层级(4) + 序列(10) = 18
 *
 * 示例：32 30 SJ01 XZJC000001
 *   32     — 江苏省代码前2位
 *   30     — 市场监督管理（行业code）
 *   SJ01   — 省级第1主体（SJ=省级, 01=机构序号）
 *   XZJC000001 — 行政检查流水号（XZJC前缀 + 6位序号）
 */

import { INDUSTRIES } from './industry-config';

// ============================================================
// 层级编码
// ============================================================

export const LEVEL_CODES: Record<string, string> = {
  '省级': 'SJ',
  '市级': 'DJ',  // 地级
  '县级': 'XJ',
  '乡级': 'XZ',  // 乡镇
  '各级': 'GJ',  // 通用
};

export const LEVEL_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(LEVEL_CODES).map(([k, v]) => [v, k])
);

// ============================================================
// 事项类型前缀
// ============================================================

export const CATEGORY_PREFIXES: Record<string, string> = {
  '行政检查': 'XZJC',
  '行政处罚': 'XZCF',
  '行政许可': 'XZXK',
  '行政强制': 'XZQZ',
  '行政调解': 'XZTJ',
  '行政裁决': 'XZCJ',
  '行政确认': 'XZQR',
  '行政奖励': 'XZJL',
  '其他执法事项': 'QTSX',
};

// ============================================================
// 行业名称 → code 映射
// ============================================================

const industryNameToCode = new Map<string, string>();
for (const ind of INDUSTRIES) {
  industryNameToCode.set(ind.name, ind.code);
  // 支持简称匹配
  const short = ind.name.replace(/和|与/g, '');
  if (short !== ind.name) industryNameToCode.set(short, ind.code);
}

/**
 * 根据执法领域名称查找行业编码
 * 支持模糊匹配（"市场监管" → "30"）
 */
export function findIndustryCode(domainName: string): string | null {
  // 精确匹配
  const exact = industryNameToCode.get(domainName);
  if (exact) return exact;

  // 包含匹配
  for (const ind of INDUSTRIES) {
    if (ind.name.includes(domainName) || domainName.includes(ind.name)) {
      return ind.code;
    }
  }

  return null;
}

// ============================================================
// 编码生成
// ============================================================

/**
 * 生成 18 位事项编码
 *
 * @param provinceCode  省份代码（6位，如"320000"），取前2位
 * @param industryCode  行业编码（2位，如"30"）
 * @param levelCode     层级编码（2位，如"SJ"）
 * @param orgSequence   机构序号（1-99）
 * @param itemSequence  事项流水号（1-999999）
 * @param category      事项类型（默认"行政检查"）
 */
export function generateCode(
  provinceCode: string,
  industryCode: string,
  levelCode: string,
  orgSequence: number,
  itemSequence: number,
  category: string = '行政检查',
): string {
  const prov = provinceCode.slice(0, 2);                              // 2 chars
  const domain = industryCode.padStart(2, '0');                       // 2 chars
  const level = levelCode + String(orgSequence).padStart(2, '0');     // 4 chars
  const prefix = CATEGORY_PREFIXES[category] || 'XZJC';              // 4 chars
  const seq = String(itemSequence).padStart(6, '0');                  // 6 chars
  return prov + domain + level + prefix + seq;                        // 18 chars
}

/**
 * 解析 18 位编码为各段含义
 */
export function parseCode(code: string): {
  provincePrefix: string;
  industryCode: string;
  levelCode: string;
  orgSequence: number;
  categoryPrefix: string;
  itemSequence: number;
  levelName?: string;
  industryName?: string;
  categoryName?: string;
} | null {
  if (!code || code.length !== 18) return null;

  const provincePrefix = code.slice(0, 2);
  const industryCode = code.slice(2, 4);
  const levelCode = code.slice(4, 6);
  const orgSequence = parseInt(code.slice(6, 8), 10);
  const categoryPrefix = code.slice(8, 12);
  const itemSequence = parseInt(code.slice(12, 18), 10);

  const levelName = LEVEL_NAMES[levelCode];
  const industryEntry = INDUSTRIES.find(i => i.code === industryCode);
  const categoryName = Object.entries(CATEGORY_PREFIXES).find(([, v]) => v === categoryPrefix)?.[0];

  return {
    provincePrefix,
    industryCode,
    levelCode,
    orgSequence,
    categoryPrefix,
    itemSequence,
    levelName,
    industryName: industryEntry?.name,
    categoryName,
  };
}

// ============================================================
// 编码计数器（提取脚本使用）
// ============================================================

/**
 * 编码序号管理器
 * 维护 province+domain+level 分组的机构序号和全局事项流水号
 */
export class CodeSequencer {
  private orgCounters = new Map<string, number>();  // "32-30-SJ" → next org seq
  private itemCounter = 0;

  constructor(startItemSeq: number = 0) {
    this.itemCounter = startItemSeq;
  }

  /**
   * 获取或分配机构序号
   * @param key 唯一标识，如 "省市场监督管理局"
   */
  getOrgSequence(provinceCode: string, industryCode: string, levelCode: string, orgName: string): number {
    const groupKey = `${provinceCode.slice(0, 2)}-${industryCode}-${levelCode}`;
    const orgKey = `${groupKey}-${orgName}`;

    if (!this.orgCounters.has(orgKey)) {
      // 统计该分组已有多少机构
      let maxSeq = 0;
      for (const [k, v] of this.orgCounters) {
        if (k.startsWith(groupKey + '-') && v > maxSeq) maxSeq = v;
      }
      this.orgCounters.set(orgKey, maxSeq + 1);
    }

    return this.orgCounters.get(orgKey)!;
  }

  /** 获取下一个事项流水号 */
  nextItemSequence(): number {
    this.itemCounter++;
    return this.itemCounter;
  }
}
