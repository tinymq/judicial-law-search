import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ThemeToggle from '@/components/ThemeToggle';
import { prisma } from '@/src/lib/db';
import { extractBasisLawNames } from '@/src/lib/legal-basis-parser';
import type { Metadata } from 'next';
import OverviewCards from './OverviewCards';
import CategoryChart from './CategoryChart';
import DomainChart from './DomainChart';
import LawLevelChart from './LawLevelChart';
import TopLawsTable from './TopLawsTable';
import ReuseChart from './ReuseChart';
import DomainLevelChart from './DomainLevelChart';
import CitationPie from './CitationPie';
import ParentChildByTypeChart from './ParentChildByTypeChart';
import CitationCountChart from './CitationCountChart';
import EfficacyDensityChart from './EfficacyDensityChart';
import LawClusterChart from './LawClusterChart';

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

const LAW_DOMAIN_CLUSTERS = [
  { name: '安全生产', keywords: ['安全生产', '危险化学品', '消防', '特种设备', '矿山安全', '烟花爆竹'] },
  { name: '食品药品', keywords: ['食品安全', '药品', '疫苗', '医疗器械', '化妆品'] },
  { name: '生态环境', keywords: ['大气污染', '水污染', '环境保护', '固体废物', '噪声污染', '土壤污染', '海洋环境', '放射性'] },
  { name: '建设工程', keywords: ['招标投标', '建设工程', '建筑法', '城乡规划', '住房', '房屋'] },
  { name: '交通运输', keywords: ['道路交通', '道路运输', '内河交通', '船员', '航道', '港口', '公路', '铁路', '民用航空', '海上交通'] },
  { name: '农业渔业', keywords: ['渔业', '种子', '农药', '兽药', '动物防疫', '野生动物', '草原', '森林', '农产品'] },
  { name: '市场秩序', keywords: ['反垄断', '反不正当竞争', '广告', '商标', '专利', '价格', '计量', '标准化', '产品质量'] },
  { name: '治安管理', keywords: ['治安管理', '出入境', '枪支', '爆炸物', '禁毒', '保安'] },
  { name: '社会民生', keywords: ['慈善', '宗教', '社会团体', '民办教育', '未成年人', '劳动'] },
];

