'use client'

import { useRouter } from 'next/navigation';

export default function PageSizeSelect({
  pageSize,
  searchParams,
}: {
  pageSize: number;
  searchParams: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <span className="flex items-center gap-1 text-sm text-slate-400">
      每页
      <select
        className="border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white cursor-pointer text-slate-600"
        defaultValue={pageSize}
        onChange={(e) => {
          const params = new URLSearchParams();
          Object.entries(searchParams).forEach(([key, value]) => {
            if (value) params.set(key, value);
          });
          const newSize = Number(e.target.value);
          if (newSize !== 50) params.set('pageSize', String(newSize));
          else params.delete('pageSize');
          params.delete('page');
          const qs = params.toString();
          router.push(`/admin/laws${qs ? `?${qs}` : ''}`);
        }}
      >
        <option value={50}>50</option>
        <option value={100}>100</option>
        <option value={500}>500</option>
      </select>
      条
    </span>
  );
}
