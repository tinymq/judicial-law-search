interface StatusBadgeProps {
  status: 'complete' | 'partial' | 'empty';
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    complete: {
      label: '✅ 已拆解',
      className: 'bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded text-xs font-medium'
    },
    partial: {
      label: '⚠️ 部分拆解',
      className: 'bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded text-xs font-medium'
    },
    empty: {
      label: '❌ 未拆解',
      className: 'bg-slate-50 text-slate-700 border border-slate-200 px-2 py-1 rounded text-xs font-medium'
    }
  };

  const { label, className } = config[status];
  return <span className={className}>{label}</span>;
}
