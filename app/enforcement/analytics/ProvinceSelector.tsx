'use client';

import { useRouter } from 'next/navigation';

interface Props {
  options: { code: string; label: string }[];
  selected: string;
}

export default function ProvinceSelector({ options, selected }: Props) {
  const router = useRouter();

  return (
    <select
      value={selected}
      onChange={e => {
        const code = e.target.value;
        router.push(code ? `/enforcement/analytics?province=${code}` : '/enforcement/analytics');
      }}
      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30"
    >
      {options.map(p => (
        <option key={p.code} value={p.code}>{p.label}</option>
      ))}
    </select>
  );
}
