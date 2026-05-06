'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  data: { cluster: string; itemCount: number; lawCount: number }[];
  province: string;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#94a3b8',
];

export default function LawClusterChart({ data }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-1">法规领域聚类</h3>
      <p className="text-xs text-slate-400 mb-4">高引用法规按监管领域归类，展示各领域法规群的事项支撑规模</p>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="cluster" tick={{ fontSize: 11 }} width={80} />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString()} 条事项`, '支撑事项数']}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="itemCount" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.map((d, i) => (
          <span
            key={d.cluster}
            className="text-xs px-2 py-1 rounded"
            style={{ backgroundColor: `${COLORS[i % COLORS.length]}15`, color: COLORS[i % COLORS.length] }}
          >
            {d.cluster}: {d.lawCount}部法规 → {d.itemCount.toLocaleString()}条事项
          </span>
        ))}
      </div>
    </div>
  );
}
