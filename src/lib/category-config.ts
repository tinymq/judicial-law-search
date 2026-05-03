// ============================================
// 法规分类配置文件（单一数据源）
// 修改此文件会影响：表单选项、排序规则、验证规则
// ============================================

/**
 * 效力位阶配置（按法律效力从高到低）
 */
export const LEVEL_ORDER = [
  '法律',
  '法律解释',
  '有关法律问题和重大问题的决定',
  '行政法规',
  '部门规章',
  '地方性法规',
  '自治条例和单行条例',
  // '经济特区法规',              // 已整合到"地方性法规" (2026-01-29)
  // '海南自由贸易港法规',        // 已整合到"地方性法规" (2026-01-29)
  '司法解释',
  '地方政府规章',               // 移到规范性文件前面
  '规范性文件',
  '其他',  // 兜底类别
] as const;

export const LEVEL_OPTIONS = [
  '法律',
  '法律解释',
  '有关法律问题和重大问题的决定',
  '行政法规',
  '部门规章',
  '地方性法规',
  '自治条例和单行条例',
  // '经济特区法规',              // 已整合到"地方性法规" (2026-01-29)
  // '海南自由贸易港法规',        // 已整合到"地方性法规" (2026-01-29)
  '司法解释',
  '地方政府规章',
  '规范性文件',
  '其他',
] as const;

/**
 * 效力位阶迁移映射表
 * 用于数据迁移和兼容性处理
 */
export const LEVEL_MIGRATION_MAP = {
  '经济特区法规': '地方性法规',
  '海南自由贸易港法规': '地方性法规',
} as const;

/**
 * @deprecated 已废弃 — 由 Industry 表 + LawIndustry 替代。仅保留供历史脚本引用。
 */
export const CATEGORY_OPTIONS = [
  // 核心类别
  '综合监管',
  '综合执法',

  // 专业领域（按拼音排序）
  '反垄断与反不正当竞争',
  '标准管理',
  '产品质量',
  '价格监管',
  '计量监督',
  '食品安全',
  '网监与合同',    // 保留（用户要求）
  '特种设备',
  '信用监管',
  '商事登记',
  '医疗器械',
  '消费维权',
  '药品监管',
  '知识产权',
  '广告监管',
  '认证认可',
] as const;

/**
 * 时效性配置
 */
export const STATUS_OPTIONS = [
  '现行有效',
  '已被修改',      // 改名
  '已废止',
  '尚未生效',      // 原名"尚未施行" (2026-01-29)
] as const;

/**
 * 根据施行日期自动计算法规的实际状态
 * - "尚未生效"/"尚未施行" 且施行日期已过 → 自动变为"现行有效"
 * - 其他状态原样返回
 */
export function resolveStatus(status: string | null | undefined, effectiveDate: Date | number | null | undefined): string {
  const normalized = status === '尚未施行' ? '尚未生效' : (status || '状态待补充');
  if (normalized === '尚未生效' && effectiveDate) {
    const ts = effectiveDate instanceof Date ? effectiveDate.getTime() : effectiveDate;
    if (ts < Date.now()) return '现行有效';
  }
  return normalized;
}

/** 根据状态返回对应的 CSS 文字颜色类 */
export function statusColor(status: string): string {
  switch (status) {
    case '现行有效': return 'text-green-600';
    case '已废止': return 'text-red-500';
    case '已被修改': return 'text-blue-600';
    case '尚未生效': return 'text-red-700';
    default: return 'text-slate-500';
  }
}

/**
 * 区域配置
 */
export const REGION_OPTIONS = [
  '全国',
  '北京', '上海', '天津', '重庆',
  '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '海南',
  '四川', '贵州', '云南', '陕西', '甘肃', '青海',
  '内蒙古', '广西', '西藏', '宁夏', '新疆',
  '香港', '澳门', '台湾',
] as const;

// 导出类型
export type Level = typeof LEVEL_OPTIONS[number];
export type Category = typeof CATEGORY_OPTIONS[number];
export type Status = typeof STATUS_OPTIONS[number];
export type Region = typeof REGION_OPTIONS[number];
