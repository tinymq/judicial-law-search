import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ThemeToggle from '@/components/ThemeToggle';
import { prisma } from '@/src/lib/db';
import type { Metadata } from 'next';
import OverviewCards from './OverviewCards';
import CategoryChart from './CategoryChart';
import DomainChart from './DomainChart';
import LawLevelChart from './LawLevelChart';
import TopLawsTable from './TopLawsTable';
import ReuseChart from './ReuseChart';
import DomainLevelChart from './DomainLevelChart';
import CitationPie from './CitationPie';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '执法数据分析 - 执法监督法规查',
};

const PROVINCE_OPTIONS = [
  { code: '', label: '全部省份' },
  { code: '330000', label: '浙江' },
  { code: '430000', label: '湖南' },
  { code: '460000', label: '海南' },
  { code: '370000', label: '山东' },
  { code: '320000', label: '江苏' },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ province?: string }>;
}) {
  const params = await searchParams;
  const selectedProvince = params.province ?? '';

  const where: any = selectedProvince ? { province: selectedProvince } : {};

  // A: Overview stats
  const totalItems = await prisma.enforcementItem.count({ where });
  const linkedItems = await prisma.enforcementItem.count({ where: { ...where, lawId: { not: null } } });
  const distinctLaws = await prisma.enforcementItem.groupBy({
    by: ['lawId'],
    where: { ...where, lawId: { not: null } },
  });
  const totalLaws = await prisma.law.count();

  // B: Category distribution
  const categoryStats = await prisma.enforcementItem.groupBy({
    by: ['category'],
    _count: { id: true },
    where,
    orderBy: { _count: { id: 'desc' } },
  });

  // C: Domain/Body distribution (auto-switch based on province)
  const domainField = selectedProvince ? 'enforcementBody' : 'enforcementDomain';
  const domainStats = await prisma.enforcementItem.groupBy({
    by: [domainField as any],
    _count: { id: true },
    where: { ...where, [domainField]: { not: null } },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });

  // D: Law level distribution (join through lawId)
  const itemsWithLaw = await prisma.enforcementItem.findMany({
    where: { ...where, lawId: { not: null } },
    select: { law: { select: { level: true } } },
  });
  const lawLevelMap: Record<string, number> = {};
  for (const item of itemsWithLaw) {
    const level = item.law?.level || '未知';
    lawLevelMap[level] = (lawLevelMap[level] || 0) + 1;
  }
  const lawLevelStats = Object.entries(lawLevelMap)
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => b.count - a.count);

  // E: Top referenced laws
  const topLaws = await prisma.enforcementItem.groupBy({
    by: ['lawId'],
    _count: { id: true },
    where: { ...where, lawId: { not: null } },
    orderBy: { _count: { id: 'desc' } },
    take: 20,
  });
  const topLawIds = topLaws.map(t => t.lawId!);
  const topLawDetails = await prisma.law.findMany({
    where: { id: { in: topLawIds } },
    select: { id: true, title: true, level: true },
  });
  const topLawsData = topLaws.map(t => {
    const law = topLawDetails.find(l => l.id === t.lawId);
    return { id: t.lawId!, title: law?.title || '未知', level: law?.level || '未知', count: t._count.id };
  });

  // F: Reuse distribution (how many items reference each law)
  const reuseCounts = await prisma.enforcementItem.groupBy({
    by: ['lawId'],
    _count: { id: true },
    where: { ...where, lawId: { not: null } },
  });
  const buckets = [
    { label: '1条', min: 1, max: 1 },
    { label: '2-5条', min: 2, max: 5 },
    { label: '6-10条', min: 6, max: 10 },
    { label: '11-20条', min: 11, max: 20 },
    { label: '21-50条', min: 21, max: 50 },
    { label: '50条以上', min: 51, max: Infinity },
  ];
  const reuseData = buckets.map(b => ({
    label: b.label,
    count: reuseCounts.filter(r => r._count.id >= b.min && r._count.id <= b.max).length,
    min: b.min,
    max: b.max === Infinity ? 9999 : b.max,
  }));

  // G: Domain x Law Level cross table
  const crossItems = await prisma.enforcementItem.findMany({
    where: { ...where, lawId: { not: null }, [domainField]: { not: null } },
    select: { [domainField]: true, law: { select: { level: true } } } as any,
  });
  const crossMap: Record<string, Record<string, number>> = {};
  for (const item of crossItems as any[]) {
    const domain = item[domainField];
    const level = item.law?.level || '未知';
    if (!domain) continue;
    if (!crossMap[domain]) crossMap[domain] = {};
    crossMap[domain][level] = (crossMap[domain][level] || 0) + 1;
  }
  // All domains sorted by total count
  const crossDataAll = Object.entries(crossMap)
    .map(([domain, levels]) => ({ domain, ...levels, total: Object.values(levels).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);

  // H: Single vs multi law citation
  const allItemsForCitation = await prisma.enforcementItem.findMany({
    where: { ...where, legalBasisText: { not: null } },
    select: { legalBasisText: true },
  });
  let singleLaw = 0, multiLaw = 0, noRef = 0;
  for (const item of allItemsForCitation) {
    const text = item.legalBasisText || '';
    const matches = text.match(/《[^》]+》/g);
    if (!matches || matches.length === 0) noRef++;
    else if (matches.length === 1) singleLaw++;
    else multiLaw++;
  }

  const provinceName = PROVINCE_OPTIONS.find(p => p.code === selectedProvince)?.label || '全部省份';

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary,#faf8f5)] font-sans text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <SiteHeader />
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              法规检索
            </Link>
            <Link href="/enforcement" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              执法事项
            </Link>
            <Link href="/enforcement/analytics" className="text-sm font-semibold text-slate-900 hidden sm:inline">
              数据分析
            </Link>
            <Link href="/admin/laws" target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              后台管理
            </Link>
            <ThemeToggle variant="app" className="ml-1 sm:ml-2" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page title + province switcher */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">执法数据分析</h1>
            <p className="text-sm text-slate-500 mt-1">
              基于 {provinceName} 执法事项数据的多维度统计分析
            </p>
          </div>
          <div className="flex items-center gap-2">
            {PROVINCE_OPTIONS.map(p => (
              <Link
                key={p.code}
                href={p.code ? `/enforcement/analytics?province=${p.code}` : '/enforcement/analytics'}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedProvince === p.code
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        {/* A: Overview Cards */}
        <OverviewCards
          totalItems={totalItems}
          linkedItems={linkedItems}
          distinctLawCount={distinctLaws.length}
          totalLaws={totalLaws}
          province={selectedProvince}
        />

        {/* Row 1: B + C + D (3 columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <CategoryChart
            data={categoryStats.map(s => ({ category: s.category, count: s._count.id }))}
            province={selectedProvince}
          />
          <DomainChart
            data={domainStats.map((s: any) => ({ name: s[domainField] || '未知', count: s._count.id }))}
            title={selectedProvince ? '执法部门分布 TOP15' : '执法领域分布 TOP15'}
            province={selectedProvince}
            isDomain={!selectedProvince}
          />
          <LawLevelChart data={lawLevelStats} province={selectedProvince} />
        </div>

        {/* E: Top referenced laws (full width) */}
        <div className="mt-6">
          <TopLawsTable data={topLawsData} province={selectedProvince} />
        </div>

        {/* Row 2: F + H (2 columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <ReuseChart data={reuseData} province={selectedProvince} />
          <CitationPie singleLaw={singleLaw} multiLaw={multiLaw} noRef={noRef} province={selectedProvince} />
        </div>

        {/* G: Domain x Level (full width) */}
        <div className="mt-6">
          <DomainLevelChart
            data={crossDataAll}
            levels={Array.from(new Set(lawLevelStats.map(l => l.level)))}
            title={selectedProvince ? '部门×法规级别' : '领域×法规级别'}
            province={selectedProvince}
            isDomain={!selectedProvince}
          />
        </div>
      </div>
    </div>
  );
}
