'use client';

import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  singleLaw: number;
  multiLaw: number;
  noRef: number;
  province: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#94a3b8'];

export default function CitationPie({ singleLaw, multiLaw, noRef, province }: Props) {
  const pq = province ? `&province=${province}` : '';
  const items = [
    { name: '单法规引用', value: singleLaw, citation: 'single' },
    { name: '多法规引用', value: multiLaw, citation: 'multi' },
    { name: '无明确引用', value: noRef, citation: 'none' },
  ].filter(d => d.value > 0);

  const total = singleLaw + multiLaw + noRef;

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-4">法规引用模式</h3>
      <div className="flex items-center gap-4">
        <div className="h-[200px] w-[200px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
              >
                {items.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value} 项 (${((value / total) * 100).toFixed(1)}%)`, name]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-3">
          {items.map((d, i) => (
            <Link
              key={d.name}
              href={`/enforcement?citation=${d.citation}${pq}`}
              className="flex items-center justify-between hover:bg-slate-50 rounded px-2 py-1.5 -mx-2 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-sm text-slate-700 group-hover:text-blue-600">{d.name}</span>
              </div>
              <div className="text-sm tabular-nums">
                <span className="font-semibold text-slate-800">{d.value.toLocaleString()}</span>
                <span className="text-slate-400 ml-1">({((d.value / total) * 100).toFixed(1)}%)</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
