import Link from 'next/link';
import { prisma } from '@/src/lib/db';
import SiteHeader from '@/components/SiteHeader';
import LawSidebar from '@/components/LawSidebar';
import ThemeToggle from '@/components/ThemeToggle';
import LawStatsCards from '@/components/LawStatsCards';
import LawFilterBar from '@/components/LawFilterBar';
import LawResultCard from '@/components/LawResultCard';
import RecentViewsDropdown from '@/components/RecentViewsDropdown';
import Pagination from '@/components/Pagination';
import { sortLevelsByOrder } from '@/src/lib/level-utils';
import type { Metadata } from 'next';
import { ADMIN_CONFIG } from './admin/admin-config';
import { buildLawBaseTitle, normalizeLawTitle } from '@/src/lib/law-grouping';
import { resolveStatus, statusColor } from '@/src/lib/category-config';
import { PROVINCES, CITY_TO_PROVINCE, COUNTY_TO_PROVINCE, getAllowedRegionValues } from '@/src/lib/region-config';
import RecentViews from '@/src/components/RecentViews';
import MobileFilterPanel from '@/components/MobileFilterPanel';
import './app-styles.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '首页 - 执法监督法规查',
};

const PAGE_SIZE = 50;

type SearchLaw = {
  id: number;
  title: string;
  issuingAuthority: string | null;
  documentNumber: string | null;
  preamble?: string | null;
  promulgationDate: Date | null;
  effectiveDate: Date | null;
  status: string | null;
  level: string;
  region: string | null;
  industryId?: number | null;
  lawGroupId: string | null;
  createdAt: Date;
  updatedAt: Date;
  searchMatchType?: 'title_exact' | 'title_base_exact' | 'title_prefix' | 'title_contains' | 'content';
  searchScore?: number;
};

function FilterStatusBar({ selectedLevel, selectedIndustry, selectedRegion, selectedYear, selectedStatus, query, industryName }: {
  selectedLevel: string; selectedIndustry: string; selectedRegion: string; selectedYear: string; selectedStatus: string; query: string; industryName?: string;
}) {
  const allFilters: Record<string, string> = {};
  if (selectedIndustry) allFilters.industry = selectedIndustry;
  if (selectedLevel) allFilters.level = selectedLevel;
  if (selectedYear) allFilters.year = selectedYear;
  if (selectedRegion) allFilters.region = selectedRegion;
  if (selectedStatus) allFilters.status = selectedStatus;
  const removeFilter = (key: string) => {
    const rest = { ...allFilters };
    delete rest[key];
    const qs = Object.entries(rest).map(([k, v]) => `${k}=${v}`).join('&');
    return qs ? `/?${qs}` : '/';
  };
  return (
    <div className="mb-4 flex items-center gap-2 text-sm flex-wrap">
      <span className="text-slate-500">已选:</span>
      {selectedLevel && (
        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 flex items-center gap-1">
          {selectedLevel}
          <Link href={removeFilter('level')} className="hover:text-purple-900">×</Link>
        </span>
      )}
      {selectedIndustry && (
        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
          {industryName || '行业'}
          <Link href={removeFilter('industry')} className="hover:text-indigo-900">×</Link>
        </span>
      )}
      {selectedRegion && (
        <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100 flex items-center gap-1">
          {selectedRegion}
          <Link href={removeFilter('region')} className="hover:text-teal-900">×</Link>
        </span>
      )}
      {selectedYear && (
        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100 flex items-center gap-1">
          {selectedYear}年
          <Link href={removeFilter('year')} className="hover:text-green-900">×</Link>
        </span>
      )}
      {selectedStatus && (
        <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100 flex items-center gap-1">
          {selectedStatus}
          <Link href={removeFilter('status')} className="hover:text-orange-900">×</Link>
        </span>
      )}
      {query && (
        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">
          搜: {query}
        </span>
      )}
      <Link href="/" className="text-slate-400 hover:text-slate-600 text-xs underline ml-auto">重置所有</Link>
    </div>
  );
}

