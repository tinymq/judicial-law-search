'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RecentViewItem } from './RecentViewTracker';

const STORAGE_KEY = 'recentViewedLaws';

export default function RecentViews() {
  const [items, setItems] = useState<RecentViewItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
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
    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
      <div className="text-xs font-bold text-slate-600 mb-2 px-1">最近浏览</div>
      <div className="space-y-0.5">
        {items.slice(0, 6).map(item => (
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
  );
}