function classifyLaw(title: string): string {
  for (const cluster of LAW_DOMAIN_CLUSTERS) {
    if (cluster.keywords.some(kw => title.includes(kw))) return cluster.name;
  }
  return '其他领域';
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ province?: string }>;
}) {
  const params = await searchParams;
  const selectedProvince = params.province ?? '';

  const where: any = selectedProvince ? { province: selectedProvince } : {};

  // A: Overview stats
  const totalItems = await prisma.enforcementItem.count({ where: { ...where, parentId: null } });
  const linkedItems = await prisma.enforcementItem.count({ where: { ...where, parentId: null, lawId: { not: null } } });
  const parentCount = await prisma.enforcementItem.count({ where: { ...where, children: { some: {} } } });
  const childCount = await prisma.enforcementItem.count({ where: { ...where, parentId: { not: null } } });
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

  // B2: Parent/child by type (NEW)
  const topByType = await prisma.enforcementItem.groupBy({
    by: ['category'],
    _count: { id: true },
    where: { ...where, parentId: null },
    orderBy: { _count: { id: 'desc' } },
  });
  const childByType = await prisma.enforcementItem.groupBy({
    by: ['category'],
    _count: { id: true },
    where: { ...where, parentId: { not: null } },
    orderBy: { _count: { id: 'desc' } },
  });
  const childByTypeMap = Object.fromEntries(childByType.map(c => [c.category, c._count.id]));
  const parentChildData = topByType.map(t => {
    const top = t._count.id;
    const child = childByTypeMap[t.category] || 0;
    const total = top + child;
    return {
      category: t.category,
      topLevel: top,
      child,
      childRatio: total > 0 ? `${((child / total) * 100).toFixed(1)}%` : '0%',
    };
  });

  // C: Domain/Body distribution
  const domainField = selectedProvince ? 'enforcementBody' : 'enforcementDomain';
  const domainStats = await prisma.enforcementItem.groupBy({
    by: [domainField as any],
    _count: { id: true },
    where: { ...where, [domainField]: { not: null } },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });

  // D: Law level distribution + efficacy density (ENHANCED: include lawId for density calc)
  const itemsWithLaw = await prisma.enforcementItem.findMany({
    where: { ...where, lawId: { not: null } },
    select: { lawId: true, law: { select: { level: true } } },
  });
  const lawLevelMap: Record<string, number> = {};
  const lawsPerLevel: Record<string, Set<number>> = {};
  for (const item of itemsWithLaw) {
    const level = item.law?.level || '未知';
    lawLevelMap[level] = (lawLevelMap[level] || 0) + 1;
    if (!lawsPerLevel[level]) lawsPerLevel[level] = new Set();
    lawsPerLevel[level].add(item.lawId!);
  }
  const lawLevelStats = Object.entries(lawLevelMap)
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => b.count - a.count);

  const densityData = Object.entries(lawLevelMap)
    .map(([level, itemCount]) => ({
      level,
      itemCount,
      lawCount: lawsPerLevel[level]?.size || 0,
      density: lawsPerLevel[level]?.size
        ? Math.round((itemCount / lawsPerLevel[level].size) * 10) / 10
        : 0,
    }))
    .filter(d => d.lawCount > 0)
    .sort((a, b) => b.density - a.density);

  // E: Top referenced laws (all + local)
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

  // E2: Top local laws (NEW)
  const localLevels = ['地方性法规', '地方政府规章'];
  const reuseCounts = await prisma.enforcementItem.groupBy({
    by: ['lawId'],
    _count: { id: true },
    where: { ...where, lawId: { not: null } },
  });
  const allReferencedLawIds = reuseCounts.map(r => r.lawId!);
  const allReferencedLaws = await prisma.law.findMany({
    where: { id: { in: allReferencedLawIds } },
    select: { id: true, title: true, level: true },
  });
  const allLawMap = new Map(allReferencedLaws.map(l => [l.id, l]));
  const reuseWithLaw = reuseCounts.map(r => ({
    lawId: r.lawId!,
    count: r._count.id,
    law: allLawMap.get(r.lawId!),
  }));
  const topLocalLawsData = reuseWithLaw
    .filter(r => r.law && localLevels.includes(r.law.level || ''))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(r => ({
      id: r.lawId,
      title: r.law!.title,
      level: r.law!.level || '未知',
      count: r.count,
    }));

  // F: Reuse distribution
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

  // G: Domain x Law Level cross table + dependency types (ENHANCED)
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
  const crossDataAll = Object.entries(crossMap)
    .map(([domain, levels]) => ({ domain, ...levels, total: Object.values(levels).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);

  const dependencyTypes: Record<string, string> = {};
  for (const d of crossDataAll) {
    const total = d.total;
    if (total < 10) continue;
    const national = ((d['法律'] || 0) + (d['行政法规'] || 0)) / total;
    const departmental = (d['部门规章'] || 0) / total;
    const local = ((d['地方性法规'] || 0) + (d['地方政府规章'] || 0)) / total;
    if (national >= 0.6) dependencyTypes[d.domain] = '高国家法规型';
    else if (departmental >= 0.4) dependencyTypes[d.domain] = '高部门规章型';
    else if (local >= 0.13) dependencyTypes[d.domain] = '高地方法规型';
    else dependencyTypes[d.domain] = '混合型';
  }

  // H: Citation count distribution (ENHANCED: 5 buckets instead of 3)
  const allItemsForCitation = await prisma.enforcementItem.findMany({
    where: { ...where, parentId: null },
    select: { legalBasisText: true },
  });
  let cite1 = 0, cite2 = 0, cite3 = 0, cite4plus = 0, citeNone = 0;
  let singleLaw = 0, multiLaw = 0, noRef = 0;
  for (const item of allItemsForCitation) {
    const text = item.legalBasisText || '';
    if (!text.trim()) { citeNone++; noRef++; continue; }
    const names = extractBasisLawNames(text);
    const count = names.length;
    if (count === 0) { citeNone++; noRef++; }
    else if (count === 1) { cite1++; singleLaw++; }
    else if (count === 2) { cite2++; multiLaw++; }
    else if (count === 3) { cite3++; multiLaw++; }
    else { cite4plus++; multiLaw++; }
  }
  const citationCountData = [
    { label: '1部', count: cite1 },
    { label: '2部', count: cite2 },
    { label: '3部', count: cite3 },
    { label: '4部及以上', count: cite4plus },
    { label: '无引用', count: citeNone },
  ];
  const citationTotal = cite1 + cite2 + cite3 + cite4plus + citeNone;

  // I: Law domain clusters (NEW)
  const clusterAgg: Record<string, { itemCount: number; lawIds: Set<number> }> = {};
  for (const r of reuseWithLaw) {
    if (!r.law) continue;
    const cluster = classifyLaw(r.law.title);
    if (!clusterAgg[cluster]) clusterAgg[cluster] = { itemCount: 0, lawIds: new Set() };
    clusterAgg[cluster].itemCount += r.count;
    clusterAgg[cluster].lawIds.add(r.lawId);
  }
  const lawClusterData = Object.entries(clusterAgg)
    .map(([cluster, agg]) => ({ cluster, itemCount: agg.itemCount, lawCount: agg.lawIds.size }))
    .sort((a, b) => b.itemCount - a.itemCount);

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
          parentCount={parentCount}
          childCount={childCount}
          province={selectedProvince}
        />

        {/* Row 1: Category + ParentChild + LawLevel (3 columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <CategoryChart
            data={categoryStats.map(s => ({ category: s.category, count: s._count.id }))}
            province={selectedProvince}
          />
          <ParentChildByTypeChart
            data={parentChildData}
            province={selectedProvince}
          />
          <LawLevelChart data={lawLevelStats} province={selectedProvince} />
        </div>

        {/* Row 2: Domain + EfficacyDensity (2 columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <DomainChart
            data={domainStats.map((s: any) => ({ name: s[domainField] || '未知', count: s._count.id }))}
            title={selectedProvince ? '执法部门分布 TOP15' : '执法领域分布 TOP15'}
            province={selectedProvince}
            isDomain={!selectedProvince}
          />
          <EfficacyDensityChart data={densityData} province={selectedProvince} />
        </div>

        {/* E: Top referenced laws with local filter (full width) */}
        <div className="mt-6">
          <TopLawsTable
            data={topLawsData}
            localData={topLocalLawsData}
            province={selectedProvince}
          />
        </div>

        {/* Row 3: LawCluster (full width) */}
        <div className="mt-6">
          <LawClusterChart data={lawClusterData} province={selectedProvince} />
        </div>

        {/* Row 4: Reuse + CitationCount (2 columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <ReuseChart data={reuseData} province={selectedProvince} />
          <CitationCountChart data={citationCountData} total={citationTotal} province={selectedProvince} />
        </div>

        {/* Row 5: CitationPie (overview) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <CitationPie singleLaw={singleLaw} multiLaw={multiLaw} noRef={noRef} province={selectedProvince} />
        </div>

        {/* G: Domain x Level with dependency types (full width) */}
        <div className="mt-6">
          <DomainLevelChart
            data={crossDataAll}
            levels={Array.from(new Set(lawLevelStats.map(l => l.level)))}
            title={selectedProvince ? '部门×法规级别' : '领域×法规级别'}
            province={selectedProvince}
            isDomain={!selectedProvince}
            dependencyTypes={selectedProvince ? dependencyTypes : undefined}
          />
        </div>
      </div>
    </div>
  );
}
