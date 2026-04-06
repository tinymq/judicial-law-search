import Link from 'next/link';
import { prisma } from '@/src/lib/db';
import SiteHeader from '@/components/SiteHeader';
import ThemeToggle from '@/components/ThemeToggle';
import ViolationCardFull from '@/src/components/violations/ViolationCardFull';
import ExpandCollapseAll from '@/src/components/violations/ExpandCollapseAll';
import type { Metadata } from 'next';
import '../app-styles.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '违法行为查询 - 可为法规随手查',
};

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = params.q || '';
  const selectedCategory = params.category || '';

  // 违法行为嵌套过滤条件：匹配描述或编号
  const violationFilter = query
    ? { OR: [{ description: { contains: query } }, { code: { contains: query } }] }
    : {};

  // 法规级别过滤条件（类别筛选）
  const lawCategoryFilter = selectedCategory ? { category: selectedCategory } : {};

  // 查询有违法行为的法规按类别统计（用于侧边栏）
  const categoryCounts = await prisma.law.groupBy({
    by: ['category'],
    _count: { id: true },
    where: {
      OR: [
        { violationBasisViolations: { some: {} } },
        { punishmentBasisViolations: { some: {} } },
      ],
    },
    orderBy: { category: 'asc' },
  });
  categoryCounts.sort((a, b) => b._count.id - a._count.id);

  // 查询法规 + 违法行为
  let lawsWithViolations;

  const hasViolationsCondition = {
    OR: [
      { violationBasisViolations: { some: {} } },
      { punishmentBasisViolations: { some: {} } },
    ],
  };

  if (query) {
    // 先查法规名称匹配的（显示全部违法行为）
    const titleMatchedLaws = await prisma.law.findMany({
      where: {
        ...lawCategoryFilter,
        title: { contains: query },
        ...hasViolationsCondition,
      },
      select: lawSelect({}),
      orderBy: { title: 'asc' },
    });

    // 再查违法行为描述/编号匹配的（排除已被法规名称匹配的）
    const titleMatchedIds = new Set(titleMatchedLaws.map(l => l.id));
    const violationMatchedLaws = await prisma.law.findMany({
      where: {
        ...lawCategoryFilter,
        ...(titleMatchedIds.size > 0 ? { id: { notIn: [...titleMatchedIds] } } : {}),
        OR: [
          { violationBasisViolations: { some: violationFilter } },
          { punishmentBasisViolations: { some: violationFilter } },
        ],
      },
      select: lawSelect(violationFilter),
      orderBy: { title: 'asc' },
    });

    lawsWithViolations = [...titleMatchedLaws, ...violationMatchedLaws];
  } else {
    lawsWithViolations = await prisma.law.findMany({
      where: {
        ...lawCategoryFilter,
        ...hasViolationsCondition,
      },
      select: lawSelect({}),
      orderBy: { title: 'asc' },
    });
  }

  // 格式化条款引用
  const formatRef = (article: any, paragraph: any, item: any) => {
    if (!article) return '';
    let text = `第${article.title}条`;
    if (paragraph) text += `第${paragraph.number}款`;
    if (item) text += `第${item.number}项`;
    return text;
  };

  const getArticleContent = (article: any, paragraph: any, item: any) => {
    if (!article) return '';
    if (item) return item.content || '';
    if (paragraph) return paragraph.content || '';
    if (!article.paragraphs?.length) return '';
    return article.paragraphs.map((p: any) => {
      let text = p.content || '';
      if (p.items?.length) text += '\n' + p.items.map((i: any) => `${i.number} ${i.content}`).join('\n');
      return text;
    }).filter(Boolean).join('\n');
  };

  // 合并每个法规的违法行为（去重）
  const lawGroups = lawsWithViolations.map(law => {
    const seen = new Set<number>();
    const allViolations = [...law.violationBasisViolations, ...law.punishmentBasisViolations];
    const merged = allViolations.filter(v => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    }).map(v => ({
      id: v.id,
      code: v.code,
      description: v.description,
      violationBasis: v.violationBasisArticle ? {
        ref: formatRef(v.violationBasisArticle, v.violationBasisParagraph, v.violationBasisItem),
        content: getArticleContent(v.violationBasisArticle, v.violationBasisParagraph, v.violationBasisItem),
      } : null,
      punishmentBasis: v.punishmentBasisArticle ? {
        ref: formatRef(v.punishmentBasisArticle, v.punishmentBasisParagraph, v.punishmentBasisItem),
        content: getArticleContent(v.punishmentBasisArticle, v.punishmentBasisParagraph, v.punishmentBasisItem),
      } : null,
    }));

    return { law, violations: merged };
  }).filter(g => g.violations.length > 0);

  const totalViolations = lawGroups.reduce((sum, g) => sum + g.violations.length, 0);

  // 构建保留参数的 URL 辅助函数
  const buildUrl = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    if (query && !('q' in overrides)) p.set('q', query);
    if (selectedCategory && !('category' in overrides)) p.set('category', selectedCategory);
    Object.entries(overrides).forEach(([k, v]) => { if (v) p.set(k, v); });
    const qs = p.toString();
    return `/violations${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
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
              placeholder="搜索违法行为描述、编号或法规名称..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all outline-none"
            />
            {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
          </form>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link href="/violations/legacy" className="text-xs text-slate-400 hover:text-slate-600 transition-colors hidden sm:inline">
              旧版页面
            </Link>
            <Link href="/admin/violations" target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              后台管理
            </Link>
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
              placeholder="搜索违法行为..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all outline-none"
            />
            {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
          </div>
        </form>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex gap-6">
        {/* 左侧导航 */}
        <aside className="w-64 shrink-0 hidden lg:block h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
          {/* 类别筛选 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
            <div className="text-sm font-bold text-slate-800 mb-3">按类别筛选</div>
            <div className="space-y-0.5">
              <Link
                href={buildUrl({ category: '' })}
                className={`block px-2 py-1.5 text-xs rounded transition-colors ${!selectedCategory ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                全部类别
              </Link>
              {categoryCounts.map(c => (
                <Link
                  key={c.category}
                  href={buildUrl({ category: c.category })}
                  className={`block px-2 py-1.5 text-xs rounded transition-colors truncate ${selectedCategory === c.category ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {c.category} <span className="text-slate-400">{c._count.id}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* 法规导航 */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-sm font-bold text-slate-800 mb-3">
              法规导航 <span className="text-slate-400 font-normal">({lawGroups.length}部 / {totalViolations}条)</span>
            </div>
            <div className="space-y-1">
              {lawGroups.map(g => (
                <a
                  key={g.law.id}
                  href={`#law-${g.law.id}`}
                  className="block px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded transition-colors truncate"
                  title={g.law.title}
                >
                  <span className="text-slate-400 mr-1">{g.violations.length}</span>
                  {g.law.title.replace(/\(.*?\)$/, '')}
                </a>
              ))}
            </div>
          </div>
        </aside>

        {/* 右侧主内容 */}
        <main className="flex-1 min-w-0">
          {/* 筛选状态 */}
          <div className="mb-4 flex items-center gap-2 text-sm flex-wrap">
            <span className="text-slate-500">共 {lawGroups.length} 部法规，{totalViolations} 条违法行为</span>
            {lawGroups.length > 0 && <ExpandCollapseAll />}
            {selectedCategory && (
              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                {selectedCategory}
                <Link href={buildUrl({ category: '' })} className="hover:text-blue-900">x</Link>
              </span>
            )}
            {query && <span className="text-blue-600">搜索: {query}</span>}
            {(selectedCategory || query) && (
              <Link href="/violations" className="text-slate-400 hover:text-slate-600 text-xs underline ml-auto">重置</Link>
            )}
          </div>

          <div className="space-y-6">
            {lawGroups.map(g => (
              <div key={g.law.id} id={`law-${g.law.id}`} className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-3">
                  <Link href={`/law/${g.law.id}`} className="text-lg font-bold text-slate-900 hover:text-blue-600 transition-colors">
                    {g.law.title}
                  </Link>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{g.violations.length} 条</span>
                  {g.law.documentNumber && (
                    <span className="text-xs text-slate-400">{g.law.documentNumber}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {g.violations.map(v => (
                    <ViolationCardFull key={v.id} violation={v} query={query} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {lawGroups.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              {query ? `未找到包含"${query}"的违法行为` : '暂无违法行为数据'}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// 提取法规查询的 select 结构，避免重复
function lawSelect(violationWhere: any) {
  const violationSelect = {
    id: true,
    code: true,
    description: true,
    violationBasisArticle: {
      select: {
        title: true,
        paragraphs: {
          orderBy: { order: 'asc' as const },
          select: { number: true, content: true, items: { orderBy: { order: 'asc' as const }, select: { number: true, content: true } } }
        }
      }
    },
    violationBasisParagraph: { select: { number: true, content: true } },
    violationBasisItem: { select: { number: true, content: true } },
    punishmentBasisArticle: {
      select: {
        title: true,
        paragraphs: {
          orderBy: { order: 'asc' as const },
          select: { number: true, content: true, items: { orderBy: { order: 'asc' as const }, select: { number: true, content: true } } }
        }
      }
    },
    punishmentBasisParagraph: { select: { number: true, content: true } },
    punishmentBasisItem: { select: { number: true, content: true } },
  };

  return {
    id: true,
    title: true,
    documentNumber: true,
    level: true,
    status: true,
    effectiveDate: true,
    category: true,
    violationBasisViolations: {
      where: violationWhere,
      select: violationSelect,
      orderBy: { code: 'asc' as const },
    },
    punishmentBasisViolations: {
      where: violationWhere,
      select: violationSelect,
      orderBy: { code: 'asc' as const },
    },
  };
}
