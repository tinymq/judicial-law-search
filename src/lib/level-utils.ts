/**
 * 法规效力位阶工具函数
 * 统一管理效力位阶的优先级顺序和排序逻辑
 */

import { LEVEL_ORDER, LEVEL_OPTIONS } from './category-config';

// 重新导出配置
export { LEVEL_ORDER, LEVEL_OPTIONS };

/**
 * 按法定效力位阶的优先级顺序排序
 * @param levels - 需要排序的 level 数组
 * @returns 排序后的数组（原数组会被修改）
 */
export function sortLevelsByOrder<T extends { level: string }>(levels: T[]): T[] {
  return levels.sort((a, b) => {
    // 转换为 string[] 以接受任意字符串
    const orderA = (LEVEL_ORDER as readonly string[]).indexOf(a.level);
    const orderB = (LEVEL_ORDER as readonly string[]).indexOf(b.level);

    // 都在标准列表中，按优先级排序
    if (orderA !== -1 && orderB !== -1) {
      return orderA - orderB;
    }

    // 一个在列表中，一个不在
    if (orderA !== -1) return -1;
    if (orderB !== -1) return 1;

    // 都不在列表中，按字母排序
    return a.level.localeCompare(b.level, 'zh-CN');
  });
}
