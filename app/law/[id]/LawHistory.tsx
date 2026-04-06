'use client'

import Link from 'next/link';

interface LawHistoryProps {
  currentLaw: {
    id: number;
    title: string;
    effectiveDate: Date | null;
    promulgationDate: Date | null;
    status: string | null;
  };
  history: Array<{
    id: number;
    title: string;
    effectiveDate: Date | null;
    promulgationDate: Date | null;
    status: string | null;
  }>;
}

export default function LawHistory({ currentLaw, history }: LawHistoryProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // 获取版本日期（优先使用施行日期，其次公布日期）
  const getVersionDate = (law: any) => {
    if (law.effectiveDate) return new Date(law.effectiveDate).getTime();
    if (law.promulgationDate) return new Date(law.promulgationDate).getTime();
    return 0;
  };

  // 合并当前版本和历史版本，按时间排序（从新到旧）
  const allVersions = [
    {
      id: currentLaw.id,
      title: currentLaw.title,
      effectiveDate: currentLaw.effectiveDate,
      promulgationDate: currentLaw.promulgationDate,
      status: currentLaw.status || '现行有效',
      isCurrent: true
    },
    ...history.map(law => ({
      ...law,
      status: law.status || '已修改',
      isCurrent: false
    }))
  ].sort((a, b) => {
    const dateA = getVersionDate(a);
    const dateB = getVersionDate(b);
    return dateB - dateA; // 降序，最新的在前面
  });

  return (
    <div className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">本法变迁</h2>
        <p className="text-sm text-slate-500">点击历史版本可查看详情</p>
      </div>

      <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
        <div className="relative">
        {allVersions.map((law, index) => (
          <div key={law.id} className="relative flex gap-4 py-3">
            {/* 左侧时间轴 */}
            <div className="relative flex flex-col items-center shrink-0">
              {/* 竖线 */}
              {index !== allVersions.length - 1 && (
                <div className="absolute top-6 left-1.5 w-0.5 h-full bg-slate-200"></div>
              )}
              {/* 圆点 */}
              {law.isCurrent ? (
                <div className="w-3 h-3 rounded-full bg-blue-600 mt-1.5 z-10"></div>
              ) : (
                <div className="w-3 h-3 rounded-full border-2 border-slate-400 bg-white mt-1.5 z-10"></div>
              )}
            </div>

            {/* 右侧内容 */}
            {law.isCurrent ? (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-blue-700">{law.title}</h3>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                    当前版本
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  公布: {formatDate(law.promulgationDate) || '—'} | 施行: {formatDate(law.effectiveDate) || '—'}
                </div>
              </div>
            ) : (
              <Link href={`/law/${law.id}`} className="flex-1 min-w-0 group">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                    {law.title}
                  </h3>
                </div>
                <div className="text-xs text-slate-500">
                  公布: {formatDate(law.promulgationDate) || '—'} | 施行: {formatDate(law.effectiveDate) || '—'}
                </div>
              </Link>
            )}
          </div>
        ))}
        </div>
      </div>

      {/* 自定义滚动条样式 */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
