'use client';

import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { name: string; count: number }[];
  title: string;
  province: string;
  isDomain: boolean;
}

export default function DomainChart({ data, title, province, isDomain }: Props) {
  const pq = province ? `&province=${province}` : '';

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-4">{title}</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 5, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10 }}
              width={90}
              tickFormatter={(v: string) => v.length > 8 ? v.slice(0, 8) + '…' : v}
            />
            <Tooltip
              formatter={(value: number) => [`${value} 项`, '事项数']}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto">
        {data.slice(0, 10).map(d => (
          <Link
            key={d.name}
            href={`/enforcement?${isDomain ? 'domain' : 'body'}=${encodeURIComponent(d.name)}${pq}`}
            className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          >
            {d.name} ({d.count})
          </Link>
        ))}
      </div>
    </div>
  );
}
