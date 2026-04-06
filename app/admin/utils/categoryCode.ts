import { prisma } from '@/src/lib/db';

/**
 * Category编码映射缓存
 */
let codeMappingCache: Record<string, string> | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 缓存5分钟

/**
 * 获取 category → 编码字母的映射
 * @returns { "价格监督检查": "A", "食品经营": "B", ... }
 */
export async function getCategoryCodeMapping(): Promise<Record<string, string>> {
  // 检查缓存是否有效
  if (codeMappingCache && cacheTimestamp) {
    const now = Date.now();
    if (now - cacheTimestamp < CACHE_TTL) {
      return codeMappingCache;
    }
  }

  // 从数据库查询所有不重复的 category
  const laws = await prisma.law.findMany({
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' }
  });

  // 按字母顺序分配 A-Z
  const mapping: Record<string, string> = {};
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  laws.forEach((law, index) => {
    if (law.category && index < letters.length) {
      mapping[law.category] = letters[index];
    }
  });

  // 更新缓存
  codeMappingCache = mapping;
  cacheTimestamp = Date.now();

  console.log('📊 Category编码映射:', mapping);

  return mapping;
}

/**
 * 为指定的 category 生成编码字母
 * @param category - 法规类别（如"价格监督检查"）
 * @returns 编码字母（如"A"）
 */
export async function getCodeForCategory(category: string): Promise<string> {
  const mapping = await getCategoryCodeMapping();

  if (mapping[category]) {
    return mapping[category];
  }

  // 如果找不到映射，返回Z作为兜底
  console.warn(`⚠️ 未找到category "${category}" 的映射，使用默认值 "Z"`);
  return 'Z';
}

/**
 * 清除缓存（在category发生变化时调用）
 */
export function clearCategoryCodeCache() {
  codeMappingCache = null;
  cacheTimestamp = null;
  console.log('🔄 Category编码映射缓存已清除');
}
