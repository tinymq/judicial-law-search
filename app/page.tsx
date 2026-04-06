import Link from 'next/link';
import { prisma } from '@/src/lib/db';
import SiteHeader from '@/components/SiteHeader';
import LawSidebar from '@/components/LawSidebar';
import ThemeToggle from '@/components/ThemeToggle';
import { sortLevelsByOrder } from '@/src/lib/level-utils';
import type { Metadata } from 'next';
import { ADMIN_CONFIG } from './admin/admin-config';
import { buildLawBaseTitle, normalizeLawTitle } from '@/src/lib/law-grouping';
import { resolveStatus, statusColor } from '@/src/lib/category-config';
import RecentViews from '@/src/components/RecentViews';
import MobileFilterPanel from '@/components/MobileFilterPanel';
import './app-styles.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '首页 - 可为法规随手查',
};

type SearchLaw = {
  id: number;
  title: string;
  issuingAuthority: string | null;
  documentNumber: string | null;
  preamble: string | null;
  promulgationDate: Date | null;
  effectiveDate: Date | null;
  status: string | null;
  level: string;
  category: string;
  region: string | null;
  lawGroupId: string | null;
  createdAt: Date;
  updatedAt: Date;
  searchMatchType?: 'title_exact' | 'title_base_exact' | 'title_prefix' | 'title_contains' | 'content';
  searchScore?: number;
};

function compareByDateDesc(a: SearchLaw, b: SearchLaw) {
  if (a.effectiveDate && b.effectiveDate) {
    return b.effectiveDate.getTime() - a.effectiveDate.getTime();
  }
  if (a.effectiveDate && !b.effectiveDate) {
    return -1;
  }
  if (!a.effectiveDate && b.effectiveDate) {
    return 1;
  }
  if (a.promulgationDate && b.promulgationDate) {
    return b.promulgationDate.getTime() - a.promulgationDate.getTime();
  }
  if (a.promulgationDate && !b.promulgationDate) {
    return -1;
  }
  if (!a.promulgationDate && b.promulgationDate) {
    return 1;
  }
  return 0;
}

