import { prisma } from '@/src/lib/db';
import { sortLevelsByOrder } from '@/src/lib/level-utils';
import LawTable from './LawTable';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import LawSidebar from '@/components/LawSidebar';
import ExportButton from './ExportButton';
import ThemeToggle from '@/components/ThemeToggle';
import type { Metadata } from 'next';
import { ADMIN_CONFIG } from '../admin-config';
import MobileFilterPanel from '@/components/MobileFilterPanel';
import '../admin-styles.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '法规管理',
};

export default async function AdminLawsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; level?: string; year?: string; region?: string; sort?: string; order?: 'asc' | 'desc'; page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q || '').trim();
  const selectedCategory = params.category || '';
  const selectedLevel = params.level || '';
  const selectedYear = params.year || '';
  const selectedRegion = params.region || '';
  const sortField = params.sort || 'updatedAt';
  const sortOrder = params.order || 'desc';
  const pageSize = [50, 100, 500].includes(Number(params.pageSize)) ? Number(params.pageSize) : 50;
  const currentPage = Math.max(1, parseInt(params.page || '1'));

  // 检测主题（支持通过URL参数切换）
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) urlParams.set(key, value);
  });
  const theme = ADMIN_CONFIG.getTheme(urlParams);
  const isOptimized = ADMIN_CONFIG.isOptimized(theme);
  const themeClass = isOptimized ? 'admin-optimized' : '';

  // 1. 获取效力位阶统计（按法定效力位阶顺序排序）
  const levels = await prisma.law.groupBy({
    by: ['level'],
    _count: { id: true },
  });

  // 按法定效力位阶的优先级顺序排序
  sortLevelsByOrder(levels);

  // 2. 获取领域分类统计
  const categories = await prisma.law.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { category: 'asc' },
  });
  categories.sort((a, b) => b._count.id - a._count.id);

  // 3. 获取区域统计
  const regions = await prisma.law.groupBy({
    by: ['region'],
    _count: { id: true },
    where: { region: { not: null } },
    orderBy: { region: 'asc' },
  });
  regions.sort((a, b) => b._count.id - a._count.id);

  // 类型断言：确保 region 不为 null（已通过 where 过滤）
  const typedRegions = regions as Array<{ region: string; _count: { id: number } }>;

  // 4. 获取年份统计（SQL 聚合）
  const yearRows = await prisma.$queryRaw<Array<{ year: string; count: number }>>`
    SELECT strftime('%Y', promulgationDate) as year, COUNT(*) as count
    FROM Law
    WHERE promulgationDate IS NOT NULL
    GROUP BY year
    ORDER BY year DESC
  `;
  const years = yearRows.map(r => ({ year: r.year, count: Number(r.count) }));

  // 5. 构建查询条件
  const where: any = {};

  if (selectedCategory) where.category = selectedCategory;
  if (selectedLevel) where.level = selectedLevel;
  if (selectedRegion) where.region = selectedRegion;

  if (selectedYear) {
    const start = new Date(`${selectedYear}-01-01`);
    const end = new Date(`${selectedYear}-12-31`);
    where.promulgationDate = { gte: start, lte: end };
  }

  if (query) {
    const [titleIdRows, contentIdRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{id: bigint}>>(
        `SELECT id FROM Law WHERE title LIKE ?`,
        `%${query}%`
      ),
      prisma.$queryRawUnsafe<Array<{lawId: bigint}>>(
        `SELECT DISTINCT lawId FROM (
          SELECT a.lawId FROM Paragraph p
          JOIN Article a ON a.id = p.articleId
          WHERE p.content LIKE ?
          UNION
          SELECT a.lawId FROM Item i
          JOIN Paragraph p ON p.id = i.paragraphId
          JOIN Article a ON a.id = p.articleId
          WHERE i.content LIKE ?
        )`,
        `%${query}%`, `%${query}%`
      ),
    ]);
    const matchIds = [...new Set([
      ...titleIdRows.map(r => Number(r.id)),
      ...contentIdRows.map(r => Number(r.lawId)),
    ])];
    if (matchIds.length > 0) {
      where.id = { in: matchIds };
    } else {
      where.id = { in: [-1] };
    }
  }

  // 6. 查询法规列表（支持排序 + 分页）
  const filteredCount = await prisma.law.count({ where });
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const skip = (safePage - 1) * pageSize;

  let laws: any[];

  // 特殊处理时效性排序（按优先级）- 需要 JS 排序后分页
  if (sortField === 'status') {
    const allLaws = await prisma.law.findMany({ where });

    const statusPriority: Record<string, number> = {
      '现行有效': 1,
      '已被修改': 2,
      '尚未施行': 3,
      '已废止': 4
    };

    allLaws.sort((a, b) => {
      const priorityA = statusPriority[a.status || ''] || 999;
      const priorityB = statusPriority[b.status || ''] || 999;
      return sortOrder === 'asc' ? priorityA - priorityB : priorityB - priorityA;
    });
    laws = allLaws.slice(skip, skip + pageSize);
  }
  // 特殊处理日期排序（NULL值排在最后）- 需要 JS 排序后分页
  else if (sortField === 'promulgationDate' || sortField === 'effectiveDate') {
    const allLaws = await prisma.law.findMany({ where });

    allLaws.sort((a, b) => {
      const dateA = a[sortField];
      const dateB = b[sortField];

      if (dateA && !dateB) return sortOrder === 'asc' ? -1 : 1;
      if (!dateA && dateB) return sortOrder === 'asc' ? 1 : -1;
      if (!dateA && !dateB) return 0;

      const comparison = new Date(dateA).getTime() - new Date(dateB).getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    laws = allLaws.slice(skip, skip + pageSize);
  }
  // 普通字段直接排序 + 数据库分页
  else {
    const orderBy: any = {};
    orderBy[sortField] = sortOrder;

    laws = await prisma.law.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
    });
  }

  const totalCount = categories.reduce((a, b) => a + b._count.id, 0);

  return (
    <div className={`min-h-screen bg-slate-100 font-sans text-slate-900 ${themeClass}`}>
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        {/* First row: logo + actions */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
            <SiteHeader />

            {/* Desktop search */}
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
            </form>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <ThemeToggle />
                <ExportButton />
                <Link
                    href="/admin/create"
                    target="_blank"
                    className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-1 sm:gap-2 shadow-sm shadow-blue-200 text-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    <span className="hidden sm:inline">录入新法规</span>
                </Link>
            </div>
        </div>

        {/* Mobile search row */}
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
            </div>
        </form>
      </header>

      {/* 移动端筛选面板 */}
      <MobileFilterPanel
        baseUrl="/admin/laws"
        totalCount={totalCount}
        levels={levels}
        categories={categories}
        regions={typedRegions}
        years={years}
        statuses={[]}
        selectedCategory={selectedCategory}
        selectedLevel={selectedLevel}
        selectedYear={selectedYear}
        selectedRegion={selectedRegion}
        selectedStatus=""
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex gap-6">
        {/* 左侧侧边栏 */}
        <div className="hidden md:block">
          <LawSidebar
            baseUrl="/admin/laws"
            totalCount={totalCount}
            levels={levels}
            categories={categories}
            regions={typedRegions}
            years={years}
            selectedCategory={selectedCategory}
            selectedLevel={selectedLevel}
            selectedYear={selectedYear}
            selectedRegion={selectedRegion}
          />
        </div>

        {/* 右侧主内容区 */}
        <main className="flex-1 min-w-0">
            {/* 筛选状态栏 */}
            {(selectedCategory || selectedLevel || selectedYear || selectedRegion || query) && (
                <div className="mb-4 flex items-center gap-2 text-sm flex-wrap bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <span className="text-slate-500 font-medium">已选:</span>
                    {selectedLevel && (
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 flex items-center gap-1">
                            {selectedLevel}
                            <Link href={`/admin/laws?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}`} className="hover:text-purple-900">×</Link>
                        </span>
                    )}
                    {selectedCategory && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                            {selectedCategory}
                            <Link href={`/admin/laws?${selectedLevel ? `level=${selectedLevel}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}`} className="hover:text-blue-900">×</Link>
                        </span>
                    )}
                    {selectedRegion && (
                        <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100 flex items-center gap-1">
                            {selectedRegion}
                            <Link href={`/admin/laws?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedLevel ? `&level=${selectedLevel}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}`} className="hover:text-teal-900">×</Link>
                        </span>
                    )}
                    {selectedYear && (
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100 flex items-center gap-1">
                            {selectedYear}年
                            <Link href={`/admin/laws?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedLevel ? `&level=${selectedLevel}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}`} className="hover:text-green-900">×</Link>
                        </span>
                    )}
                    {query && (
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">
                            搜: {query}
                        </span>
                    )}
                    <Link href="/admin/laws" className="text-slate-400 hover:text-slate-600 text-xs underline ml-auto">重置所有</Link>
                </div>
            )}

            {/* 法规表格 */}
            <div className="mb-4 text-sm text-slate-500 bg-white p-3 rounded-lg border border-slate-200">
                显示 <span className="font-bold text-slate-700">{filteredCount}</span> 条结果
                {filteredCount < totalCount && <span className="text-slate-400">（共 {totalCount} 条）</span>}
                {totalPages > 1 && <span className="text-slate-400 ml-2">第 {safePage}/{totalPages} 页</span>}
            </div>

            <LawTable
              laws={laws}
              currentSort={sortField}
              currentOrder={sortOrder}
              searchParams={{ q: query, category: selectedCategory, level: selectedLevel, year: selectedYear, region: selectedRegion, pageSize: pageSize !== 50 ? String(pageSize) : '' }}
              pagination={{ currentPage: safePage, totalPages, filteredCount, pageSize }}
            />
        </main>
      </div>
    </div>
  );
}
