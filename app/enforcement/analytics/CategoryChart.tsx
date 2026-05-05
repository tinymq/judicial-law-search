'use client';

import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS: Record<string, string> = {
  '行政许可': '#10b981',
  '行政处罚': '#ef4444',
  '行政强制': '#f97316',
  '行政检查': '#3b82f6',
  '行政调解': '#8b5cf6',
  '行政裁决': '#6366f1',
  '行政确认': '#06b6d4',
  '行政奖励': '#f59e0b',
  '其他执法事项': '#94a3b8',
};

interface Props {
  data: { category: string; count: number }[];
  province: string;
}

export default function CategoryChart({ data, province }: Props) {
  const pq = province ? `&province=${province}` : '';

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-4">事项类型分布</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 5, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={70} />
            <Tooltip
              formatter={(value: number) => [`${value} 项`, '事项数']}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry) => (
                <Cell key={entry.category} fill={COLORS[entry.category] || '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.map(d => (
          <Link
            key={d.category}
            href={`/enforcement?category=${encodeURIComponent(d.category)}${pq}`}
            className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            {d.category} ({d.count})
          </Link>
        ))}
      </div>
    </div>
  );
}
