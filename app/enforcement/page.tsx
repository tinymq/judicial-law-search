import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ThemeToggle from '@/components/ThemeToggle';
import { prisma } from '@/src/lib/db';
import { ENFORCEMENT_CATEGORIES } from '@/src/lib/industry-config';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '执法事项目录',
};

const PROVINCE_OPTIONS = [
  { code: '000000', label: '全国' },
  { code: '430000', label: '湖南' },
  { code: '460000', label: '海南' },
  { code: '370000', label: '山东' },
  { code: '320000', label: '江苏' },
];

export default async function EnforcementPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; industry?: string; q?: string; province?: string; domain?: string }>;
}) {
  const params = await searchParams;
  const selectedCategory = params.category ?? '';
  const selectedIndustry = params.industry ?? '';
  const selectedProvince = params.province ?? '';
  const selectedDomain = params.domain ?? '';
  const query = params.q ?? '';

  // 构建查询条件
  const where: any = {};
  if (selectedCategory) where.category = selectedCategory;
  if (selectedIndustry) where.industryId = parseInt(selectedIndustry);
  if (selectedProvince) where.province = selectedProvince;
  if (selectedDomain) where.enforcementDomain = selectedDomain;
  if (query) where.name = { contains: query };

  const items = await prisma.enforcementItem.findMany({
    where,
    include: { industry: true, law: { select: { id: true, title: true } } },
    orderBy: [{ sequenceNumber: 'asc' }],
    take: 200,
  });

  const totalCount = await prisma.enforcementItem.count({ where });
  const allCount = await prisma.enforcementItem.count();

  // 获取执法领域统计
  const domainStats = await prisma.enforcementItem.groupBy({
    by: ['enforcementDomain'],
    _count: { id: true },
    where: { enforcementDomain: { not: null } },
    orderBy: { _count: { id: 'desc' } },
  });

  // 构建筛选参数的辅助函数
  function buildQuery(overrides: Record<string, string>) {
    const p: Record<string, string> = {};
    if (selectedCategory) p.category = selectedCategory;
    if (selectedIndustry) p.industry = selectedIndustry;
    if (selectedProvince) p.province = selectedProvince;
    if (selectedDomain) p.domain = selectedDomain;
    if (query) p.q = query;
    Object.assign(p, overrides);
    // 移除空值
    for (const k of Object.keys(p)) {
      if (!p[k]) delete p[k];
    }
    const qs = new URLSearchParams(p).toString();
    return qs ? `/enforcement?${qs}` : '/enforcement';
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <SiteHeader />
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              法规检索
            </Link>
            <Link href="/enforcement" className="text-sm font-medium text-blue-600 hidden sm:inline">
              执法事项
            </Link>
            <Link href="/enforcement/plan" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              梳理方案
            </Link>
            <Link href="/admin/laws" target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              后台管理
            </Link>
            <ThemeToggle variant="app" className="ml-1 sm:ml-4" />
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 mb-2">执法事项目录</h1>
          <p className="text-sm text-slate-500">
            共 {allCount} 项执法事项
            {totalCount !== allCount && `（当前筛选 ${totalCount} 项）`}
            {allCount === 0 && '（暂无数据）'}
          </p>
        </div>

        {/* 筛选区域 */}
        <div className="space-y-3 mb-6">
          {/* 搜索框 */}
          <form className="max-w-md relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="搜索执法事项..."
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
            />
            {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
            {selectedIndustry && <input type="hidden" name="industry" value={selectedIndustry} />}
            {selectedProvince && <input type="hidden" name="province" value={selectedProvince} />}
            {selectedDomain && <input type="hidden" name="domain" value={selectedDomain} />}
          </form>

          {/* 省份筛选 */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-slate-400 mr-1">省份：</span>
            <Link
              href={buildQuery({ province: '' })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                !selectedProvince ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              全部
            </Link>
            {PROVINCE_OPTIONS.map(p => (
              <Link
                key={p.code}
                href={buildQuery({ province: selectedProvince === p.code ? '' : p.code })}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedProvince === p.code
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>

          {/* 执法类别筛选 */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-slate-400 mr-1">类别：</span>
            {ENFORCEMENT_CATEGORIES.slice(0, 4).map(cat => (
              <Link
                key={cat}
                href={buildQuery({ category: selectedCategory === cat ? '' : cat })}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </Link>
            ))}
          </div>

          {/* 执法领域筛选 */}
          {domainStats.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-slate-400 mr-1">领域：</span>
              {domainStats.slice(0, 10).map(d => (
                <Link
                  key={d.enforcementDomain}
                  href={buildQuery({ domain: selectedDomain === d.enforcementDomain! ? '' : d.enforcementDomain! })}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedDomain === d.enforcementDomain
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {d.enforcementDomain} ({d._count.id})
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 执法事项列表 */}
        {items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="text-center py-20">
              <p className="text-slate-400 text-base">暂无执法事项数据</p>
              <p className="text-slate-300 text-sm mt-2">请通过 AI 梳理脚本提取或管理后台导入</p>
              <Link
                href="/enforcement/plan"
                className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                查看 AI 梳理方案
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-3 font-medium text-slate-600 w-[140px] whitespace-nowrap">编码</th>
                  <th className="text-left px-3 py-3 font-medium text-slate-600">事项名称</th>
                  <th className="text-left px-3 py-3 font-medium text-slate-600 w-20">类别</th>
                  <th className="text-left px-3 py-3 font-medium text-slate-600 w-24 hidden lg:table-cell">执法领域</th>
                  <th className="text-left px-3 py-3 font-medium text-slate-600 w-20 hidden md:table-cell">层级</th>
                  <th className="text-left px-3 py-3 font-medium text-slate-600 w-32 hidden lg:table-cell">执法主体</th>
                  <th className="text-left px-3 py-3 font-medium text-slate-600 w-16">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 text-slate-400 font-mono text-xs">{item.code || '-'}</td>
                    <td className="px-3 py-3 text-slate-900 font-medium">
                      {item.law ? (
                        <Link href={`/law/${item.law.id}`} className="hover:text-blue-600 transition-colors" title={`来源：${item.law.title}`}>
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-xs hidden lg:table-cell">{item.enforcementDomain || '-'}</td>
                    <td className="px-3 py-3 text-slate-500 text-xs hidden md:table-cell">{item.enforcementLevel || '-'}</td>
                    <td className="px-3 py-3 text-slate-500 text-xs hidden lg:table-cell">{item.enforcementBody || '-'}</td>
                    <td className="px-3 py-3">
                      {item.itemStatus === '生效' ? (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-green-50 text-green-700 border border-green-100">生效</span>
                      ) : item.itemStatus === '暂停' ? (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700 border border-yellow-100">暂停</span>
                      ) : (
                        <span className="text-slate-300 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalCount > 200 && (
              <div className="text-center py-3 text-xs text-slate-400 border-t border-slate-100">
                显示前 200 项，共 {totalCount} 项
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
