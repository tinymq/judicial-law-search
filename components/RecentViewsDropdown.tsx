'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RecentViewItem } from '@/src/components/RecentViewTracker';

const STORAGE_KEY = 'recentViewedLaws';

export default function RecentViewsDropdown() {
  const [items, setItems] = useState<RecentViewItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  if (items.length === 0) return null;

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  return (
    <details className="relative">
      <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-600 select-none list-none [&::-webkit-details-marker]:hidden">
        最近浏览 ▾
      </summary>
      <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl border border-slate-200 shadow-lg z-30 p-3">
        <div className="text-xs font-bold text-slate-600 mb-2 px-1">最近浏览</div>
        <div className="space-y-0.5">
          {items.slice(0, 8).map(item => (
            <Link
              key={item.id}
              href={`/law/${item.id}`}
              target="_blank"
              className="block px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded transition-colors truncate"
              title={item.title}
            >
              <span className="text-slate-400 mr-1">{formatTime(item.viewedAt)}</span>
              {item.title.replace(/\(.*?\)$/, '')}
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}