function scoreLawTitleMatch(title: string, query: string) {
  const normalizedTitle = normalizeLawTitle(title);
  const normalizedQuery = normalizeLawTitle(query);
  const baseTitle = buildLawBaseTitle(title);
  const baseQuery = buildLawBaseTitle(query);

  if (normalizedTitle === normalizedQuery) {
    return { score: 1000, matchType: 'title_exact' as const };
  }

  if (baseTitle === baseQuery) {
    return { score: 950, matchType: 'title_base_exact' as const };
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return { score: 850, matchType: 'title_prefix' as const };
  }

  if (baseTitle.includes(baseQuery) || normalizedTitle.includes(normalizedQuery)) {
    const position = Math.max(
      normalizedTitle.indexOf(normalizedQuery),
      baseTitle.indexOf(baseQuery)
    );
    const safePosition = position >= 0 ? position : normalizedTitle.length;
    return {
      score: 700 - safePosition,
      matchType: 'title_contains' as const,
    };
  }

  return { score: 0, matchType: 'content' as const };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; level?: string; year?: string; region?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? '';
  const selectedCategory = params.category ?? '';
  const selectedLevel = params.level ?? '';
  const selectedYear = params.year ?? '';
  const selectedRegion = params.region ?? '';
  const selectedStatus = params.status ?? '';

  // 检测主题（支持通过URL参数切换）
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) urlParams.set(key, value);
  });
  const theme = ADMIN_CONFIG.getTheme(urlParams);
  const isOptimized = ADMIN_CONFIG.isOptimized(theme);
  const themeClass = isOptimized ? 'app-optimized' : '';

  // 1. 获取效力位阶统计（按法定效力位阶顺序排序）
  const levels = await prisma.law.groupBy({
    by: ['level'],
    _count: { id: true },
  });

  // 按法定效力位阶的优先级顺序排序
  sortLevelsByOrder(levels);

  // 1.5. 获取时效性统计（按法定顺序）
  const STATUS_ORDER = ['现行有效', '已被修改', '已废止', '尚未生效'];
  const rawStatuses = await prisma.law.groupBy({
    by: ['status'],
    _count: { id: true },
    where: {
      status: { not: null }
    },
  });
  const statuses = rawStatuses as Array<{ status: string; _count: { id: number } }>;

  // 按法定顺序排序
  statuses.sort((a, b) => {
    const orderA = STATUS_ORDER.indexOf(a.status);
    const orderB = STATUS_ORDER.indexOf(b.status);
    return orderA - orderB;
  });

  // 2. 获取领域分类统计
  const categories = await prisma.law.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { category: 'asc' },
  });
  categories.sort((a, b) => b._count.id - a._count.id);

  // 2.5 获取区域统计
  const regions = await prisma.law.groupBy({
    by: ['region'],
    _count: { id: true },
    where: { region: { not: null } },
    orderBy: { region: 'asc' },
  });
  regions.sort((a, b) => b._count.id - a._count.id);

  // 类型断言：确保 region 不为 null（已通过 where 过滤）
  const typedRegions = regions as Array<{ region: string; _count: { id: number } }>;

  // 3. 获取年份统计
  const allDates = await prisma.law.findMany({
    select: { promulgationDate: true },
    where: { promulgationDate: { not: null } }
  });

  const yearStats: Record<string, number> = {};
  allDates.forEach(law => {
    if (law.promulgationDate) {
      const y = law.promulgationDate.getFullYear().toString();
      yearStats[y] = (yearStats[y] || 0) + 1;
    }
  });

  const years = Object.entries(yearStats)
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => parseInt(b.year) - parseInt(a.year));

  // 4. 构建过滤条件
  const where: any = {};

  if (selectedCategory) where.category = selectedCategory;
  if (selectedLevel) where.level = selectedLevel;
  if (selectedRegion) where.region = selectedRegion;
  if (selectedStatus) where.status = selectedStatus;

  if (selectedYear) {
    const start = new Date(`${selectedYear}-01-01`);
    const end = new Date(`${selectedYear}-12-31`);
    where.promulgationDate = { gte: start, lte: end };
  }

  let laws: SearchLaw[] = [];
  let titleMatchCount = 0;
  let contentMatchCount = 0;

  // 5. 查询法规列表
  if (query) {
    const titleMatchedLaws = await prisma.law.findMany({
      where: {
        ...where,
        title: { contains: query }
      },
    });

    const scoredTitleMatches: SearchLaw[] = titleMatchedLaws
      .map((law) => {
        const { score, matchType } = scoreLawTitleMatch(law.title, query);
        return {
          ...law,
          searchScore: score,
          searchMatchType: matchType,
        };
      })
      .sort((a, b) => {
        if ((b.searchScore ?? 0) !== (a.searchScore ?? 0)) {
          return (b.searchScore ?? 0) - (a.searchScore ?? 0);
        }
        return compareByDateDesc(a, b);
      });

    const titleMatchedIds = new Set(scoredTitleMatches.map((law) => law.id));

    const contentMatchedLaws = await prisma.law.findMany({
      where: {
        ...where,
        id: { notIn: Array.from(titleMatchedIds) },
        articles: {
          some: {
            paragraphs: {
              some: {
                content: { contains: query }
              }
            }
          }
        }
      },
      take: 50,
    });

    const scoredContentMatches: SearchLaw[] = contentMatchedLaws
      .map((law) => ({
        ...law,
        searchScore: 100,
        searchMatchType: 'content' as const,
      }))
      .sort(compareByDateDesc);

    laws = [...scoredTitleMatches, ...scoredContentMatches];
    titleMatchCount = scoredTitleMatches.length;
    contentMatchCount = scoredContentMatches.length;
  } else {
    laws = await prisma.law.findMany({
      where,
    });
    laws.sort(compareByDateDesc);
  }

  // 7. 按领域分组（如果没有搜索和筛选）
  // 使用明确的标志确保服务端和客户端渲染一致
  const shouldShowGrouped = !query && !selectedLevel && !selectedYear && !selectedCategory && !selectedRegion;
  const groupedLaws = shouldShowGrouped
    ? laws.reduce((acc, law) => {
        const cat = law.category || '未分类';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(law);
        return acc;
      }, {} as Record<string, typeof laws>)
    : null;

  const totalCount = categories.reduce((a, b) => a + b._count.id, 0);

  // 格式化日期函数
  const formatDate = (date: Date | null) => {
    if (!date) return '暂无';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  return (
    <div className={`min-h-screen bg-slate-50 font-sans text-slate-900 ${themeClass}`}>
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
            <SiteHeader />

            <form className="hidden sm:block flex-1 max-w-lg mx-6 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input
                    type="text"
                    name="q"
                    defaultValue={query}
                    placeholder="搜索法规..."
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                />
                {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
                {selectedLevel && <input type="hidden" name="level" value={selectedLevel} />}
                {selectedYear && <input type="hidden" name="year" value={selectedYear} />}
                {selectedRegion && <input type="hidden" name="region" value={selectedRegion} />}
                {selectedStatus && <input type="hidden" name="status" value={selectedStatus} />}
            </form>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <Link href="/ai" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                    AI分析
                </Link>
                <Link href="/admin/laws" target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
                    后台管理
                </Link>
                <ThemeToggle variant="app" className="ml-1 sm:ml-4" />
            </div>
        </div>
        {/* Mobile search */}
        <form className="sm:hidden px-3 pb-2">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input
                    type="text"
                    name="q"
                    defaultValue={query}
                    placeholder="搜索法规..."
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                />
                {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
                {selectedLevel && <input type="hidden" name="level" value={selectedLevel} />}
                {selectedYear && <input type="hidden" name="year" value={selectedYear} />}
                {selectedRegion && <input type="hidden" name="region" value={selectedRegion} />}
                {selectedStatus && <input type="hidden" name="status" value={selectedStatus} />}
            </div>
        </form>
      </header>

      {/* 移动端筛选面板 */}
      <MobileFilterPanel
        baseUrl="/"
        totalCount={totalCount}
        levels={levels}
        categories={categories}
        regions={typedRegions}
        years={years}
        statuses={statuses}
        selectedCategory={selectedCategory}
        selectedLevel={selectedLevel}
        selectedYear={selectedYear}
        selectedRegion={selectedRegion}
        selectedStatus={selectedStatus}
      />

      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex gap-6">
        {/* 左侧侧边栏 - 独立滚动容器 */}
        <div className="w-56 shrink-0 hidden md:block h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
          {/* 快捷入口 - 固定在顶部 */}
          <div className="sticky top-0 bg-slate-50 pb-2 z-20 space-y-2">
            <Link
              href="/ai"
              className="block px-2 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
            >
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                <span>AI 案件分析</span>
              </div>
            </Link>
            <Link
              href="/violations"
              target="_blank"
              className="block px-2 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-blue-700">
                <span>&#9878;&#65039;</span>
                <span>查询违法行为</span>
              </div>
            </Link>
          </div>

          {/* 最近浏览 */}
          <div className="mb-3">
            <RecentViews />
          </div>

          {/* 法规筛选侧边栏 */}
          <LawSidebar
            baseUrl="/"
            totalCount={totalCount}
            levels={levels}
            categories={categories}
            regions={typedRegions}
            years={years}
            statuses={statuses}
            selectedCategory={selectedCategory}
            selectedLevel={selectedLevel}
            selectedYear={selectedYear}
            selectedRegion={selectedRegion}
            selectedStatus={selectedStatus}
          />
        </div>

        {/* 右侧主内容区 */}
        <main className="flex-1 min-w-0" key={`${query}-${selectedCategory}-${selectedLevel}-${selectedYear}-${selectedRegion}-${selectedStatus}`}>
            {/* 筛选状态栏 */}
            {(selectedCategory || selectedLevel || selectedYear || selectedRegion || selectedStatus || query) && (
                <div className="mb-4 flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-slate-500">已选:</span>
                    {selectedLevel && (
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 flex items-center gap-1">
                            {selectedLevel}
                            <Link href={`/?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}`} className="hover:text-purple-900">×</Link>
                        </span>
                    )}
                    {selectedCategory && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                            {selectedCategory}
                            <Link href={`/?${selectedLevel ? `level=${selectedLevel}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}`} className="hover:text-blue-900">×</Link>
                        </span>
                    )}
                    {selectedRegion && (
                        <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100 flex items-center gap-1">
                            {selectedRegion}
                            <Link href={`/?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedLevel ? `&level=${selectedLevel}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}`} className="hover:text-teal-900">×</Link>
                        </span>
                    )}
                    {selectedYear && (
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100 flex items-center gap-1">
                            {selectedYear}年
                            <Link href={`/?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedLevel ? `&level=${selectedLevel}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}`} className="hover:text-green-900">×</Link>
                        </span>
                    )}
                    {selectedStatus && (
                        <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100 flex items-center gap-1">
                            {selectedStatus}
                            <Link href={`/?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedLevel ? `level=${selectedLevel}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}`} className="hover:text-orange-900">×</Link>
                        </span>
                    )}
                    {query && (
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">
                            搜: {query}
                        </span>
                    )}
                    <Link href="/" className="text-slate-400 hover:text-slate-600 text-xs underline ml-auto">重置所有</Link>
                </div>
            )}

            {query && laws.length > 0 && (
                <div className="mb-4 flex items-center gap-2 text-xs flex-wrap text-slate-500">
                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">
                        标题命中 {titleMatchCount}
                    </span>
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                        正文相关 {contentMatchCount}
                    </span>
                    <span>搜索结果已按标题相关性优先排序</span>
                </div>
            )}

            {/* 法规列表 */}
            {laws.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                    <div className="text-center py-20">
                        <p className="text-slate-400 text-base">暂无相关法规</p>
                    </div>
                </div>
            ) : shouldShowGrouped && groupedLaws ? (
                // 按领域分组展示
                <div className="space-y-6">
                    {Object.entries(groupedLaws).map(([category, categoryLaws]) => (
                        <div key={category}>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h2 className="text-base font-bold text-slate-700 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                                    {category}
                                    <span className="text-sm font-normal text-slate-400">({categoryLaws.length})</span>
                                </h2>
                                {categoryLaws.length > 5 && (
                                    <Link
                                        href={`/?category=${category}`}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                        更多 →
                                    </Link>
                                )}
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-sm">
                                {categoryLaws.slice(0, 5).map((law) => (
                                    <Link
                                        href={`/law/${law.id}`}
                                        target="_blank"
                                        key={law.id}
                                        className="group block p-4 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                {/* 第一行：法规名称 + 位阶标签 */}
                                                <div className="flex items-baseline gap-2 mb-2">
                                                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 leading-snug">
                                                        {law.title}
                                                    </h3>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                                        law.level === '法律' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                        law.level === '行政法规' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                                        law.level === '部门规章' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                        law.level === '地方性法规' ? 'bg-green-50 text-green-600 border border-green-100' :
                                                        'bg-slate-100 text-slate-500 border border-slate-200'
                                                    }`}>
                                                        {law.level}
                                                    </span>
                                                </div>

                                                {/* 第二行：时效性、制定机关、公布日期、施行日期 */}
                                                <div className="text-sm text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <span className={`font-medium ${statusColor(resolveStatus(law.status, law.effectiveDate))}`}>
                                                        {resolveStatus(law.status, law.effectiveDate)}
                                                    </span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="truncate max-w-[200px]">{law.issuingAuthority || '暂无'}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{formatDate(law.promulgationDate)}公布</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{formatDate(law.effectiveDate)}施行</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                                {categoryLaws.length > 5 && (
                                    <Link
                                        href={`/?category=${category}`}
                                        className="block px-4 py-3 text-center text-sm text-blue-600 hover:bg-slate-50 hover:text-blue-800 transition-colors"
                                    >
                                        查看全部 {categoryLaws.length} 部法规 →
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // 列表展示（搜索或筛选时）
                <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-sm">
                    {laws.map((law) => (
                        <Link
                            href={`/law/${law.id}`}
                            target="_blank"
                            key={law.id}
                            className="group block p-4 hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    {/* 第一行：法规名称 + 位阶标签 */}
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 leading-snug">
                                            {law.title}
                                        </h3>
                                        {law.searchMatchType && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                                                law.searchMatchType === 'title_exact' || law.searchMatchType === 'title_base_exact'
                                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                  : law.searchMatchType === 'title_prefix' || law.searchMatchType === 'title_contains'
                                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                                {law.searchMatchType === 'title_exact' && '标题精确命中'}
                                                {law.searchMatchType === 'title_base_exact' && '标题归一命中'}
                                                {law.searchMatchType === 'title_prefix' && '标题前缀命中'}
                                                {law.searchMatchType === 'title_contains' && '标题包含命中'}
                                                {law.searchMatchType === 'content' && '正文相关'}
                                            </span>
                                        )}
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                            law.level === '法律' ? 'bg-red-50 text-red-600 border border-red-100' :
                                            law.level === '行政法规' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                            law.level === '部门规章' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                            law.level === '地方性法规' ? 'bg-green-50 text-green-600 border border-green-100' :
                                            'bg-slate-100 text-slate-500 border border-slate-200'
                                        }`}>
                                            {law.level}
                                        </span>
                                    </div>

                                    {/* 第二行：时效性、制定机关、公布日期、施行日期 */}
                                    <div className="text-sm text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className={`font-medium ${
                                            law.status === '现行有效' ? 'text-green-600' :
                                            law.status === '已废止' ? 'text-red-500' :
                                            law.status === '已被修改' ? 'text-blue-600' :
                                            (law.status === '尚未施行' || law.status === '尚未生效') ? 'text-red-700' :
                                            'text-slate-500'
                                        }`}>
                                            {law.status === '尚未施行' ? '尚未生效' : law.status || '暂无'}
                                        </span>
                                        <span className="text-slate-300">|</span>
                                        <span className="truncate max-w-[200px]">{law.issuingAuthority || '暂无'}</span>
                                        <span className="text-slate-300">|</span>
                                        <span>{formatDate(law.promulgationDate)}公布</span>
                                        <span className="text-slate-300">|</span>
                                        <span>{formatDate(law.effectiveDate)}施行</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            <div className="mt-4 text-center text-sm text-slate-400">
                显示 {laws.length} 条结果
            </div>
        </main>
      </section>
    </div>
  );
}
