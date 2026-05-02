import Link from 'next/link';
import { getIndustryColor } from '@/src/lib/industry-colors';

type IndustryStat = {
  id: number;
  name: string;
  count: number;
};

type LawStatsCardsProps = {
  industries: IndustryStat[];
  selectedIndustry: string;
  buildHref: (industryId: string) => string;
};

export default function LawStatsCards({ industries, selectedIndustry, buildHref }: LawStatsCardsProps) {
  if (industries.length === 0) return null;

  const topIndustries = industries.slice(0, 4);
  const moreIndustries = industries.slice(4);

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {topIndustries.map(ind => {
          const color = getIndustryColor(ind.name);
          const isSelected = selectedIndustry === String(ind.id);
          return (
            <Link
              key={ind.id}
              href={buildHref(isSelected ? '' : String(ind.id))}
              className={`group rounded-xl border p-4 transition-all hover:shadow-md ${
                isSelected
                  ? `${color.bg} ${color.border} shadow-sm`
                  : 'bg-white border-slate-200/60 hover:border-slate-300'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${color.dot} mb-3`} />
              <div className="text-3xl font-bold text-slate-900 tabular-nums">
                {ind.count.toLocaleString()}
              </div>
              <div className={`text-sm font-medium mt-1 ${isSelected ? color.text : 'text-slate-500'}`}>
                {ind.name}
              </div>
            </Link>
          );
        })}
      </div>

      {moreIndustries.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {moreIndustries.map(ind => {
            const color = getIndustryColor(ind.name);
            const isSelected = selectedIndustry === String(ind.id);
            return (
              <Link
                key={ind.id}
                href={buildHref(isSelected ? '' : String(ind.id))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? `${color.bg} ${color.text} border ${color.border}`
                    : 'bg-white text-slate-500 border border-slate-200/60 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                {ind.name}
                <span className="text-xs opacity-60">{ind.count}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
