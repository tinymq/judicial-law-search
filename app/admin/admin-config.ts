/**
 * 管理后台配置
 *
 * 主题切换：
 * - 'optimized': 使用新设计（米白+朱红）
 * - 'legacy': 使用原始设计（slate+blue）
 *
 * 通过URL参数控制：
 * - ?v2: 使用优化版本（optimized）
 * - ?theme=legacy: 使用原始设计（legacy，向后兼容）
 * - 无参数: 默认使用原始设计（legacy）
 */

export type AdminTheme = 'optimized' | 'legacy';

export const ADMIN_CONFIG = {
  // 默认主题（改为原始设计）
  defaultTheme: 'legacy' as AdminTheme,

  // 从URL参数获取主题
  getTheme(searchParams: URLSearchParams): AdminTheme {
    // 优先检查 ?theme=legacy（向后兼容）
    const themeParam = searchParams.get('theme');
    if (themeParam === 'legacy') {
      return 'legacy';
    }

    // 检查 ?v2 参数（启用优化版本）
    const v2Param = searchParams.get('v2');
    if (v2Param !== null) {
      return 'optimized';
    }

    // 默认返回 legacy
    return 'legacy';
  },

  // 检查是否使用优化主题
  isOptimized(theme: AdminTheme): boolean {
    return theme === 'optimized';
  },
};
