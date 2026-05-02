'use client'

import Link from 'next/link';

interface LawVersionItem {
  id: number;
  title: string;
  effectiveDate: Date | null;
  promulgationDate: Date | null;
  status: string | null;
}

interface LawHistoryProps {
  currentLaw: LawVersionItem;
  history: LawVersionItem[];
  modificationDecisions?: LawVersionItem[];
  modifiedLawVersions?: LawVersionItem[];
}

export default function LawHistory({
  currentLaw,
  history,
  modificationDecisions = [],
  modifiedLawVersions = [],
}: LawHistoryProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const getVersionDate = (law: LawVersionItem) => {
    if (law.effectiveDate) return new Date(law.effectiveDate).getTime();
    if (law.promulgationDate) return new Date(law.promulgationDate).getTime();
    return 0;
  };

  const allVersions = [
    { ...currentLaw, status: currentLaw.status || '现行有效', isCurrent: true },
    ...history.map(law => ({ ...law, status: law.status || '已修改', isCurrent: false })),
  ].sort((a, b) => getVersionDate(b) - getVersionDate(a));

  const hasVersionHistory = allVersions.length > 1;
  const hasModDecisions = modificationDecisions.length > 0;
  const hasModifiedLaw = modifiedLawVersions.length > 0;

  return (
    <div className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">本法变迁</h2>
        <p className="text-sm text-slate-500">点击可查看详情</p>
      </div>

      <div className="max-h-[480px] overflow-y-auto custom-scrollbar space-y-6">
        {/* 版本历史 */}
        {hasVersionHistory && (
          <div>
            {(hasModDecisions || hasModifiedLaw) && (
              <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                版本历史
              </h3>
            )}
            <div className="relative">
              {allVersions.map((law, index) => (
                <div key={law.id} className="relative flex gap-4 py-3">
                  <div className="relative flex flex-col items-center shrink-0">
                    {index !== allVersions.length - 1 && (
                      <div className="absolute top-6 left-1.5 w-0.5 h-full bg-slate-200"></div>
                    )}
                    {law.isCurrent ? (
                      <div className="w-3 h-3 rounded-full bg-blue-600 mt-1.5 z-10"></div>
                    ) : (
                      <div className="w-3 h-3 rounded-full border-2 border-slate-400 bg-white mt-1.5 z-10"></div>
                    )}
                  </div>
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
        )}

        {/* 修改决定 — 指向本法的决定文档 */}
        {hasModDecisions && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              修改决定
            </h3>
            <div className="space-y-2">
              {modificationDecisions.map(decision => (
                <Link
                  key={decision.id}
                  href={`/law/${decision.id}`}
                  className="block p-3 rounded-lg border border-amber-100 bg-amber-50/50 hover:bg-amber-100/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-slate-700 group-hover:text-amber-700 transition-colors">
                      {decision.title}
                    </h4>
                    <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium shrink-0">
                      修改决定
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    公布: {formatDate(decision.promulgationDate) || '—'}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 被修改法规 — 本"决定"所修改的法规 */}
        {hasModifiedLaw && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              被修改法规
            </h3>
            <div className="space-y-2">
              {modifiedLawVersions.map(version => (
                <Link
                  key={version.id}
                  href={`/law/${version.id}`}
                  className="block p-3 rounded-lg border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-slate-700 group-hover:text-emerald-700 transition-colors">
                      {version.title}
                    </h4>
                  </div>
                  <div className="text-xs text-slate-500">
                    公布: {formatDate(version.promulgationDate) || '—'} | 施行: {formatDate(version.effectiveDate) || '—'}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

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
