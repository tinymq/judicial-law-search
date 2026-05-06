'use client';

import { useState } from 'react';
import Link from 'next/link';

const LEVEL_COLORS: Record<string, string> = {
  '法律': '#7c3aed',
  '行政法规': '#2563eb',
  '部门规章': '#0891b2',
  '地方性法规': '#16a34a',
  '地方政府规章': '#ca8a04',
};

interface LawItem {
  id: number;
  title: string;
  level: string;
  count: number;
}

interface Props {
  data: LawItem[];
  localData?: LawItem[];
  province: string;
}

export default function TopLawsTable({ data, localData, province }: Props) {
  const [showLocal, setShowLocal] = useState(false);
  const displayData = showLocal && localData ? localData : data;
  const maxCount = displayData.length > 0 ? displayData[0].count : 1;
  const pq = province ? `&province=${province}` : '';

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-800">
          {showLocal ? '地方法规引用 TOP20' : '高引用法规 TOP20'}
        </h3>
        {localData && localData.length > 0 && (
          <button
            onClick={() => setShowLocal(!showLocal)}
            className="text-sm font-medium px-3 py-1 rounded-lg transition-colors"
            style={{
              backgroundColor: showLocal ? '#16a34a18' : '#f1f5f9',
              color: showLocal ? '#16a34a' : '#64748b',
            }}
          >
            {showLocal ? '← 全部法规' : `仅看地方法规 (${localData.length})`}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {displayData.map((law, i) => (
          <div key={law.id} className="flex items-center gap-3 group">
            <span className="w-6 text-right text-xs font-medium text-slate-400 tabular-nums shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0 relative">
              <div
                className="absolute inset-y-0 left-0 rounded-r opacity-15"
                style={{
                  width: `${(law.count / maxCount) * 100}%`,
                  backgroundColor: LEVEL_COLORS[law.level] || '#94a3b8',
                }}
              />
              <div className="relative flex items-center justify-between px-3 py-1.5">
                <Link
                  href={`/law/${law.id}`}
                  className="text-sm text-slate-700 hover:text-blue-600 truncate transition-colors"
                >
                  {law.title}
                </Link>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${LEVEL_COLORS[law.level] || '#94a3b8'}20`, color: LEVEL_COLORS[law.level] || '#94a3b8' }}
                  >
                    {law.level}
                  </span>
                  <Link
                    href={`/enforcement?lawId=${law.id}${pq}`}
                    className="text-sm font-semibold text-slate-700 hover:text-blue-600 tabular-nums transition-colors"
                    title="查看引用此法规的执法事项"
                  >
                    {law.count}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
        {displayData.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">暂无数据</p>
        )}
      </div>
    </div>
  );
}
