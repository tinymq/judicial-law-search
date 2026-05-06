'use client';

import { useRouter } from 'next/navigation';

interface Props {
  pageSize: number;
  options?: number[];
  basePath: string;
  searchParams: Record<string, string>;
}

export default function PageSizeSelect({ pageSize, options = [50, 100, 200], basePath, searchParams }: Props) {
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
          if (newSize !== options[0]) params.set('pageSize', String(newSize));
          else params.delete('pageSize');
          params.delete('page');
          const qs = params.toString();
          router.push(`${basePath}${qs ? `?${qs}` : ''}`);
        }}
      >
        {options.map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      条
    </span>
  );
}
