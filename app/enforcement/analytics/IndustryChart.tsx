'use client';

import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { id: number; name: string; itemCount: number; lawCount: number }[];
  province: string;
}

export default function IndustryChart({ data, province }: Props) {
  const pq = province ? `&province=${province}` : '';

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-1">行业分布 TOP15</h3>
      <p className="text-xs text-slate-400 mb-3">按行业统计执法事项数量</p>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 5, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10 }}
              width={80}
              tickFormatter={(v: string) => v.length > 7 ? v.slice(0, 7) + '…' : v}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value}`,
                name === 'itemCount' ? '事项数' : '关联法规',
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="itemCount" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="itemCount" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto">
        {data.slice(0, 10).map(d => (
          <Link
            key={d.name}
            href={`/enforcement?industry=${d.id}${pq}`}
            className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-sky-700 transition-colors"
          >
            {d.name} ({d.itemCount})
          </Link>
        ))}
      </div>
    </div>
  );
}
