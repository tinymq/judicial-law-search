'use client';

import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  data: { label: string; count: number; min: number; max: number }[];
  province: string;
}

const COLORS = ['#94a3b8', '#64748b', '#6366f1', '#4f46e5', '#7c3aed', '#dc2626'];

export default function ReuseChart({ data, province }: Props) {
  const pq = province ? `&province=${province}` : '';

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-1">法规复用度分布</h3>
      <p className="text-xs text-slate-400 mb-4">每部法规被多少条执法事项引用</p>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [`${value} 部法规`, '数量']}
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
        {data.filter(d => d.count > 0).map(d => (
          <Link
            key={d.label}
            href={`/enforcement?view=laws&minRef=${d.min}&maxRef=${d.max === 9999 ? '' : d.max}${pq}`}
            className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
          >
            {d.label}: {d.count}部
          </Link>
        ))}
      </div>
    </div>
  );
}
