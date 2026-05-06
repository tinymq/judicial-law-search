'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  data: { level: string; itemCount: number; lawCount: number; density: number }[];
  province: string;
}

const LEVEL_COLORS: Record<string, string> = {
  '法律': '#7c3aed',
  '行政法规': '#2563eb',
  '部门规章': '#0891b2',
  '地方性法规': '#16a34a',
  '地方政府规章': '#ca8a04',
};

export default function EfficacyDensityChart({ data }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-1">法规效力密度</h3>
      <p className="text-xs text-slate-400 mb-4">平均每部法规支撑多少条执法事项</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <XAxis
              dataKey="level"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => v.length > 5 ? v.slice(0, 5) + '…' : v}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [`${value} 条/部`, '平均支撑事项']}
              labelFormatter={(label: string) => label}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="density" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.level} fill={LEVEL_COLORS[entry.level] || '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 space-y-1">
        {data.map(d => (
          <div key={d.level} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-slate-50">
            <span className="text-slate-600">{d.level}</span>
            <span className="text-slate-500">
              <span className="font-semibold text-slate-800">{d.density}</span> 条/部
              <span className="text-slate-400 ml-2">({d.lawCount}部法规 → {d.itemCount.toLocaleString()}条事项)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
