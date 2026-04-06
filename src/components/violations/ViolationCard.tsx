import Link from 'next/link';

interface ViolationCardProps {
  id: number;
  code: string | null;
  description: string;
  basisText: string;
}

export default function ViolationCard({ id, code, description, basisText }: ViolationCardProps) {
  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-semibold text-slate-900">{code || '未编号'}</span>
        <Link
          href={`/violations/${id}`}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          查看详情 →
        </Link>
      </div>
      <p className="text-sm text-slate-700 mb-1">{description}</p>
      <p className="text-xs text-slate-500">依据：{basisText}</p>
    </div>
  );
}