function compareByDateDesc(a: SearchLaw, b: SearchLaw) {
  if (a.effectiveDate && b.effectiveDate) {
    return b.effectiveDate.getTime() - a.effectiveDate.getTime();
  }
  if (a.effectiveDate && !b.effectiveDate) return -1;
  if (!a.effectiveDate && b.effectiveDate) return 1;
  if (a.promulgationDate && b.promulgationDate) {
    return b.promulgationDate.getTime() - a.promulgationDate.getTime();
  }
  if (a.promulgationDate && !b.promulgationDate) return -1;
  if (!a.promulgationDate && b.promulgationDate) return 1;
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
    return { score: 700 - safePosition, matchType: 'title_contains' as const };
  }
  return { score: 0, matchType: 'content' as const };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; industry?: string; level?: string; year?: string; region?: string; status?: string; page?: string; view?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const selectedIndustry = params.industry ?? '';
  const selectedLevel = params.level ?? '';
  const selectedYear = params.year ?? '';
  const selectedRegion = params.region ?? '';
  const selectedStatus = params.status ?? '';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));
  const viewMode = params.view ?? 'modern';

  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) urlParams.set(key, value);
  });
  const theme = ADMIN_CONFIG.getTheme(urlParams);
  const isOptimized = ADMIN_CONFIG.isOptimized(theme);
  const themeClass = isOptimized ? 'app-optimized' : '';

  const allowedRegions = getAllowedRegionValues();
  const regionFilter = {
    OR: [
      { region: { in: allowedRegions } },
      { region: null },
    ],
  };

  // === Shared data queries ===
  const levels = await prisma.law.groupBy({
    by: ['level'],
    _count: { id: true },
    where: regionFilter,
  });
  sortLevelsByOrder(levels);

  const STATUS_ORDER = ['现行有效', '已被修改', '已废止', '尚未生效'];
  const rawStatuses = await prisma.law.groupBy({
    by: ['status'],
    _count: { id: true },
    where: { status: { not: null }, ...regionFilter },
  });
  const statuses = (rawStatuses as Array<{ status: string; _count: { id: number } }>)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const classicTotalCount = await prisma.law.count({ where: regionFilter });

  // Region stats
  const rawRegions = await prisma.law.groupBy({
    by: ['region'],
    _count: { id: true },
    where: { region: { not: null, in: allowedRegions } },
  });
  const typedRegions = rawRegions as Array<{ region: string; _count: { id: number } }>;

  const provinceMap = new Map<string, { province: string; totalCount: number; provinceOwnCount: number; children: Array<{ name: string; count: number }> }>();
  const nationwideEntry = typedRegions.find(r => r.region === '全国');

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

  const regionGroups = Array.from(provinceMap.values())
    .sort((a, b) => b.totalCount - a.totalCount)
    .map(g => ({ ...g, children: g.children.sort((a, b) => b.count - a.count) }));
  if (nationwideEntry) {
    regionGroups.unshift({ province: '全国', totalCount: nationwideEntry._count.id, provinceOwnCount: nationwideEntry._count.id, children: [] });
  }

  // Industry stats (two-level tree)
  const allIndustries = await prisma.industry.findMany({
    select: { id: true, code: true, name: true, parentCode: true, order: true },
    orderBy: { order: 'asc' },
  });
  const industryLawCounts = await prisma.lawIndustry.groupBy({
    by: ['industryId'],
    _count: { lawId: true },
    where: { law: regionFilter },
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
      const l1OwnCount = countMap.get(l1.id) || 0;
      const childrenTotal = children.reduce((s, c) => s + c._count, 0);
      return { id: l1.id, name: l1.name, _count: l1OwnCount + childrenTotal, children };
    })
    .filter(ind => ind._count > 0);

  // Year stats
  const regionPlaceholders = allowedRegions.map(() => '?').join(',');
  const yearRows = await prisma.$queryRawUnsafe<Array<{ year: string; cnt: bigint }>>(
    `SELECT strftime('%Y', promulgationDate / 1000, 'unixepoch') as year, COUNT(*) as cnt
     FROM Law
     WHERE promulgationDate IS NOT NULL AND (region IN (${regionPlaceholders}) OR region IS NULL)
     GROUP BY year
     ORDER BY year DESC`,
    ...allowedRegions,
  );
  const years = yearRows.map(r => ({ year: r.year, count: Number(r.cnt) }));

  // === Build filter conditions ===
  const where: any = { ...regionFilter };
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
      const universalLawIds = await prisma.law.findMany({
        where: { scope: 'universal', ...regionFilter },
        select: { id: true },
      });
      where.id = { in: [...new Set([...lawIdRows.map(r => r.lawId), ...universalLawIds.map(r => r.id)])] };
    } else {
      const lawIdRows = await prisma.lawIndustry.findMany({
        where: { industryId: indId },
        select: { lawId: true },
        distinct: ['lawId'],
      });
      const universalLawIds = await prisma.law.findMany({
        where: { scope: 'universal', ...regionFilter },
        select: { id: true },
      });
      where.id = { in: [...new Set([...lawIdRows.map(r => r.lawId), ...universalLawIds.map(r => r.id)])] };
    }
  }
  if (selectedLevel) where.level = selectedLevel;
  if (selectedStatus) where.status = selectedStatus;
  if (selectedRegion) {
    where.region = selectedRegion;
    delete where.OR;
  }
  if (selectedYear) {
    const start = new Date(`${selectedYear}-01-01`);
    const end = new Date(`${selectedYear}-12-31`);
    where.promulgationDate = { gte: start, lte: end };
  }

  // === Status stats for cards (follow all filters except status itself) ===
  const statusStatsWhere = { ...where };
  delete statusStatsWhere.status;
  const statusStatsRaw = await prisma.law.groupBy({
    by: ['status'],
    _count: { id: true },
    where: { ...statusStatsWhere, status: { not: null } },
  });
  const STATUS_CARD_ORDER = ['现行有效', '已被修改', '已废止', '尚未生效', '部分废止或失效'];
  const statusStats = (statusStatsRaw as Array<{ status: string; _count: { id: number } }>)
    .map(s => ({ status: s.status, count: s._count.id }))
    .sort((a, b) => {
      const ia = STATUS_CARD_ORDER.indexOf(a.status);
      const ib = STATUS_CARD_ORDER.indexOf(b.status);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  // === Query laws ===
  const selectFields = {
    id: true, title: true, issuingAuthority: true, documentNumber: true,
    promulgationDate: true, effectiveDate: true, status: true, level: true,
    region: true, industryId: true, lawGroupId: true,
    createdAt: true, updatedAt: true,
  } as const;

  let laws: SearchLaw[] = [];
  let titleMatchCount = 0;
  let contentMatchCount = 0;
  let totalCount = 0;
  let totalPages = 1;

  if (query) {
    const titleMatchedLaws = await prisma.law.findMany({
      where: { ...where, title: { contains: query } },
      select: selectFields,
    });

    const scoredTitleMatches: SearchLaw[] = titleMatchedLaws
      .map((law) => {
        const { score, matchType } = scoreLawTitleMatch(law.title, query);
        return { ...law, searchScore: score, searchMatchType: matchType };
      })
      .sort((a, b) => {
        if ((b.searchScore ?? 0) !== (a.searchScore ?? 0)) return (b.searchScore ?? 0) - (a.searchScore ?? 0);
        return compareByDateDesc(a, b);
      });

    const titleMatchedIds = new Set(scoredTitleMatches.map(law => law.id));

    const contentLawIdRows = await prisma.$queryRawUnsafe<Array<{lawId: bigint}>>(
      `SELECT DISTINCT a.lawId FROM Paragraph p
       JOIN Article a ON a.id = p.articleId
       WHERE p.content LIKE ?
       LIMIT 200`,
      `%${query}%`
    );
    const contentCandidateIds = contentLawIdRows
      .map(r => Number(r.lawId))
      .filter(id => !titleMatchedIds.has(id));

    const contentMatchedLaws = contentCandidateIds.length > 0 ? await prisma.law.findMany({
      where: { ...where, id: { in: contentCandidateIds } },
      select: selectFields,
      take: 50,
    }) : [];

    const scoredContentMatches: SearchLaw[] = contentMatchedLaws
      .map((law) => ({ ...law, searchScore: 100, searchMatchType: 'content' as const }))
      .sort(compareByDateDesc);

    const allResults = [...scoredTitleMatches, ...scoredContentMatches];
    titleMatchCount = scoredTitleMatches.length;
    contentMatchCount = scoredContentMatches.length;
    totalCount = allResults.length;
    totalPages = Math.ceil(totalCount / PAGE_SIZE);

    laws = allResults.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  } else {
    totalCount = await prisma.law.count({ where });
    totalPages = Math.ceil(totalCount / PAGE_SIZE);

    laws = await prisma.law.findMany({
      where,
      select: selectFields,
      orderBy: [{ effectiveDate: 'desc' }, { promulgationDate: 'desc' }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }) as SearchLaw[];
  }

  // Industry name lookup for cards
  const industryNameMap = new Map<number, string>();
  for (const ind of allIndustries) {
    industryNameMap.set(ind.id, ind.name);
  }

  // For classic view: grouped laws
  const shouldShowGrouped = viewMode === 'classic' && !query && !selectedLevel && !selectedYear && !selectedIndustry && !selectedRegion && !selectedStatus;

  // Classic view needs all laws without pagination
  let classicLaws: SearchLaw[] = [];
  if (viewMode === 'classic') {
    if (query) {
      classicLaws = laws; // reuse search results
    } else {
      classicLaws = await prisma.law.findMany({
        where,
        select: selectFields,
        orderBy: [{ effectiveDate: 'desc' }, { promulgationDate: 'desc' }],
        take: 200,
      }) as SearchLaw[];
    }
  }

  // Industry info for classic view grouping
  const classicIndustryInfo = new Map<number, { name: string; l1Id: number }>();
  if (shouldShowGrouped && classicLaws.length > 0) {
    const lawIds = classicLaws.map(l => l.id);
    const primaryIndustries = await prisma.lawIndustry.findMany({
      where: { lawId: { in: lawIds }, isPrimary: true },
      select: { lawId: true, industry: { select: { id: true, name: true, parentCode: true } } },
    });
    for (const pi of primaryIndustries) {
      if (pi.industry.parentCode) {
        const parent = allIndustries.find(i => i.code === pi.industry.parentCode);
        classicIndustryInfo.set(pi.lawId, { name: parent?.name || pi.industry.name, l1Id: parent?.id || pi.industry.id });
      } else {
        classicIndustryInfo.set(pi.lawId, { name: pi.industry.name, l1Id: pi.industry.id });
      }
    }
  }

  const groupedLaws = shouldShowGrouped
    ? classicLaws.reduce((acc, law) => {
        const info = classicIndustryInfo.get(law.id);
        const groupName = info?.name || '未分类';
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(law);
        return acc;
      }, {} as Record<string, SearchLaw[]>)
    : null;

  const groupIndustryIds = new Map<string, number>();
  for (const [, info] of classicIndustryInfo) {
    if (!groupIndustryIds.has(info.name)) groupIndustryIds.set(info.name, info.l1Id);
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '暂无';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  };

  // === URL builder helpers ===
  function buildQuery(overrides: Record<string, string>) {
    const p: Record<string, string> = {};
    if (selectedIndustry) p.industry = selectedIndustry;
    if (selectedLevel) p.level = selectedLevel;
    if (selectedYear) p.year = selectedYear;
    if (selectedRegion) p.region = selectedRegion;
    if (selectedStatus) p.status = selectedStatus;
    if (query) p.q = query;
    if (viewMode === 'classic') p.view = 'classic';
    Object.assign(p, overrides);
    if (!overrides.page) delete p.page;
    for (const k of Object.keys(p)) { if (!p[k]) delete p[k]; }
    const qs = new URLSearchParams(p).toString();
    return qs ? `/?${qs}` : '/';
  }

  function buildQueryClassic(overrides: Record<string, string>) {
    const p: Record<string, string> = { view: 'classic' };
    if (selectedIndustry) p.industry = selectedIndustry;
    if (selectedLevel) p.level = selectedLevel;
    if (selectedYear) p.year = selectedYear;
    if (selectedRegion) p.region = selectedRegion;
    if (selectedStatus) p.status = selectedStatus;
    if (query) p.q = query;
    Object.assign(p, overrides);
    for (const k of Object.keys(p)) { if (!p[k]) delete p[k]; }
    const qs = new URLSearchParams(p).toString();
    return qs ? `/?${qs}` : '/';
  }

  const hasFilters = selectedIndustry || selectedLevel || selectedYear || selectedRegion || selectedStatus || query;

  // Find industry name for selected
  const selectedIndustryName = selectedIndustry
    ? allIndustries.find(i => i.id === parseInt(selectedIndustry))?.name
    : undefined;

  const lawIndustryNames = new Map<number, string>();
  if (viewMode !== 'classic' && laws.length > 0) {
    const lawIds = laws.map(l => l.id);
    const primaryIndustries = await prisma.lawIndustry.findMany({
      where: { lawId: { in: lawIds }, isPrimary: true },
      select: { lawId: true, industry: { select: { name: true, parentCode: true } } },
    });
    for (const pi of primaryIndustries) {
      if (pi.industry.parentCode) {
        const parent = allIndustries.find(i => i.code === pi.industry.parentCode);
        lawIndustryNames.set(pi.lawId, parent?.name || pi.industry.name);
      } else {
        lawIndustryNames.set(pi.lawId, pi.industry.name);
      }
    }
  }

  // === View switch URL ===
  const switchViewParams = new URLSearchParams();
  if (selectedIndustry) switchViewParams.set('industry', selectedIndustry);
  if (selectedLevel) switchViewParams.set('level', selectedLevel);
  if (selectedYear) switchViewParams.set('year', selectedYear);
  if (selectedRegion) switchViewParams.set('region', selectedRegion);
  if (selectedStatus) switchViewParams.set('status', selectedStatus);
  if (query) switchViewParams.set('q', query);

  const classicViewUrl = (() => {
    const p = new URLSearchParams(switchViewParams);
    p.set('view', 'classic');
    return `/?${p.toString()}`;
  })();
  const modernViewUrl = (() => {
    const p = new URLSearchParams(switchViewParams);
    p.delete('view');
    const qs = p.toString();
    return qs ? `/?${qs}` : '/';
  })();

  // ============================
  // CLASSIC VIEW
  // ============================
  if (viewMode === 'classic') {
    return (
      <div className={`min-h-screen bg-slate-50 font-sans text-slate-900${themeClass ? ' ' + themeClass : ''}`}>
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
            <SiteHeader />
            <form className="hidden sm:block flex-1 max-w-lg mx-6 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <input type="text" name="q" defaultValue={query} placeholder="搜索法规..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all outline-none" />
              <input type="hidden" name="view" value="classic" />
              {selectedIndustry && <input type="hidden" name="industry" value={selectedIndustry} />}
              {selectedLevel && <input type="hidden" name="level" value={selectedLevel} />}
              {selectedYear && <input type="hidden" name="year" value={selectedYear} />}
              {selectedRegion && <input type="hidden" name="region" value={selectedRegion} />}
              {selectedStatus && <input type="hidden" name="status" value={selectedStatus} />}
            </form>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Link href="/enforcement" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">执法事项</Link>
              <Link href="/admin/laws" target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">后台管理</Link>
              <Link href={modernViewUrl} title="切换到新版视图" className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </Link>
              <ThemeToggle variant="app" className="ml-1 sm:ml-4" />
            </div>
          </div>
          <form className="sm:hidden px-3 pb-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <input type="text" name="q" defaultValue={query} placeholder="搜索法规..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all outline-none" />
              <input type="hidden" name="view" value="classic" />
              {selectedIndustry && <input type="hidden" name="industry" value={selectedIndustry} />}
              {selectedLevel && <input type="hidden" name="level" value={selectedLevel} />}
              {selectedYear && <input type="hidden" name="year" value={selectedYear} />}
              {selectedRegion && <input type="hidden" name="region" value={selectedRegion} />}
              {selectedStatus && <input type="hidden" name="status" value={selectedStatus} />}
            </div>
          </form>
        </header>

        <MobileFilterPanel
          baseUrl="/?view=classic"
          totalCount={classicTotalCount}
          levels={levels}
          industries={industries}
          regionGroups={regionGroups}
          years={years}
          statuses={statuses}
          selectedIndustry={selectedIndustry}
          selectedLevel={selectedLevel}
          selectedYear={selectedYear}
          selectedRegion={selectedRegion}
          selectedStatus={selectedStatus}
        />

        <section className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex gap-6">
          <div className="w-56 shrink-0 hidden md:block h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
            <div className="sticky top-0 bg-slate-50 pb-2 z-20 space-y-2"></div>
            <div className="mb-3"><RecentViews /></div>
            <LawSidebar
              baseUrl="/?view=classic"
              totalCount={classicTotalCount}
              levels={levels}
              industries={industries}
              regionGroups={regionGroups}
              years={years}
              statuses={statuses}
              selectedIndustry={selectedIndustry}
              selectedLevel={selectedLevel}
              selectedYear={selectedYear}
              selectedRegion={selectedRegion}
              selectedStatus={selectedStatus}
            />
          </div>

          <main className="flex-1 min-w-0" key={`${query}-${selectedIndustry}-${selectedLevel}-${selectedYear}-${selectedRegion}-${selectedStatus}`}>
            {(selectedIndustry || selectedLevel || selectedYear || selectedRegion || selectedStatus || query) && (
              <FilterStatusBar
                selectedLevel={selectedLevel} selectedIndustry={selectedIndustry}
                selectedRegion={selectedRegion} selectedYear={selectedYear}
                selectedStatus={selectedStatus} query={query}
                industryName={industries.find(i => i.id === parseInt(selectedIndustry))?.name}
              />
            )}

            {query && classicLaws.length > 0 && (
              <div className="mb-4 flex items-center gap-2 text-xs flex-wrap text-slate-500">
                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">标题命中 {titleMatchCount}</span>
                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">正文相关 {contentMatchCount}</span>
                <span>搜索结果已按标题相关性优先排序</span>
              </div>
            )}

            {classicLaws.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="text-center py-20"><p className="text-slate-400 text-base">暂无相关法规</p></div>
              </div>
            ) : shouldShowGrouped && groupedLaws ? (
              <div className="space-y-6">
                {Object.entries(groupedLaws).map(([groupName, groupLaws]) => {
                  const industryId = groupIndustryIds.get(groupName);
                  const moreHref = industryId ? buildQueryClassic({ industry: String(industryId) }) : buildQueryClassic({});
                  return (
                  <div key={groupName}>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h2 className="text-base font-bold text-slate-700 flex items-center gap-2">
                        <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                        {groupName}
                        <span className="text-sm font-normal text-slate-400">({groupLaws.length})</span>
                      </h2>
                      {groupLaws.length > 5 && (
                        <Link href={moreHref} className="text-sm text-blue-600 hover:text-blue-800 font-medium">更多 →</Link>
                      )}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-sm">
                      {groupLaws.slice(0, 5).map((law) => (
                        <Link href={`/law/${law.id}`} target="_blank" key={law.id} className="group block p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-2">
                                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 leading-snug">{law.title}</h3>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                  law.level === '法律' ? 'bg-red-50 text-red-600 border border-red-100' :
                                  law.level === '行政法规' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                  law.level === '部门规章' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                  law.level === '地方性法规' ? 'bg-green-50 text-green-600 border border-green-100' :
                                  'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}>{law.level}</span>
                              </div>
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
                      {groupLaws.length > 5 && (
                        <Link href={moreHref} className="block px-4 py-3 text-center text-sm text-blue-600 hover:bg-slate-50 hover:text-blue-800 transition-colors">
                          查看全部 {groupLaws.length} 部法规 →
                        </Link>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-sm">
                {classicLaws.map((law) => (
                  <Link href={`/law/${law.id}`} target="_blank" key={law.id} className="group block p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-2">
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 leading-snug">{law.title}</h3>
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
                          }`}>{law.level}</span>
                        </div>
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
              {query
                ? `共 ${classicLaws.length} 条结果`
                : shouldShowGrouped
                  ? `共 ${classicTotalCount} 部法规`
                  : `显示 ${classicLaws.length} 部结果`
              }
            </div>
          </main>
        </section>
      </div>
    );
  }

  // ============================
  // MODERN VIEW (default)
  // ============================
  return (
    <div className={`min-h-screen bg-[var(--color-bg-primary,#faf8f5)] font-sans text-slate-900${themeClass ? ' ' + themeClass : ''}`}>
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <SiteHeader />
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link href="/" className="text-sm font-semibold text-slate-900 hidden sm:inline">法规检索</Link>
            <Link href="/enforcement" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">执法事项</Link>
            <Link href="/enforcement/plan" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">梳理方案</Link>
            <Link href="/admin/laws" target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">后台管理</Link>
            <Link href={classicViewUrl} title="切换到经典视图" className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </Link>
            <ThemeToggle variant="app" className="ml-1 sm:ml-2" />
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">法规数据库</h1>
            <p className="text-base text-slate-500 mt-1">
              共 <span className="font-semibold text-slate-700">{totalCount.toLocaleString()}</span> 部法规
              {hasFilters && (
                <span className="ml-1">
                  {query ? '' : ` · 第 ${currentPage}/${totalPages} 页`}
                </span>
              )}
              {!hasFilters && totalPages > 1 && (
                <span className="ml-1"> · 第 {currentPage}/{totalPages} 页</span>
              )}
            </p>
          </div>
          {hasFilters && (
            <Link href="/" className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">重置筛选</Link>
          )}
        </div>

        {/* Stats cards */}
        <LawStatsCards
          statuses={statusStats}
          selectedStatus={selectedStatus}
          buildHref={(status) => buildQuery({ status })}
        />

        {/* Filter bar */}
        <LawFilterBar
          query={query}
          levels={levels}
          statuses={statuses}
          regionGroups={regionGroups}
          industries={industries}
          years={years}
          selectedLevel={selectedLevel}
          selectedStatus={selectedStatus}
          selectedRegion={selectedRegion}
          selectedIndustry={selectedIndustry}
          selectedYear={selectedYear}
          buildHref={(overrides) => buildQuery(overrides)}
        />

        {/* Result header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="text-sm text-slate-400">
            {query ? (
              <>标题命中 {titleMatchCount} · 正文相关 {contentMatchCount} · 第 {currentPage}/{totalPages} 页</>
            ) : hasFilters ? (
              <>{totalCount.toLocaleString()} 条结果{totalPages > 1 && ` · 第 ${currentPage}/${totalPages} 页`}</>
            ) : (
              <>共 {totalCount.toLocaleString()} 部法规{totalPages > 1 && ` · 第 ${currentPage}/${totalPages} 页`}</>
            )}
          </div>
          <RecentViewsDropdown />
        </div>

        {/* Law list */}
        {laws.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/60">
            <div className="text-center py-20">
              <p className="text-slate-500 text-base">暂无相关法规</p>
              {hasFilters && (
                <Link href="/" className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-800">清除筛选条件 →</Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {laws.map((law, i) => (
              <LawResultCard
                key={law.id}
                law={law}
                index={(currentPage - 1) * PAGE_SIZE + i + 1}
                industryName={lawIndustryNames.get(law.id)}
                resolvedStatus={resolveStatus(law.status, law.effectiveDate)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={(page) => buildQuery({ page: String(page) })}
        />
      </section>
    </div>
  );
}
