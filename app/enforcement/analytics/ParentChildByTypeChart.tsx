'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

interface Props {
  data: { category: string; topLevel: number; child: number; childRatio: string }[];
  province: string;
}

const COLORS = { topLevel: '#3b82f6', child: '#f97316' };

export default function ParentChildByTypeChart({ data }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <h3 className="text-base font-semibold text-slate-800 mb-1">分类型父子结构</h3>
      <p className="text-xs text-slate-400 mb-4">各事项类型的顶层事项 vs 子事项拆分</p>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 5, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={70} />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value.toLocaleString()} 项`,
                name === 'topLevel' ? '顶层事项' : '子事项',
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Legend
              formatter={(value: string) => (value === 'topLevel' ? '顶层事项' : '子事项')}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="topLevel" stackId="stack" fill={COLORS.topLevel} name="topLevel" radius={[0, 0, 0, 0]} />
            <Bar dataKey="child" stackId="stack" fill={COLORS.child} name="child" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {data.map(d => (
          <div key={d.category} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-slate-50">
            <span className="text-slate-600">{d.category}</span>
            <span className="text-orange-600 font-medium">子事项 {d.childRatio}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
