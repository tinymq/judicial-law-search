'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  checkItemsTotal: number;
  itemsWithStandards: number;
  totalStandards: number;
  avgPerItem: number;
  distribution: { label: string; count: number }[];
  domainData: { domain: string; total: number; withStandards: number; avgStandards: number }[];
  province: string;
}

const DIST_COLORS = ['#94a3b8', '#64748b', '#6366f1', '#7c3aed', '#a855f7'];

export default function InspectionStandardsSection({
  checkItemsTotal, itemsWithStandards, totalStandards, avgPerItem,
  distribution, domainData, province,
}: Props) {
  if (checkItemsTotal === 0 || totalStandards === 0) return null;

  const coverageRate = ((itemsWithStandards / checkItemsTotal) * 100).toFixed(1);
  const distTotal = distribution.reduce((s, d) => s + d.count, 0);
  const domainLabel = province ? '部门' : '领域';

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-800">检查标准分析</h3>
        <p className="text-xs text-slate-400 mt-0.5">行政检查事项的结构化检查要点覆盖与分布</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-500">行政检查事项</div>
          <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">{checkItemsTotal.toLocaleString()}</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="text-xs text-emerald-600">有检查标准</div>
          <div className="text-xl font-bold text-emerald-700 tabular-nums mt-1">{itemsWithStandards.toLocaleString()}</div>
          <div className="text-xs text-emerald-500 mt-0.5">覆盖率 {coverageRate}%</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-xs text-blue-600">标准总条数</div>
          <div className="text-xl font-bold text-blue-700 tabular-nums mt-1">{totalStandards.toLocaleString()}</div>
        </div>
        <div className="bg-violet-50 rounded-lg p-3">
          <div className="text-xs text-violet-600">每事项平均</div>
          <div className="text-xl font-bold text-violet-700 tabular-nums mt-1">{avgPerItem.toFixed(1)}</div>
          <div className="text-xs text-violet-500 mt-0.5">条标准</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">每事项标准数量分布</h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [
                    `${value.toLocaleString()} 条事项 (${distTotal > 0 ? ((value / distTotal) * 100).toFixed(1) : 0}%)`,
                    '数量',
                  ]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distribution.map((_, i) => (
                    <Cell key={i} fill={DIST_COLORS[i] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {distribution.map((d, i) => (
              <span
                key={d.label}
                className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600"
              >
                {d.label}: {d.count.toLocaleString()}项
              </span>
            ))}
          </div>
        </div>

        {domainData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-3">
              {domainLabel}平均检查标准数 TOP{Math.min(domainData.length, 12)}
            </h4>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={domainData}
                  layout="vertical"
                  margin={{ left: 0, right: 30, top: 5, bottom: 5 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="domain"
                    width={100}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => v.length > 8 ? v.slice(0, 7) + '…' : v}
                  />
                  <Tooltip
                    formatter={(value: number, _: string, entry: any) => [
                      `平均 ${value} 项标准`,
                      `${entry.payload.domain} (${entry.payload.total}条事项)`,
                    ]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="avgStandards" radius={[0, 4, 4, 0]} fill="#6366f1">
                    {domainData.map((d, i) => (
                      <Cell key={i} fill={i < 3 ? '#4f46e5' : i < 6 ? '#6366f1' : '#a5b4fc'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              仅展示事项数 &ge; 5 的{domainLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
