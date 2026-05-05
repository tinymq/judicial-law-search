'use client';

import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const LEVEL_COLORS: Record<string, string> = {
  '法律': '#7c3aed',
  '行政法规': '#2563eb',
  '部门规章': '#0891b2',
  '地方性法规': '#16a34a',
  '地方政府规章': '#ca8a04',
  '未知': '#94a3b8',
};

interface Props {
  data: { level: string; count: number }[];
  province: string;
}

export default function LawLevelChart({ data, province }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const pq = province ? `&province=${province}` : '';

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-4">法规级别分布</h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="level"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell key={entry.level} fill={LEVEL_COLORS[entry.level] || '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [`${value} 项 (${((value / total) * 100).toFixed(1)}%)`, name]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5 mt-2">
        {data.map(d => (
          <Link
            key={d.level}
            href={`/enforcement?lawLevel=${encodeURIComponent(d.level)}${pq}`}
            className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 rounded px-2 py-1 -mx-2 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: LEVEL_COLORS[d.level] || '#94a3b8' }} />
              <span className="text-xs text-slate-700 group-hover:text-blue-600">{d.level}</span>
            </div>
            <span className="text-xs tabular-nums font-medium text-slate-600">{d.count} <span className="text-slate-400">({((d.count / total) * 100).toFixed(1)}%)</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
