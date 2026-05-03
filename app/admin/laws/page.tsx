import { prisma } from '@/src/lib/db';
import { sortLevelsByOrder } from '@/src/lib/level-utils';
import { PROVINCES, CITY_TO_PROVINCE, COUNTY_TO_PROVINCE, CITY_CODES } from '@/src/lib/region-config';
import LawTable from './LawTable';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import LawStatsCards from '@/components/LawStatsCards';
import LawFilterBar from '@/components/LawFilterBar';
import Pagination from '@/components/Pagination';
import ExportButton from './ExportButton';
import PageSizeSelect from '@/components/admin/PageSizeSelect';
import ThemeToggle from '@/components/ThemeToggle';
import type { Metadata } from 'next';
import { ADMIN_CONFIG } from '../admin-config';
import '../admin-styles.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '法规管理',
};

export default async function AdminLawsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; industry?: string; level?: string; year?: string; region?: string; status?: string; sort?: string; order?: 'asc' | 'desc'; page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q || '').trim();
  const selectedIndustry = params.industry || '';
  const selectedLevel = params.level || '';
  const selectedYear = params.year || '';
  const selectedRegion = params.region || '';
  const selectedStatus = params.status || '';
  const sortField = params.sort || 'updatedAt';
  const sortOrder = params.order || 'desc';
  const pageSize = [50, 100, 500].includes(Number(params.pageSize)) ? Number(params.pageSize) : 50;
  const currentPage = Math.max(1, parseInt(params.page || '1'));

  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) urlParams.set(key, value);
  });
  const theme = ADMIN_CONFIG.getTheme(urlParams);
  const isOptimized = ADMIN_CONFIG.isOptimized(theme);
  const themeClass = isOptimized ? 'admin-optimized' : '';

  // 1. Level stats
  const levels = await prisma.law.groupBy({
    by: ['level'],
    _count: { id: true },
  });
  sortLevelsByOrder(levels);

  // 2. Industry stats (two-level tree)
  const allIndustries = await prisma.industry.findMany({
    select: { id: true, code: true, name: true, parentCode: true, order: true },
    orderBy: { order: 'asc' },
  });
  const industryLawCounts = await prisma.lawIndustry.groupBy({
    by: ['industryId'],
    _count: { lawId: true },
  });
  const countMap = new Map(industryLawCounts.map(r => [r.industryId, r._count.lawId]));
  const level1Industries = allIndustries.filter(i => !i.parentCode);
  const level2ByParent = new Map<string, typeof allIndustries>();
  for (const ind of allIndustries) {
    if (ind.parentCode) {
      const arr = level2ByParent.get(ind.parentCode) || [];
      arr.push(ind);
      level2ByParent.set(ind.parentCode, arr);
    }
  }
  const industries = level1Industries
    .map(l1 => {
      const children = (level2ByParent.get(l1.code) || [])
        .map(l2 => ({ id: l2.id, name: l2.name, _count: countMap.get(l2.id) || 0 }))
        .filter(c => c._count > 0);
      const l1Own = countMap.get(l1.id) || 0;
      const childrenTotal = children.reduce((s, c) => s + c._count, 0);
      return { id: l1.id, name: l1.name, _count: l1Own + childrenTotal, children };
    })
    .filter(ind => ind._count > 0);

  // 3. Region stats
  const rawRegions = await prisma.law.groupBy({
    by: ['region'],
    _count: { id: true },
    where: { region: { not: null } },
  });
  const typedRegions = rawRegions as Array<{ region: string; _count: { id: number } }>;
  const provinceMap = new Map<string, { province: string; totalCount: number; provinceOwnCount: number; children: Array<{ name: string; count: number }> }>();
  for (const r of typedRegions) {
    if (r.region === '全国') continue;
    const prov = PROVINCES.find(p => p.shortName === r.region);
    if (prov) {
      const existing = provinceMap.get(prov.code);
      if (existing) { existing.totalCount += r._count.id; existing.provinceOwnCount += r._count.id; }
      else provinceMap.set(prov.code, { province: prov.shortName, totalCount: r._count.id, provinceOwnCount: r._count.id, children: [] });
      continue;
    }
    const cityProvinceCode = CITY_TO_PROVINCE[r.region];
    if (cityProvinceCode) {
      const existing = provinceMap.get(cityProvinceCode);
      if (existing) { existing.totalCount += r._count.id; existing.children.push({ name: r.region, count: r._count.id }); }
      else {
        const provInfo = PROVINCES.find(p => p.code === cityProvinceCode);
        provinceMap.set(cityProvinceCode, { province: provInfo?.shortName || '未知', totalCount: r._count.id, provinceOwnCount: 0, children: [{ name: r.region, count: r._count.id }] });
      }
      continue;
    }
    const countyProvinceCode = COUNTY_TO_PROVINCE[r.region];
    if (countyProvinceCode) {
      const existing = provinceMap.get(countyProvinceCode);
      if (existing) { existing.totalCount += r._count.id; existing.children.push({ name: r.region, count: r._count.id }); }
      else {
        const provInfo = PROVINCES.find(p => p.code === countyProvinceCode);
        provinceMap.set(countyProvinceCode, { province: provInfo?.shortName || '未知', totalCount: r._count.id, provinceOwnCount: 0, children: [{ name: r.region, count: r._count.id }] });
      }
      continue;
    }
    const otherKey = '999999';
    const existing = provinceMap.get(otherKey);
    if (existing) { existing.totalCount += r._count.id; existing.children.push({ name: r.region, count: r._count.id }); }
    else provinceMap.set(otherKey, { province: '其他', totalCount: r._count.id, provinceOwnCount: 0, children: [{ name: r.region, count: r._count.id }] });
  }
  const nationwideEntry = typedRegions.find(r => r.region === '全国');
  const regionGroups = Array.from(provinceMap.entries())
    .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
    .map(([, g]) => ({ ...g, children: g.children.sort((a, b) => (CITY_CODES[a.name] || '999999').localeCompare(CITY_CODES[b.name] || '999999')) }));
  if (nationwideEntry) {
    regionGroups.unshift({ province: '全国', totalCount: nationwideEntry._count.id, provinceOwnCount: nationwideEntry._count.id, children: [] });
  }

  // 4. Year stats
  const yearRows = await prisma.$queryRaw<Array<{ year: string; count: number }>>`
    SELECT strftime('%Y', promulgationDate) as year, COUNT(*) as count
    FROM Law
    WHERE promulgationDate IS NOT NULL
    GROUP BY year
    ORDER BY year DESC
  `;
  const years = yearRows.map(r => ({ year: r.year, count: Number(r.count) }));

  // 5. Pending feedback count
  const pendingFeedbackCount = await prisma.lawFeedback.count({ where: { status: '待处理' } });

  // 6. Build query conditions
  const where: any = {};

  if (selectedLevel) where.level = selectedLevel;
  if (selectedRegion) where.region = selectedRegion;
  if (selectedStatus) where.status = selectedStatus;

  if (selectedIndustry) {
    const indId = parseInt(selectedIndustry);
    const selectedInd = allIndustries.find(i => i.id === indId);
    if (selectedInd && !selectedInd.parentCode) {
      const childIds = (level2ByParent.get(selectedInd.code) || []).map(c => c.id);
      const lawIdRows = await prisma.lawIndustry.findMany({
        where: { industryId: { in: [indId, ...childIds] } },
        select: { lawId: true },
        distinct: ['lawId'],
      });
      where.id = { in: lawIdRows.map(r => r.lawId) };
    } else {
      const lawIdRows = await prisma.lawIndustry.findMany({
        where: { industryId: indId },
        select: { lawId: true },
        distinct: ['lawId'],
      });
      where.id = { in: lawIdRows.map(r => r.lawId) };
    }
  }

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
      if (where.id) {
        const existingIds = new Set(where.id.in as number[]);
        where.id = { in: matchIds.filter(id => existingIds.has(id)) };
      } else {
        where.id = { in: matchIds };
      }
    } else {
      where.id = { in: [-1] };
    }
  }

  // 7. Status stats for cards (exclude status filter)
  const statusStatsWhere = { ...where };
  delete statusStatsWhere.status;
  const statusStatsRaw = await prisma.law.groupBy({
    by: ['status'],
    _count: { id: true },
    where: { ...statusStatsWhere, status: { not: null } },
  });
  const STATUS_CARD_ORDER = ['现行有效', '已被修改', '已废止', '尚未生效'];
  const statusStats = (statusStatsRaw as Array<{ status: string; _count: { id: number } }>)
    .map(s => ({ status: s.status, count: s._count.id }))
    .sort((a, b) => {
      const ia = STATUS_CARD_ORDER.indexOf(a.status);
      const ib = STATUS_CARD_ORDER.indexOf(b.status);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  // 8. Query law list
  const filteredCount = await prisma.law.count({ where });
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const skip = (safePage - 1) * pageSize;

  let laws: any[];

  if (sortField === 'status') {
    const allLaws = await prisma.law.findMany({ where });
    const statusPriority: Record<string, number> = {
      '现行有效': 1, '已被修改': 2, '尚未施行': 3, '已废止': 4
    };
    allLaws.sort((a, b) => {
      const priorityA = statusPriority[a.status || ''] || 999;
      const priorityB = statusPriority[b.status || ''] || 999;
      return sortOrder === 'asc' ? priorityA - priorityB : priorityB - priorityA;
    });
    laws = allLaws.slice(skip, skip + pageSize);
  } else if (sortField === 'promulgationDate' || sortField === 'effectiveDate') {
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
  } else {
    const orderBy: any = {};
    orderBy[sortField] = sortOrder;
    laws = await prisma.law.findMany({ where, orderBy, skip, take: pageSize });
  }

  const totalCount = await prisma.law.count();

  // URL builder helpers
  function buildAdminHref(overrides: Record<string, string>) {
    const p: Record<string, string> = {};
    if (query) p.q = query;
    if (selectedLevel) p.level = selectedLevel;
    if (selectedStatus) p.status = selectedStatus;
    if (selectedRegion) p.region = selectedRegion;
    if (selectedIndustry) p.industry = selectedIndustry;
    if (selectedYear) p.year = selectedYear;
    if (sortField !== 'updatedAt') p.sort = sortField;
    if (sortOrder !== 'desc') p.order = sortOrder;
    if (pageSize !== 50) p.pageSize = String(pageSize);
    Object.assign(p, overrides);
    for (const k of Object.keys(p)) { if (!p[k]) delete p[k]; }
    delete p.page;
    const qs = new URLSearchParams(p).toString();
    return `/admin/laws${qs ? '?' + qs : ''}`;
  }

  function buildAdminPageHref(page: number) {
    const p: Record<string, string> = {};
    if (query) p.q = query;
    if (selectedLevel) p.level = selectedLevel;
    if (selectedStatus) p.status = selectedStatus;
    if (selectedRegion) p.region = selectedRegion;
    if (selectedIndustry) p.industry = selectedIndustry;
    if (selectedYear) p.year = selectedYear;
    if (sortField !== 'updatedAt') p.sort = sortField;
    if (sortOrder !== 'desc') p.order = sortOrder;
    if (pageSize !== 50) p.pageSize = String(pageSize);
    if (page > 1) p.page = String(page);
    const qs = new URLSearchParams(p).toString();
    return `/admin/laws${qs ? '?' + qs : ''}`;
  }

  const hasFilters = selectedLevel || selectedStatus || selectedRegion || selectedIndustry || selectedYear || query;

  const selectedIndustryName = selectedIndustry
    ? allIndustries.find(i => i.id === parseInt(selectedIndustry))?.name
    : undefined;

  return (
    <div className={`min-h-screen bg-slate-50 font-sans text-slate-900 ${themeClass}`}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <SiteHeader />
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link
              href="/admin/feedback"
              className="text-sm font-medium text-amber-600 border border-amber-200 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors flex items-center gap-1"
            >
              反馈管理
              {pendingFeedbackCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {pendingFeedbackCount}
                </span>
              )}
            </Link>
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
      </header>

      <div className="sticky top-14 z-[15] bg-slate-50" data-sticky-filter>
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
          <LawFilterBar
            query={query}
            levels={levels}
            regionGroups={regionGroups}
            industries={industries}
            years={years}
            selectedLevel={selectedLevel}
            selectedStatus={selectedStatus}
            selectedRegion={selectedRegion}
            selectedIndustry={selectedIndustry}
            selectedYear={selectedYear}
            buildHref={(overrides) => buildAdminHref(overrides)}
          />
        </div>
      </div>

      <section className="max-w-[1400px] mx-auto px-3 sm:px-4 pt-3 pb-4 sm:pb-6">
        {/* Stats cards */}
        <LawStatsCards
          statuses={statusStats}
          selectedStatus={selectedStatus}
          buildHref={(status) => buildAdminHref({ status })}
        />

        {/* Filter status bar */}
        {hasFilters && (
          <div className="mb-4 flex items-center gap-2 text-sm flex-wrap bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <span className="text-slate-500 font-medium">已选:</span>
            {selectedLevel && (
              <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 flex items-center gap-1">
                {selectedLevel}
                <Link href={buildAdminHref({ level: '' })} className="hover:text-purple-900">×</Link>
              </span>
            )}
            {selectedStatus && (
              <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100 flex items-center gap-1">
                {selectedStatus}
                <Link href={buildAdminHref({ status: '' })} className="hover:text-orange-900">×</Link>
              </span>
            )}
            {selectedRegion && (
              <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100 flex items-center gap-1">
                {selectedRegion}
                <Link href={buildAdminHref({ region: '' })} className="hover:text-teal-900">×</Link>
              </span>
            )}
            {selectedIndustry && (
              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                {selectedIndustryName || '行业'}
                <Link href={buildAdminHref({ industry: '' })} className="hover:text-indigo-900">×</Link>
              </span>
            )}
            {selectedYear && (
              <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100 flex items-center gap-1">
                {selectedYear}年
                <Link href={buildAdminHref({ year: '' })} className="hover:text-green-900">×</Link>
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

        {/* Result stats + pageSize */}
        <div className="mb-3 flex items-center justify-between text-sm text-slate-500 px-1">
          <div>
            显示 <span className="font-bold text-slate-700">{filteredCount}</span> 条结果
            {filteredCount < totalCount && <span className="text-slate-400">（共 {totalCount} 条）</span>}
            {totalPages > 1 && <span className="text-slate-400 ml-2">第 {safePage}/{totalPages} 页</span>}
          </div>
          <PageSizeSelect
            pageSize={pageSize}
            searchParams={{
              q: query,
              level: selectedLevel,
              status: selectedStatus,
              year: selectedYear,
              region: selectedRegion,
              industry: selectedIndustry,
            }}
          />
        </div>

        {/* Table */}
        <LawTable
          laws={laws}
          currentSort={sortField}
          currentOrder={sortOrder}
          searchParams={{
            q: query,
            level: selectedLevel,
            status: selectedStatus,
            year: selectedYear,
            region: selectedRegion,
            industry: selectedIndustry,
            pageSize: pageSize !== 50 ? String(pageSize) : '',
          }}
        />

        {/* Pagination */}
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          buildHref={(page) => buildAdminPageHref(page)}
        />
      </section>
    </div>
  );
}
