import Link from 'next/link';

type StatusStat = {
  status: string;
  count: number;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  '现行有效': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
  '已被修改': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  '已废止': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  '尚未生效': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  '部分废止或失效': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-400' },
};

const DEFAULT_COLOR = { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };

type LawStatsCardsProps = {
  statuses: StatusStat[];
  selectedStatus: string;
  buildHref: (status: string) => string;
};

export default function LawStatsCards({ statuses, selectedStatus, buildHref }: LawStatsCardsProps) {
  if (statuses.length === 0) return null;

  return (
    <div className="mb-6">
      <div className={`grid gap-3 sm:gap-4`} style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))` }}>
        {statuses.map(stat => {
          const color = STATUS_COLORS[stat.status] || DEFAULT_COLOR;
          const isSelected = selectedStatus === stat.status;
          return (
            <Link
              key={stat.status}
              href={buildHref(isSelected ? '' : stat.status)}
              className={`group rounded-xl border p-4 transition-all hover:shadow-md ${
                isSelected
                  ? `${color.bg} ${color.border} shadow-sm`
                  : 'bg-white border-slate-200/60 hover:border-slate-300'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${color.dot} mb-3`} />
              <div className="text-3xl font-bold text-slate-900 tabular-nums">
                {stat.count.toLocaleString()}
              </div>
              <div className={`text-sm font-medium mt-1 ${isSelected ? color.text : 'text-slate-500'}`}>
                {stat.status}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
