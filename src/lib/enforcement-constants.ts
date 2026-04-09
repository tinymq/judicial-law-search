// 执法事项模块共享常量

// 类别颜色映射
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  '行政许可': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  '行政处罚': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  '行政强制': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  '行政检查': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  '行政调解': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  '行政裁决': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  '行政确认': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  '行政奖励': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  '其他执法事项': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
};

export const DEFAULT_CATEGORY_COLOR = { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };

export function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR;
}

// 层级标签颜色
export const LEVEL_COLORS: Record<string, string> = {
  '省级': 'bg-red-100 text-red-700',
  '市级': 'bg-blue-100 text-blue-700',
  '县级': 'bg-green-100 text-green-700',
  '乡级': 'bg-yellow-100 text-yellow-700',
};
