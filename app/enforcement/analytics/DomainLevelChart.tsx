'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const LEVEL_COLORS: Record<string, string> = {
  '法律': '#7c3aed',
  '行政法规': '#2563eb',
  '部门规章': '#0891b2',
  '地方性法规': '#16a34a',
  '地方政府规章': '#ca8a04',
  '未知': '#94a3b8',
};

const TYPE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  '高国家法规型': { bg: '#7c3aed18', text: '#7c3aed' },
  '高部门规章型': { bg: '#0891b218', text: '#0891b2' },
  '高地方法规型': { bg: '#16a34a18', text: '#16a34a' },
  '混合型': { bg: '#f1f5f9', text: '#64748b' },
};

interface Props {
  data: Record<string, any>[];
  levels: string[];
  title: string;
  province: string;
  isDomain: boolean;
  dependencyTypes?: Record<string, string>;
}

export default function DomainLevelChart({ data, levels, title, province, isDomain, dependencyTypes }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayData = showAll ? data : data.slice(0, 10);
  const pq = province ? `&province=${province}` : '';
  const hasDependencyTypes = dependencyTypes && Object.keys(dependencyTypes).length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          {hasDependencyTypes && (
            <p className="text-xs text-slate-400 mt-0.5">右侧标签标注各部门的法规依赖类型</p>
          )}
        </div>
        {data.length > 10 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            {showAll ? `收起 (TOP10)` : `更多 (共${data.length}个)`}
          </button>
        )}
      </div>
      <div style={{ height: Math.max(350, displayData.length * 32 + 50) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="domain"
              tick={{ fontSize: 11 }}
              width={100}
              tickFormatter={(v: string) => v.length > 8 ? v.slice(0, 8) + '…' : v}
            />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {levels.map(level => (
              <Bar
                key={level}
                dataKey={level}
                stackId="stack"
                fill={LEVEL_COLORS[level] || '#94a3b8'}
                name={level}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {hasDependencyTypes && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-400 mb-2">法规依赖分类：</p>
          <div className="flex flex-wrap gap-1.5">
            {displayData.map(d => {
              const depType = dependencyTypes![d.domain] || '混合型';
              const badge = TYPE_BADGE_COLORS[depType] || TYPE_BADGE_COLORS['混合型'];
              return (
                <span
                  key={d.domain}
                  className="text-xs px-2 py-1 rounded inline-flex items-center gap-1"
                  style={{ backgroundColor: badge.bg, color: badge.text }}
                >
                  <span className="font-medium">{d.domain.length > 6 ? d.domain.slice(0, 6) + '…' : d.domain}</span>
                  <span className="opacity-70">{depType}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-3 text-xs text-slate-400">
        点击下方领域查看对应事项：
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {displayData.slice(0, 15).map(d => (
            <Link
              key={d.domain}
              href={`/enforcement?domain=${encodeURIComponent(d.domain)}${pq}`}
              className="px-2 py-0.5 rounded bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              {d.domain}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
