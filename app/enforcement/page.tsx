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

export default async function EnforcementPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; industry?: string; q?: string }>;
}) {
  const params = await searchParams;
  const selectedCategory = params.category ?? '';
  const selectedIndustry = params.industry ?? '';
  const query = params.q ?? '';

  // 查询执法事项
  const where: any = {};
  if (selectedCategory) where.category = selectedCategory;
  if (selectedIndustry) where.industryId = parseInt(selectedIndustry);
  if (query) where.name = { contains: query };

  const items = await prisma.enforcementItem.findMany({
    where,
    include: { industry: true },
    orderBy: [{ sequenceNumber: 'asc' }],
    take: 100,
  });

  const totalCount = await prisma.enforcementItem.count();

  // 获取行业统计（有执法事项的行业）
  const industries = await prisma.industry.findMany({
    where: { enforcementItems: { some: {} } },
    select: { id: true, name: true, _count: { select: { enforcementItems: true } } },
    orderBy: { order: 'asc' },
  });

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
            共 {totalCount} 项执法事项
            {totalCount === 0 && '（暂无数据，请通过管理后台导入）'}
          </p>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-wrap gap-3 mb-6">
          <form className="flex-1 min-w-[200px] max-w-md relative">
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
          </form>

          {/* 执法类别筛选 */}
          <div className="flex flex-wrap gap-1.5">
            {ENFORCEMENT_CATEGORIES.map(cat => (
              <Link
                key={cat}
                href={`/enforcement?${selectedCategory === cat ? '' : `category=${cat}`}${selectedIndustry ? `&industry=${selectedIndustry}` : ''}${query ? `&q=${query}` : ''}`}
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
        </div>

        {/* 执法事项列表 */}
        {items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="text-center py-20">
              <p className="text-slate-400 text-base">暂无执法事项数据</p>
              <p className="text-slate-300 text-sm mt-2">请通过管理后台导入执法事项目录</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-16">序号</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">事项名称</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-24">执法类别</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-32">行业</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 w-32">执法主体</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500">{item.sequenceNumber}</td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.industry?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{item.enforcementBody || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
