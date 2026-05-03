import Link from 'next/link';
import { getIndustryColor } from '@/src/lib/industry-colors';

const LEVEL_BADGE_COLORS: Record<string, string> = {
  '法律': 'bg-red-50 text-red-600 border-red-100',
  '行政法规': 'bg-orange-50 text-orange-600 border-orange-100',
  '部门规章': 'bg-blue-50 text-blue-600 border-blue-100',
  '地方性法规': 'bg-green-50 text-green-600 border-green-100',
  '司法解释': 'bg-purple-50 text-purple-600 border-purple-100',
  '地方政府规章': 'bg-teal-50 text-teal-600 border-teal-100',
  '规范性文件': 'bg-slate-50 text-slate-600 border-slate-200',
};

const STATUS_DOT_COLORS: Record<string, { dot: string; text: string }> = {
  '现行有效': { dot: 'bg-green-500', text: 'text-green-600' },
  '已被修改': { dot: 'bg-blue-500', text: 'text-blue-600' },
  '已废止': { dot: 'bg-red-500', text: 'text-red-500' },
  '尚未生效': { dot: 'bg-amber-500', text: 'text-amber-600' },
};

const MATCH_TYPE_LABELS: Record<string, { label: string; style: string }> = {
  'title_exact': { label: '标题精确命中', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'title_base_exact': { label: '标题归一命中', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'title_prefix': { label: '标题前缀命中', style: 'bg-blue-50 text-blue-600 border-blue-200' },
  'title_contains': { label: '标题包含命中', style: 'bg-blue-50 text-blue-600 border-blue-200' },
  'content': { label: '正文相关', style: 'bg-slate-100 text-slate-600 border-slate-200' },
};

type LawResultCardProps = {
  law: {
    id: number;
    title: string;
    level: string;
    status: string | null;
    issuingAuthority: string | null;
    promulgationDate: Date | null;
    effectiveDate: Date | null;
    region: string | null;
    searchMatchType?: string;
  };
  index?: number;
  industryName?: string;
  resolvedStatus: string;
};

function formatDate(date: Date | null) {
  if (!date) return '暂无';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export default function LawResultCard({ law, index, industryName, resolvedStatus }: LawResultCardProps) {
  const levelBadge = LEVEL_BADGE_COLORS[law.level] || 'bg-slate-50 text-slate-500 border-slate-200';
  const statusColors = STATUS_DOT_COLORS[resolvedStatus] || { dot: 'bg-slate-400', text: 'text-slate-500' };
  const matchInfo = law.searchMatchType ? MATCH_TYPE_LABELS[law.searchMatchType] : null;
  const displayName = industryName || '执法领域';
  const categoryColor = getIndustryColor(displayName);

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 hover:border-slate-300 hover:shadow-sm transition-all">
      <div className="px-4 sm:px-5 py-3.5 sm:py-4">
        <div className="flex items-start gap-3 mb-2">
          {index != null && (
            <span className="shrink-0 mt-1.5 text-xs tabular-nums text-slate-300 w-6 text-right">
              {index}
            </span>
          )}
          {industryName && (
            <span className={`inline-flex items-center gap-1.5 shrink-0 mt-0.5 px-2.5 py-1 rounded text-sm font-medium border ${categoryColor.bg} ${categoryColor.text} ${categoryColor.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${categoryColor.dot}`} />
              {displayName}
            </span>
          )}
          <Link
            href={`/law/${law.id}`}
            target="_blank"
            className="flex-1 min-w-0 text-base font-semibold text-slate-800 hover:text-blue-600 transition-colors leading-snug"
          >
            {law.title}
          </Link>
          {matchInfo && (
            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${matchInfo.style}`}>
              {matchInfo.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap mt-1">
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${levelBadge}`}>
            {law.level}
          </span>
          <span className="flex items-center gap-1 text-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`} />
            <span className={`${statusColors.text} font-medium`}>{resolvedStatus}</span>
          </span>
          <span className="text-slate-200">·</span>
          <span className="text-sm text-slate-500 truncate max-w-[200px]">{law.issuingAuthority || '暂无'}</span>
          <span className="text-slate-200">·</span>
          <span className="text-sm text-slate-500">{formatDate(law.promulgationDate)} 公布</span>
          {law.region && law.region !== '全国' && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-600">
              {law.region}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
