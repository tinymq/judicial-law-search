import { getLawsWithViolationStats } from '../../actions';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import StatusBadge from '@/src/components/violations/StatusBadge';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '已梳理法规列表',
};

export default async function ViolationLawsPage() {
  const laws = await getLawsWithViolationStats();

  // 统计数据
  const totalLaws = laws.length;
  const totalComplete = laws.filter(l => l.statusType === 'complete').length;
  const totalPartial = laws.filter(l => l.statusType === 'partial').length;
  const totalEmpty = laws.filter(l => l.statusType === 'empty').length;
  const totalViolations = laws.reduce((sum, l) => sum + l.violationBasisCount + l.punishmentBasisCount, 0);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <SiteHeader />
          <div className="text-base font-bold text-slate-800">已梳理法规列表</div>
          <Link
            href="/admin/violations"
            className="text-sm font-semibold text-blue-600 border border-blue-200 px-3 py-1.5 rounded hover:bg-blue-50"
          >
            ← 返回违法行为列表
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500 mb-1">法规总数</div>
            <div className="text-2xl font-bold text-slate-800">{totalLaws}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500 mb-1">已拆解</div>
            <div className="text-2xl font-bold text-green-600">{totalComplete}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500 mb-1">部分拆解</div>
            <div className="text-2xl font-bold text-yellow-600">{totalPartial}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-sm text-slate-500 mb-1">未拆解</div>
            <div className="text-2xl font-bold text-slate-400">{totalEmpty}</div>
          </div>
        </div>

        {/* 总体统计 */}
        <div className="mb-4 text-sm text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
          显示 <span className="font-bold text-slate-700">{totalLaws}</span> 部法规，
          共关联 <span className="font-bold text-slate-700">{totalViolations}</span> 条违法行为
        </div>

        {/* 表格 */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">法规名称</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">违法依据</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">处罚依据</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">状态</th>
                  <th className="px-4 py-3 text-left font-bold text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {laws.map((law) => (
                  <tr key={law.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <Link
                          href={`/law/${law.id}`}
                          target="_blank"
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {law.title}
                        </Link>
                        <div className="text-xs text-slate-400 mt-1">{law.level}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {law.violationBasisCount > 0 ? (
                        <span className="text-blue-600 font-semibold">{law.violationBasisCount}条</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {law.punishmentBasisCount > 0 ? (
                        <span className="text-orange-600 font-semibold">{law.punishmentBasisCount}条</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={law.statusType} />
                    </td>
                    <td className="px-4 py-3">
                      {law.statusType !== 'empty' ? (
                        <Link
                          href={`/law/${law.id}#violations`}
                          target="_blank"
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          查看违法行为 →
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/violations/new`}
                          className="text-green-600 hover:text-green-800 font-medium text-sm"
                        >
                          去拆解 →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 空状态 */}
          {laws.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-slate-600">暂无法规数据</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
