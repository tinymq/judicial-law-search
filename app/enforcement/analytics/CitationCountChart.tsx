'use client';

import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  data: { label: string; count: number; citation?: string }[];
  total: number;
  province: string;
}

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#94a3b8'];

export default function CitationCountChart({ data, total, province }: Props) {
  const pq = province ? `&province=${province}` : '';

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-1">引用法规数量分布</h3>
      <p className="text-xs text-slate-400 mb-4">每条事项引用多少部法规</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [
                `${value.toLocaleString()} 项 (${((value / total) * 100).toFixed(1)}%)`,
                '事项数',
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i] || '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.map(d => (
          <span
            key={d.label}
            className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600"
          >
            {d.label}: {d.count.toLocaleString()}项 ({((d.count / total) * 100).toFixed(1)}%)
          </span>
        ))}
      </div>
    </div>
  );
}
