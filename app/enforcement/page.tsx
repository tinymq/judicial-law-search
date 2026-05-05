import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ThemeToggle from '@/components/ThemeToggle';
import Pagination from '@/components/Pagination';
import HoverDetails from '@/components/HoverDetails';
import { prisma } from '@/src/lib/db';
import { ENFORCEMENT_CATEGORIES } from '@/src/lib/industry-config';
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, LEVEL_COLORS, getCategoryColor } from '@/src/lib/enforcement-constants';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '执法事项目录 - 执法监督法规查',
};

const PROVINCE_OPTIONS = [
  { code: '330000', label: '浙江' },
  { code: '430000', label: '湖南' },
  { code: '460000', label: '海南' },
  { code: '370000', label: '山东' },
  { code: '320000', label: '江苏' },
];

const PROVINCE_NAMES: Record<string, string> = Object.fromEntries(
  PROVINCE_OPTIONS.map(p => [p.code, p.label])
);

// 分页配置
const PAGE_SIZE = 50;

export default async function EnforcementPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; industry?: string; q?: string; province?: string; domain?: string; level?: string; linked?: string; view?: string; lawLevel?: string; scope?: string; page?: string; lawId?: string; citation?: string; minRef?: string; maxRef?: string }>;
}) {
  const params = await searchParams;
  const selectedCategory = params.category ?? '';
  const selectedIndustry = params.industry ?? '';
  const selectedProvince = params.province ?? '';
  const selectedDomain = params.domain ?? '';
  const selectedLevel = params.level ?? '';
  const selectedLinked = params.linked ?? '';
  const viewMode = params.view ?? '';
  const selectedLawLevel = params.lawLevel ?? '';
  const selectedScope = params.scope ?? '';
  const query = params.q ?? '';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));

  // 构建查询条件
  const where: any = {};
  const andConditions: any[] = [];
  if (selectedCategory) where.category = selectedCategory;
  if (selectedIndustry) where.industryId = parseInt(selectedIndustry);
  if (selectedProvince) where.province = selectedProvince;
  if (selectedDomain) where.enforcementDomain = selectedDomain;
  if (selectedLevel) where.enforcementLevel = { contains: selectedLevel };
  if (params.lawId) where.lawId = parseInt(params.lawId);
  else if (selectedLinked === 'no') where.lawId = null;
  else if (selectedLinked === 'yes') where.lawId = { not: null };
  if (query) {
    andConditions.push({
      OR: [
        { name: { contains: query } },
        { law: { is: { title: { contains: query } } } },
      ],
    });
  }

  // 按法规级别筛选事项（非 laws 视图下）
  if (selectedLawLevel && viewMode !== 'laws') {
    andConditions.push({ law: { is: { level: selectedLawLevel } } });
  }

  // 按引用模式筛选
  if (params.citation === 'single') {
    andConditions.push({ legalBasisText: { contains: '《' } });
    andConditions.push({ NOT: { legalBasisText: { contains: '》《' } } });
  } else if (params.citation === 'multi') {
    andConditions.push({ legalBasisText: { contains: '》《' } });
  } else if (params.citation === 'none') {
    andConditions.push({
      OR: [
        { legalBasisText: null },
        { NOT: { legalBasisText: { contains: '《' } } },
      ],
    });
  }

  // 适用范围筛选
  if (selectedScope === '通用') {
    andConditions.push({
      OR: [
        { enforcementLevel: null },
        { enforcementLevel: { contains: '省级' } },
        { enforcementLevel: { contains: '各级' } },
      ],
    });
    andConditions.push({
      OR: [
        { lawId: null },
        { law: { is: { level: { notIn: ['地方性法规', '地方政府规章'] } } } },
      ],
    });
  } else if (selectedScope) {
    const scopeCode = PROVINCE_OPTIONS.find(p => p.label === selectedScope)?.code;
    if (scopeCode) {
      andConditions.push({ province: scopeCode });
      andConditions.push({
        OR: [
          {
            AND: [
              { enforcementLevel: { not: null } },
              { NOT: { enforcementLevel: { contains: '省级' } } },
              { NOT: { enforcementLevel: { contains: '各级' } } },
            ],
          },
          { law: { is: { level: { in: ['地方性法规', '地方政府规章'] } } } },
        ],
      });
    }
  }
  if (andConditions.length > 0) where.AND = andConditions;

  const items = await prisma.enforcementItem.findMany({
    where,
    include: { industry: true, law: { select: { id: true, title: true, level: true } } },
    orderBy: [{ sequenceNumber: 'asc' }],
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const totalCount = await prisma.enforcementItem.count({ where });
  const allCount = await prisma.enforcementItem.count();
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 获取类别统计（跟随所有筛选条件，除类别本身）
  const categoryStatsWhere = { ...where };
  delete categoryStatsWhere.category;

  const categoryStats = await prisma.enforcementItem.groupBy({
    by: ['category'],
    _count: { id: true },
    ...(Object.keys(categoryStatsWhere).length > 0 ? { where: categoryStatsWhere } : {}),
    orderBy: { _count: { id: 'desc' } },
  });

  // 获取执法领域统计（跟随所有筛选条件，除领域本身）
  const domainStatsWhere = { ...where, enforcementDomain: { not: null } };

  const domainStats = await prisma.enforcementItem.groupBy({
    by: ['enforcementDomain'],
    _count: { id: true },
    where: domainStatsWhere,
    orderBy: { _count: { id: 'desc' } },
  });

  // 获取法规关联统计
  const linkedCount = await prisma.enforcementItem.count({ where: { lawId: { not: null } } });

  // 省份事项统计
  const provinceStats = await prisma.enforcementItem.groupBy({
    by: ['province'],
    _count: { id: true },
  });

  // 法规视图：获取关联法规清单
  const lawWhere: any = { enforcementItems: { some: {} } };
  if (selectedLawLevel && viewMode === 'laws') lawWhere.level = selectedLawLevel;

  let linkedLaws = viewMode === 'laws' ? await prisma.law.findMany({
    where: lawWhere,
    select: {
      id: true,
      title: true,
      level: true,
      issuingAuthority: true,
      _count: { select: { enforcementItems: true } },
    },
    orderBy: { title: 'asc' },
  }) : [];

  // minRef/maxRef: filter laws by enforcement item count
  const minRef = parseInt(params.minRef || '0');
  const maxRef = parseInt(params.maxRef || '0');
  if (viewMode === 'laws' && (minRef > 0 || maxRef > 0)) {
    linkedLaws = linkedLaws.filter(l => {
      const c = l._count.enforcementItems;
      if (minRef > 0 && c < minRef) return false;
      if (maxRef > 0 && c > maxRef) return false;
      return true;
    });
  }

  // 法规位阶统计（始终基于全部关联法规，不受 lawLevel 筛选影响）
  const allLinkedLaws = viewMode === 'laws' && selectedLawLevel ? await prisma.law.findMany({
    where: { enforcementItems: { some: {} } },
    select: { level: true },
  }) : linkedLaws;

  // 从分析页透视来的新筛选参数
  const selectedCitation = params.citation ?? '';
  const selectedMinRef = params.minRef ?? '';
  const selectedMaxRef = params.maxRef ?? '';

  // 构建筛选参数的辅助函数
  function buildQuery(overrides: Record<string, string>) {
    const p: Record<string, string> = {};
    if (selectedCategory) p.category = selectedCategory;
    if (selectedIndustry) p.industry = selectedIndustry;
    if (selectedProvince) p.province = selectedProvince;
    if (selectedDomain) p.domain = selectedDomain;
    if (selectedLevel) p.level = selectedLevel;
    if (selectedLinked) p.linked = selectedLinked;
    if (selectedScope) p.scope = selectedScope;
    if (viewMode) p.view = viewMode;
    if (query) p.q = query;
    if (selectedLawLevel && viewMode !== 'laws') p.lawLevel = selectedLawLevel;
    if (selectedCitation) p.citation = selectedCitation;
    if (selectedMinRef) p.minRef = selectedMinRef;
    if (selectedMaxRef) p.maxRef = selectedMaxRef;
    Object.assign(p, overrides);
    // 切换筛选条件时重置页码
    if (!overrides.page) delete p.page;
    for (const k of Object.keys(p)) {
      if (!p[k]) delete p[k];
    }
    const qs = new URLSearchParams(p).toString();
    return qs ? `/enforcement?${qs}` : '/enforcement';
  }

  // 判断是否有活跃筛选
  const hasFilters = selectedCategory || selectedIndustry || selectedProvince || selectedDomain || selectedLevel || selectedLinked || selectedScope || query || selectedLawLevel || selectedCitation || selectedMinRef;

  // 分析页透视来的筛选标签
  const CITATION_LABELS: Record<string, string> = { single: '单法规引用', multi: '多法规引用', none: '无明确引用' };
  const analyticsFilters: { label: string; clearHref: string }[] = [];
  if (selectedLawLevel && viewMode !== 'laws') {
    analyticsFilters.push({ label: `法规级别: ${selectedLawLevel}`, clearHref: buildQuery({ lawLevel: '' }) });
  }
  if (selectedCitation) {
    analyticsFilters.push({ label: `引用模式: ${CITATION_LABELS[selectedCitation] || selectedCitation}`, clearHref: buildQuery({ citation: '' }) });
  }
  if (selectedMinRef || selectedMaxRef) {
    const rangeLabel = selectedMaxRef ? `${selectedMinRef || 1}-${selectedMaxRef}条引用` : `${selectedMinRef}条以上引用`;
    analyticsFilters.push({ label: `复用度: ${rangeLabel}`, clearHref: buildQuery({ minRef: '', maxRef: '' }) });
  }
  if (params.lawId) {
    const lawTitle = items[0]?.law?.title;
    analyticsFilters.push({ label: `关联法规: ${lawTitle || `#${params.lawId}`}`, clearHref: buildQuery({ lawId: '' } as any) });
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary,#faf8f5)] font-sans text-slate-900">
      {/* 顶部导航栏 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <SiteHeader />
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              法规检索
            </Link>
            <Link href="/enforcement" className="text-sm font-semibold text-slate-900 hidden sm:inline">
              执法事项
            </Link>
            <Link href="/enforcement/analytics" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              数据分析
            </Link>
            <Link href="/admin/laws" target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              后台管理
            </Link>
            <ThemeToggle variant="app" className="ml-1 sm:ml-2" />
          </div>
        </div>
      </header>

      {/* Sticky title + search + filter */}
      {(() => {
        const activeFilterCount = [selectedProvince, selectedScope, selectedLevel, selectedDomain, selectedLawLevel, selectedLinked, selectedCitation].filter(Boolean).length;
        return (
      <div className="sticky top-14 z-10 bg-[var(--color-bg-primary,#faf8f5)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
          <HoverDetails className="group bg-white rounded-xl border border-slate-200/60 p-4">
            <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-4 flex-wrap sm:flex-nowrap">
              <div className="shrink-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">执法事项目录</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  共 <span className="font-semibold text-slate-700">{allCount}</span> 项
                  {hasFilters && totalCount !== allCount && (
                    <span className="ml-1">
                      · 筛选 <span className="font-semibold text-blue-600">{totalCount}</span> 项
                    </span>
                  )}
                  {hasFilters && (
                    <Link href="/enforcement" className="ml-2 text-slate-400 hover:text-slate-600 underline underline-offset-2">
                      重置
                    </Link>
                  )}
                </p>
              </div>
              <form className="flex-1 min-w-0 relative order-last sm:order-none w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                </div>
                <input
                  type="text"
                  name="q"
                  defaultValue={query}
                  placeholder="搜索事项名称 / 法规名称..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all outline-none cursor-text"
                />
                {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
                {selectedIndustry && <input type="hidden" name="industry" value={selectedIndustry} />}
                {selectedProvince && <input type="hidden" name="province" value={selectedProvince} />}
                {selectedDomain && <input type="hidden" name="domain" value={selectedDomain} />}
                {selectedLevel && <input type="hidden" name="level" value={selectedLevel} />}
                {selectedLinked && <input type="hidden" name="linked" value={selectedLinked} />}
                {selectedScope && <input type="hidden" name="scope" value={selectedScope} />}
              </form>
              <div data-hover-trigger className="shrink-0 inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-2.5 cursor-pointer select-none transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                <span className="text-sm font-medium text-slate-600">筛选</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-blue-600 text-white">{activeFilterCount}</span>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </summary>

            <div className="flex flex-wrap gap-x-6 gap-y-3 mt-3 pt-3 border-t border-slate-100">
              {/* 省份筛选 */}
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-slate-400 w-12 shrink-0 pt-1.5">来源</span>
                <div className="flex-1 min-w-0">
                <div className="flex gap-2 flex-wrap">
                  {PROVINCE_OPTIONS.map(p => {
                    const stat = provinceStats.find(s => s.province === p.code);
                    return (
                      <Link
                        key={p.code}
                        href={buildQuery({ province: selectedProvince === p.code ? '' : p.code })}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          selectedProvince === p.code
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                        {stat && <span className="ml-1 opacity-50">{stat._count.id}</span>}
                      </Link>
                    );
                  })}
                </div>
                </div>
              </div>

              {/* 适用范围筛选 */}
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-slate-400 w-12 shrink-0 pt-1.5">范围</span>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 flex-wrap">
                    {['通用', ...provinceStats.map(s => PROVINCE_NAMES[s.province]).filter(Boolean)].map(scope => (
                      <Link
                        key={scope}
                        href={buildQuery({ scope: selectedScope === scope ? '' : scope })}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          selectedScope === scope
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {scope}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* 层级筛选 */}
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-slate-400 w-12 shrink-0 pt-1.5">层级</span>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 flex-wrap">
                    {['省级', '市级', '县级', '乡级'].map(level => (
                      <Link
                        key={level}
                        href={buildQuery({ level: selectedLevel === level ? '' : level })}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          selectedLevel === level
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {level}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* 执法领域筛选 */}
              {domainStats.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium text-slate-400 w-12 shrink-0 pt-1.5">领域</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 flex-wrap">
                      {domainStats.slice(0, 14).map(d => (
                        <Link
                          key={d.enforcementDomain}
                          href={buildQuery({ domain: selectedDomain === d.enforcementDomain! ? '' : d.enforcementDomain! })}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            selectedDomain === d.enforcementDomain
                              ? 'bg-slate-800 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {d.enforcementDomain}
                          <span className="ml-1 opacity-50">{d._count.id}</span>
                        </Link>
                      ))}
                    </div>
                    {domainStats.length > 14 && (
                      <details className="mt-2" open={!!selectedDomain && domainStats.slice(14).some(d => d.enforcementDomain === selectedDomain)}>
                        <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-600 select-none list-none [&::-webkit-details-marker]:hidden pl-3">
                          +{domainStats.length - 14} 个领域
                        </summary>
                        <div className="flex gap-2 flex-wrap mt-2">
                          {domainStats.slice(14).map(d => (
                            <Link
                              key={d.enforcementDomain}
                              href={buildQuery({ domain: selectedDomain === d.enforcementDomain! ? '' : d.enforcementDomain! })}
                              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                selectedDomain === d.enforcementDomain
                                  ? 'bg-slate-800 text-white shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {d.enforcementDomain}
                              <span className="ml-1 opacity-50">{d._count.id}</span>
                            </Link>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* 法规位阶筛选 */}
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-slate-400 w-12 shrink-0 pt-1.5">位阶</span>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 flex-wrap">
                    {['法律', '行政法规', '部门规章', '地方性法规', '地方政府规章'].map(ll => (
                      <Link
                        key={ll}
                        href={buildQuery({ lawLevel: selectedLawLevel === ll ? '' : ll })}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          selectedLawLevel === ll
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {ll}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* 关联状态筛选 */}
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-slate-400 w-12 shrink-0 pt-1.5">关联</span>
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { key: 'yes', label: '已关联' },
                      { key: 'no', label: '未关联' },
                    ].map(opt => (
                      <Link
                        key={opt.key}
                        href={buildQuery({ linked: selectedLinked === opt.key ? '' : opt.key, citation: '' })}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          selectedLinked === opt.key
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </Link>
                    ))}
                    <span className="text-slate-200 self-center">|</span>
                    {[
                      { key: 'single', label: '单法规' },
                      { key: 'multi', label: '多法规' },
                      { key: 'none', label: '无引用' },
                    ].map(opt => (
                      <Link
                        key={opt.key}
                        href={buildQuery({ citation: selectedCitation === opt.key ? '' : opt.key, linked: '' })}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          selectedCitation === opt.key
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </HoverDetails>
        </div>
      </div>
        );
      })()}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-6 sm:pb-8">
        {/* 分析页透视筛选标签 */}
        {analyticsFilters.length > 0 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">当前筛选:</span>
            {analyticsFilters.map(f => (
              <span key={f.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {f.label}
                <Link href={f.clearHref} className="text-blue-400 hover:text-blue-600 ml-0.5">×</Link>
              </span>
            ))}
            <Link href="/enforcement" className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 ml-2">
              清除全部
            </Link>
          </div>
        )}
        {/* 统计卡片 */}
        <div className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {categoryStats.slice(0, 4).map(stat => {
              const color = getCategoryColor(stat.category);
              return (
                <Link
                  key={stat.category}
                  href={buildQuery({ category: selectedCategory === stat.category ? '' : stat.category })}
                  className={`group relative rounded-xl border p-4 transition-all hover:shadow-md ${
                    selectedCategory === stat.category
                      ? `${color.bg} ${color.border} shadow-sm`
                      : 'bg-white border-slate-200/60 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${color.dot} mb-3`} />
                  <div className="text-3xl font-bold text-slate-900 tabular-nums">{stat._count.id}</div>
                  <div className={`text-sm font-medium mt-1 ${selectedCategory === stat.category ? color.text : 'text-slate-500'}`}>
                    {stat.category}
                  </div>
                </Link>
              );
            })}
          </div>

          {categoryStats.length > 4 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {categoryStats.slice(4).map(stat => {
                const color = getCategoryColor(stat.category);
                return (
                  <Link
                    key={stat.category}
                    href={buildQuery({ category: selectedCategory === stat.category ? '' : stat.category })}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === stat.category
                        ? `${color.bg} ${color.text} border ${color.border}`
                        : 'bg-white text-slate-500 border border-slate-200/60 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                    {stat.category}
                    <span className="text-xs opacity-60">{stat._count.id}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 法规清单视图 */}
        {viewMode === 'laws' ? (
          <div>
            {(() => {
              const levelStats: Record<string, number> = {};
              for (const law of allLinkedLaws) {
                const l = law.level || '未知';
                levelStats[l] = (levelStats[l] || 0) + 1;
              }
              const filteredItemCount = linkedLaws.reduce((sum, l) => sum + l._count.enforcementItems, 0);
              return (
                <div className="flex flex-col gap-2 mb-3 px-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm text-slate-400">
                      {selectedLawLevel ? (
                        <>
                          <span className="font-medium text-slate-600">{selectedLawLevel}</span>：{linkedLaws.length} 部法规，{filteredItemCount} 项事项
                        </>
                      ) : (
                        <>共 <span className="font-medium text-slate-600">{linkedLaws.length}</span> 部法规，关联 <span className="font-medium text-slate-600">{linkedCount}</span> 项执法事项</>
                      )}
                    </div>
                    {selectedLawLevel && (
                      <Link href="/enforcement?view=laws" className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
                        清除筛选
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.entries(levelStats).sort((a, b) => {
                      const ORDER = ['法律', '行政法规', '地方性法规', '部门规章', '地方政府规章'];
                      const ia = ORDER.indexOf(a[0]), ib = ORDER.indexOf(b[0]);
                      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                    }).map(([level, count]) => (
                      <Link
                        key={level}
                        href={selectedLawLevel === level ? '/enforcement?view=laws' : `/enforcement?view=laws&lawLevel=${encodeURIComponent(level)}`}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          selectedLawLevel === level
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {level} <span className="opacity-50">{count}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="bg-white rounded-xl border border-slate-200/60 divide-y divide-slate-100">
              {linkedLaws.map(law => (
                <div key={law.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/law/${law.id}`}
                      className="text-base font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                    >
                      {law.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-400">
                      {law.level && <span>{law.level}</span>}
                      {law.issuingAuthority && (
                        <>
                          <span className="text-slate-200">·</span>
                          <span className="truncate max-w-[300px]">{law.issuingAuthority}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/enforcement?lawId=${law.id}`}
                    className="shrink-0 text-sm text-slate-500"
                  >
                    <span className="font-semibold text-slate-700">{law._count.enforcementItems}</span> 项事项
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/60">
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <p className="text-slate-500 text-base">暂无执法事项数据</p>
              <p className="text-slate-400 text-sm mt-1">请通过 AI 梳理脚本提取或 Excel 导入</p>
              <Link
                href="/enforcement/plan"
                className="inline-block mt-4 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
              >
                查看梳理方案
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 列表头 */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="text-sm text-slate-400">
                {hasFilters ? `${totalCount} 条结果` : `共 ${totalCount} 项`}
                {totalPages > 1 && ` · 第 ${currentPage}/${totalPages} 页`}
              </div>
              <div className="text-sm text-slate-400 flex items-center gap-2">
                <span>关联率 <span className="font-medium text-slate-600">{allCount > 0 ? Math.round(linkedCount / allCount * 100) : 0}%</span></span>
                <span className="text-slate-200">|</span>
                <Link
                  href={buildQuery({ linked: selectedLinked === 'yes' ? '' : 'yes', view: '' })}
                  className={`transition-colors ${selectedLinked === 'yes' ? 'text-blue-600 font-medium' : 'hover:text-slate-600'}`}
                >
                  已关联 {linkedCount}
                </Link>
                <Link
                  href={buildQuery({ linked: selectedLinked === 'no' ? '' : 'no', view: '' })}
                  className={`transition-colors ${selectedLinked === 'no' ? 'text-red-600 font-medium' : 'hover:text-slate-600'}`}
                >
                  未关联 {allCount - linkedCount}
                </Link>
                <span className="text-slate-200">|</span>
                <Link
                  href={viewMode === 'laws' ? '/enforcement' : '/enforcement?view=laws'}
                  className={`transition-colors ${viewMode === 'laws' ? 'text-blue-600 font-medium' : 'hover:text-slate-600'}`}
                >
                  {viewMode === 'laws' ? '返回事项列表' : '查看法规清单'}
                </Link>
              </div>
            </div>

            {/* 事项卡片列表 */}
            <div className="space-y-2">
              {items.map((item) => {
                const color = getCategoryColor(item.category);
                const levels = item.enforcementLevel?.split(',').filter(Boolean) || [];
                const provinceName = PROVINCE_NAMES[item.province] || item.province;
                const onlySubProvincial = levels.length > 0 &&
                  !levels.some(l => ['省级', '各级'].includes(l));
                const isLocal = onlySubProvincial ||
                  (item.law && item.law.level && ['地方性法规', '地方政府规章'].includes(item.law.level));
                const scope = isLocal ? provinceName : '通用';

                return (
                  <div
                    key={item.id}
                    className="group bg-white rounded-xl border border-slate-200/60 hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <div className="px-4 sm:px-5 py-3.5 sm:py-4">
                      {/* 第一行：类别标签 + 事项名称 */}
                      <div className="flex items-start gap-3 mb-2">
                        <span className={`inline-flex items-center gap-1.5 shrink-0 mt-0.5 px-2.5 py-1 rounded text-sm font-medium border ${color.bg} ${color.text} ${color.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                          {item.category}
                        </span>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/enforcement/${item.id}`}
                            className="text-base font-semibold text-slate-800 hover:text-blue-600 transition-colors leading-snug"
                          >
                            {item.name}
                          </Link>
                        </div>
                        {/* 状态 */}
                        {item.itemStatus === '生效' && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-green-500 mt-2" title="生效" />
                        )}
                        {item.itemStatus === '暂停' && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2" title="暂停" />
                        )}
                      </div>

                      {/* 第二行：元数据 */}
                      <div className="flex items-center gap-2.5 flex-wrap mt-1">
                        {/* 来源 & 适用范围 */}
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                          {provinceName}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          scope === '通用' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {scope}
                        </span>
                        <span className="text-slate-200">·</span>
                        {/* 执法领域 */}
                        {item.enforcementDomain && (
                          <Link
                            href={buildQuery({ domain: item.enforcementDomain })}
                            className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                          >
                            {item.enforcementDomain}
                          </Link>
                        )}

                        {item.enforcementDomain && (item.enforcementBody || levels.length > 0) && (
                          <span className="text-slate-200">·</span>
                        )}

                        {/* 执法主体 */}
                        {item.enforcementBody && (
                          <Link
                            href={buildQuery({ domain: item.enforcementDomain || '', q: item.enforcementBody })}
                            className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                          >
                            {item.enforcementBody}
                          </Link>
                        )}

                        {item.enforcementBody && levels.length > 0 && (
                          <span className="text-slate-200">·</span>
                        )}

                        {/* 层级标签 */}
                        {levels.length > 0 && (
                          <div className="flex gap-1">
                            {levels.map(level => (
                              <span
                                key={level}
                                className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[level] || 'bg-slate-100 text-slate-500'}`}
                              >
                                {level}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 来源法规 */}
                        {item.law ? (
                          <>
                            <span className="text-slate-200">·</span>
                            <Link
                              href={`/law/${item.law.id}`}
                              className="text-sm text-blue-500/70 hover:text-blue-600 truncate max-w-[240px] sm:max-w-[360px]"
                            >
                              {item.law.title}
                            </Link>
                          </>
                        ) : item.legalBasisText ? (() => {
                          const match = item.legalBasisText!.match(/《([^》]+)》/);
                          return match ? (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="text-sm text-orange-500 truncate max-w-[240px] sm:max-w-[360px]" title="数据库中暂无此法规，待导入后关联">
                                {match[1]}（待关联）
                              </span>
                            </>
                          ) : null;
                        })() : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              buildHref={(page) => buildQuery({ page: String(page) })}
            />
          </>
        )}
      </section>
    </div>
  );
}
