'use client';

import { useEffect } from 'react';

interface RecentViewTrackerProps {
  lawId: number;
  lawTitle: string;
}

const STORAGE_KEY = 'recentViewedLaws';
const MAX_ITEMS = 10;

export interface RecentViewItem {
  id: number;
  title: string;
  viewedAt: number;
}

export default function RecentViewTracker({ lawId, lawTitle }: RecentViewTrackerProps) {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const items: RecentViewItem[] = stored ? JSON.parse(stored) : [];

      // Remove existing entry for this law
      const filtered = items.filter(item => item.id !== lawId);

      // Add to front
      filtered.unshift({ id: lawId, title: lawTitle, viewedAt: Date.now() });

      // Keep only MAX_ITEMS
      const trimmed = filtered.slice(0, MAX_ITEMS);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  }, [lawId, lawTitle]);

  return null;
}
