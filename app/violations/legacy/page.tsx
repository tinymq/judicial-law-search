import Link from 'next/link';
import { prisma } from '@/src/lib/db';
import SiteHeader from '@/components/SiteHeader';
import ThemeToggle from '@/components/ThemeToggle';
import LawSidebar from '@/components/LawSidebar';
import ViolationList from '../ViolationList';
import { sortLevelsByOrder } from '@/src/lib/level-utils';
import type { Metadata } from 'next';
import { ADMIN_CONFIG } from '../../admin/admin-config';
import '../../app-styles.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '违法行为查询 - 可为法规随手查',
};

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; level?: string; year?: string; region?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || '';
  const selectedCategory = params.category || '';
  const selectedLevel = params.level || '';
  const selectedYear = params.year || '';
  const selectedRegion = params.region || '';

  // 检测主题（支持通过URL参数切换）
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) urlParams.set(key, value);
  });
  const theme = ADMIN_CONFIG.getTheme(urlParams);
  const isOptimized = ADMIN_CONFIG.isOptimized(theme);
  const themeClass = isOptimized ? 'app-optimized' : '';
  const selectedStatus = params.status || '';

  // 1. 获取效力位阶统计
  const levels = await prisma.law.groupBy({
    by: ['level'],
    _count: { id: true },
  });
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

  // 3. 获取区域统计
  const regions = await prisma.law.groupBy({
    by: ['region'],
    _count: { id: true },
    where: { region: { not: null } },
    orderBy: { region: 'asc' },
  });
  regions.sort((a, b) => b._count.id - a._count.id);

  const typedRegions = regions as Array<{ region: string; _count: { id: number } }>;

  // 4. 获取年份统计
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

  // 5. 构建查询条件
  const conditions: any[] = [];

  if (query) {
    conditions.push({
      OR: [
        { description: { contains: query } },
        { code: { contains: query } },
        { violationBasisLaw: { title: { contains: query } } },
        { punishmentBasisLaw: { title: { contains: query } } },
      ],
    });
  }

  if (selectedCategory || selectedLevel || selectedYear || selectedRegion || selectedStatus) {
    conditions.push({
      OR: [
        {
          violationBasisLaw: {
            category: selectedCategory || undefined,
            level: selectedLevel || undefined,
            promulgationDate: selectedYear ? {
              gte: new Date(`${selectedYear}-01-01`),
              lte: new Date(`${selectedYear}-12-31`),
            } : undefined,
            region: selectedRegion || undefined,
            status: selectedStatus || undefined,
          }
        },
        {
          punishmentBasisLaw: {
            category: selectedCategory || undefined,
            level: selectedLevel || undefined,
            promulgationDate: selectedYear ? {
              gte: new Date(`${selectedYear}-01-01`),
              lte: new Date(`${selectedYear}-12-31`),
            } : undefined,
            region: selectedRegion || undefined,
            status: selectedStatus || undefined,
          }
        }
      ],
    });
  }

  const where: any = conditions.length > 0 ? { AND: conditions } : {};

  // 6. 查询违法行为列表
  const violations = await prisma.violation.findMany({
    where,
    select: {
      id: true,
      code: true,
      description: true,
      createdAt: true,
      violationBasisLaw: {
        select: {
          id: true,
          title: true,
        }
      },
      violationBasisArticle: {
        select: {
          id: true,
          title: true,
          paragraphs: {
            select: {
              id: true,
              number: true,
              content: true,
            },
            orderBy: { order: 'asc' }
          }
        }
      },
      violationBasisParagraph: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
      violationBasisItem: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
      punishmentBasisLaw: {
        select: {
          id: true,
          title: true,
        }
      },
      punishmentBasisArticle: {
        select: {
          id: true,
          title: true,
          paragraphs: {
            select: {
              id: true,
              number: true,
              content: true,
            },
            orderBy: { order: 'asc' }
          }
        }
      },
      punishmentBasisParagraph: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
      punishmentBasisItem: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const totalCount = violations.length;

  return (
    <div className={`min-h-screen bg-slate-50 font-sans text-slate-900 ${themeClass}`}>
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <SiteHeader />

          <form className="flex-1 max-w-lg mx-6 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="搜索违法行为..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:ring-1 focus:ring-red-500 focus:bg-white transition-all outline-none"
            />
            {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
            {selectedLevel && <input type="hidden" name="level" value={selectedLevel} />}
            {selectedYear && <input type="hidden" name="year" value={selectedYear} />}
            {selectedRegion && <input type="hidden" name="region" value={selectedRegion} />}
            {selectedStatus && <input type="hidden" name="status" value={selectedStatus} />}
          </form>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/admin/violations" target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
              后台管理
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* 左侧侧边栏 - 独立滚动容器 */}
        <div className="w-56 shrink-0 hidden md:block h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
          {/* 法规筛选侧边栏 */}
          <LawSidebar
            baseUrl="/violations"
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
        <main className="flex-1 min-w-0">
          {/* 筛选状态栏 */}
          {(selectedCategory || selectedLevel || selectedYear || selectedRegion || selectedStatus || query) && (
            <div className="mb-4 flex items-center gap-2 text-sm flex-wrap">
              <span className="text-slate-500">已选:</span>
              {selectedLevel && (
                <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 flex items-center gap-1">
                  {selectedLevel}
                  <Link href={`/violations?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}${selectedStatus ? `&status=${selectedStatus}` : ''}${query ? `&q=${query}` : ''}`} className="hover:text-purple-900">×</Link>
                </span>
              )}
              {selectedCategory && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                  {selectedCategory}
                  <Link href={`/violations?${selectedLevel ? `level=${selectedLevel}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}${selectedStatus ? `&status=${selectedStatus}` : ''}${query ? `&q=${query}` : ''}`} className="hover:text-blue-900">×</Link>
                </span>
              )}
              {selectedRegion && (
                <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100 flex items-center gap-1">
                  {selectedRegion}
                  <Link href={`/violations?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedLevel ? `&level=${selectedLevel}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}${selectedStatus ? `&status=${selectedStatus}` : ''}${query ? `&q=${query}` : ''}`} className="hover:text-teal-900">×</Link>
                </span>
              )}
              {selectedYear && (
                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100 flex items-center gap-1">
                  {selectedYear}年
                  <Link href={`/violations?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedLevel ? `&level=${selectedLevel}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}${selectedStatus ? `&status=${selectedStatus}` : ''}${query ? `&q=${query}` : ''}`} className="hover:text-green-900">×</Link>
                </span>
              )}
              {selectedStatus && (
                <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100 flex items-center gap-1">
                  {selectedStatus}
                  <Link href={`/violations?${selectedCategory ? `category=${selectedCategory}` : ''}${selectedLevel ? `&level=${selectedLevel}` : ''}${selectedYear ? `&year=${selectedYear}` : ''}${selectedRegion ? `&region=${selectedRegion}` : ''}${query ? `&q=${query}` : ''}`} className="hover:text-orange-900">×</Link>
                </span>
              )}
              {query && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">
                  搜: {query}
                </span>
              )}
              <Link href="/violations" className="text-slate-400 hover:text-slate-600 text-xs underline ml-auto">重置所有</Link>
            </div>
          )}

          {/* 违法行为列表 */}
          <ViolationList violations={violations} />

          <div className="mt-4 text-center text-sm text-slate-400">
            显示 {violations.length} 条结果
          </div>
        </main>
      </section>
    </div>
  );
}
