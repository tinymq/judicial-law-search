'use client';

import Link from 'next/link';

interface Props {
  totalItems: number;
  linkedItems: number;
  distinctLawCount: number;
  totalLaws: number;
  parentCount: number;
  childCount: number;
  province: string;
}

export default function OverviewCards({ totalItems, linkedItems, distinctLawCount, totalLaws, parentCount, childCount, province }: Props) {
  const linkRate = totalItems > 0 ? ((linkedItems / totalItems) * 100).toFixed(1) : '0';
  const pq = province ? `&province=${province}` : '';

  const cards = [
    { label: '执法事项总数', value: totalItems.toLocaleString(), color: 'text-slate-900', href: `/enforcement?${pq}` },
    { label: '已关联法规', value: linkedItems.toLocaleString(), sub: `关联率 ${linkRate}%`, color: 'text-blue-600', href: `/enforcement?linked=yes${pq}` },
    { label: '涉及法规数', value: distinctLawCount.toLocaleString(), sub: `库内共 ${totalLaws.toLocaleString()} 部`, color: 'text-violet-600', href: `/enforcement?view=laws${pq}` },
    { label: '未关联事项', value: (totalItems - linkedItems).toLocaleString(), color: 'text-orange-600', href: `/enforcement?linked=no${pq}` },
    ...(parentCount > 0 ? [{ label: '综合事项', value: parentCount.toLocaleString(), sub: `含 ${childCount} 条子事项`, color: 'text-indigo-600', href: `/enforcement?type=parent${pq}` }] : []),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {cards.map(card => (
        <Link
          key={card.label}
          href={card.href}
          className="bg-white rounded-xl border border-slate-200/60 p-5 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="text-sm font-medium text-slate-500 mb-2">{card.label}</div>
          <div className={`text-3xl font-bold tabular-nums ${card.color} group-hover:opacity-80`}>{card.value}</div>
          {card.sub && <div className="text-xs text-slate-400 mt-1">{card.sub}</div>}
        </Link>
      ))}
    </div>
  );
}
