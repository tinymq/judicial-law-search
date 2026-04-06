import { prisma } from '@/src/lib/db';
import ViolationTable from './ViolationTable';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import type { Metadata } from 'next';
import { ADMIN_CONFIG } from '../admin-config';
import '../admin-styles.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '违法行为管理',
};

export default async function AdminViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; order?: 'asc' | 'desc' }>;
}) {
  const params = await searchParams;
  const query = params.q || '';
  const sortField = params.sort || 'createdAt';
  const sortOrder = params.order || 'desc';

  // 检测主题（支持通过URL参数切换）
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) urlParams.set(key, value);
  });
  const theme = ADMIN_CONFIG.getTheme(urlParams);
  const isOptimized = ADMIN_CONFIG.isOptimized(theme);
  const themeClass = isOptimized ? 'admin-optimized' : '';

  // 构建查询条件
  const where: any = {};

  if (query) {
    where.OR = [
      { description: { contains: query } },
      { code: { contains: query } },
      { violationBasisLaw: { title: { contains: query } } },
      { punishmentBasisLaw: { title: { contains: query } } },
    ];
  }

  // 查询违法行为列表（包含关联信息）
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
      [sortField]: sortOrder,
    },
  });

  const totalCount = violations.length;

  return (
    <div className={`min-h-screen bg-slate-100 font-sans text-slate-900 ${themeClass}`}>
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
                    placeholder="搜索违法行为描述、法规名称..."
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-md text-sm focus:ring-1 focus:ring-red-500 focus:bg-white transition-all outline-none"
                />
            </form>

            <div className="flex items-center gap-3">
                <Link
                    href="/admin/violations/laws"
                    className="text-sm font-semibold text-blue-600 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50 transition-colors flex items-center gap-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                    法规统计
                </Link>
                <Link
                    href="/violations"
                    target="_blank"
                    className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
                >
                    查询页面
                </Link>
                <Link
                    href="/admin/violations/new"
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2 shadow-sm shadow-red-200"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    录入违法行为
                </Link>
            </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 主内容区 */}
        <main className="min-w-0">
            {/* 搜索状态栏 */}
            {query && (
                <div className="mb-4 flex items-center gap-2 text-sm flex-wrap bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <span className="text-slate-500 font-medium">搜索:</span>
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">
                        {query}
                    </span>
                    <Link href="/admin/violations" className="text-slate-400 hover:text-slate-600 text-xs underline ml-auto">清除搜索</Link>
                </div>
            )}

            {/* 结果统计 */}
            <div className="mb-4 text-sm text-slate-500 bg-white p-3 rounded-lg border border-slate-200">
                显示 <span className="font-bold text-slate-700">{violations.length}</span> 条违法行为
            </div>

            {/* 违法行为表格 */}
            <ViolationTable violations={violations} currentSort={sortField} currentOrder={sortOrder} />
        </main>
      </div>
    </div>
  );
}
