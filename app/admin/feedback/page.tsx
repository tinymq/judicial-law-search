import { prisma } from '@/src/lib/db';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ThemeToggle from '@/components/ThemeToggle';
import type { Metadata } from 'next';
import { ADMIN_CONFIG } from '../admin-config';
import { FEEDBACK_ISSUE_TYPES, FEEDBACK_STATUS_OPTIONS } from '@/src/lib/feedback-config';
import FeedbackTable from './FeedbackTable';
import '../admin-styles.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '反馈管理',
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; issueType?: string; page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const selectedStatus = params.status || '';
  const selectedIssueType = params.issueType || '';
  const pageSize = [20, 50, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 20;
  const currentPage = Math.max(1, parseInt(params.page || '1'));

  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) urlParams.set(key, value);
  });
  const theme = ADMIN_CONFIG.getTheme(urlParams);
  const isOptimized = ADMIN_CONFIG.isOptimized(theme);
  const themeClass = isOptimized ? 'admin-optimized' : '';

  const where: any = {};
  if (selectedStatus && FEEDBACK_STATUS_OPTIONS.includes(selectedStatus as any)) {
    where.status = selectedStatus;
  }
  if (selectedIssueType && FEEDBACK_ISSUE_TYPES.includes(selectedIssueType as any)) {
    where.issueType = selectedIssueType;
  }

  const [feedbacks, totalCount, pendingCount, processingCount, resolvedCount, ignoredCount] = await Promise.all([
    prisma.lawFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lawFeedback.count({ where }),
    prisma.lawFeedback.count({ where: { status: '待处理' } }),
    prisma.lawFeedback.count({ where: { status: '处理中' } }),
    prisma.lawFeedback.count({ where: { status: '已解决' } }),
    prisma.lawFeedback.count({ where: { status: '已忽略' } }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const statusStats = [
    { label: '待处理', count: pendingCount, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { label: '处理中', count: processingCount, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { label: '已解决', count: resolvedCount, color: 'text-green-600 bg-green-50 border-green-200' },
    { label: '已忽略', count: ignoredCount, color: 'text-slate-500 bg-slate-50 border-slate-200' },
  ];

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (selectedStatus) p.set('status', selectedStatus);
    if (selectedIssueType) p.set('issueType', selectedIssueType);
    p.set('pageSize', String(pageSize));
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) p.set(k, v); else p.delete(k);
    });
    if (!overrides.page) p.delete('page');
    return `/admin/feedback?${p.toString()}`;
  }

  return (
    <div className={`min-h-screen bg-slate-100 font-sans text-slate-900 ${themeClass}`}>
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <SiteHeader />
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link
              href="/admin/laws"
              className="text-sm font-medium text-slate-600 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              法规管理
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">反馈管理</h1>
          <span className="text-sm text-slate-500">共 {pendingCount + processingCount + resolvedCount + ignoredCount} 条反馈</span>
        </div>

        {/* 状态统计卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {statusStats.map((stat) => (
            <Link
              key={stat.label}
              href={buildUrl({ status: selectedStatus === stat.label ? '' : stat.label, page: '' })}
              className={`border rounded-xl px-4 py-3 text-center transition-all hover:shadow-sm ${stat.color} ${selectedStatus === stat.label ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
            >
              <div className="text-2xl font-bold">{stat.count}</div>
              <div className="text-xs mt-1">{stat.label}</div>
            </Link>
          ))}
        </div>

        {/* 筛选栏 */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500 mr-1">问题类型：</span>
          <Link
            href={buildUrl({ issueType: '', page: '' })}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              !selectedIssueType ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            全部
          </Link>
          {FEEDBACK_ISSUE_TYPES.map((type) => (
            <Link
              key={type}
              href={buildUrl({ issueType: selectedIssueType === type ? '' : type, page: '' })}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                selectedIssueType === type ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {type}
            </Link>
          ))}

          {(selectedStatus || selectedIssueType) && (
            <Link
              href="/admin/feedback"
              className="text-xs text-red-500 hover:text-red-600 ml-auto"
            >
              清除筛选
            </Link>
          )}
        </div>

        {/* 反馈列表 */}
        <FeedbackTable
          feedbacks={feedbacks.map((f) => ({
            ...f,
            createdAt: f.createdAt.toISOString(),
            updatedAt: f.updatedAt.toISOString(),
          }))}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          selectedStatus={selectedStatus}
          selectedIssueType={selectedIssueType}
        />
      </div>
    </div>
  );
}
