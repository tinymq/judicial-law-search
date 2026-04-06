'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import type { CaseAnalysisResult, MatchedViolation, MatchedLaw } from '@/src/lib/ai/case-analyzer';

export default function AIResultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<CaseAnalysisResult | null>(null);
  const [query, setQuery] = useState('');
  const [editingQuery, setEditingQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const doAnalyze = useCallback((text: string) => {
    setLoading(true);
    setResult(null);
    fetch('/api/ai/analyze-case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: text }),
    })
      .then(res => res.json())
      .then(data => setResult(data))
      .catch(err => setResult({ success: false, query: text, error: err.message }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const storedQuery = sessionStorage.getItem('caseQuery');
    if (!storedQuery) {
      router.replace('/ai');
      return;
    }
    setQuery(storedQuery);
    setEditingQuery(storedQuery);
    doAnalyze(storedQuery);
  }, [router, doAnalyze]);

  const handleReAnalyze = () => {
    const trimmed = editingQuery.trim();
    if (!trimmed || trimmed.length < 5) return;
    setQuery(trimmed);
    setIsEditing(false);
    sessionStorage.setItem('caseQuery', trimmed);
    doAnalyze(trimmed);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
          <SiteHeader />
          <div className="flex items-center gap-3">
            <Link href="/ai" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
              重新分析
            </Link>
            <Link href="/" className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
              法规检索
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Editable query input */}
        <div className="mb-4 sm:mb-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-3 sm:px-4 pt-3">
            <div className="text-xs text-slate-400">案件描述</div>
            {!isEditing && !loading && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                修改
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="p-3 sm:p-4 pt-2">
              <textarea
                value={editingQuery}
                onChange={e => setEditingQuery(e.target.value)}
                rows={3}
                className="w-full text-sm text-slate-700 leading-relaxed border border-slate-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReAnalyze();
                  }
                }}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleReAnalyze}
                  disabled={editingQuery.trim().length < 5}
                  className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  重新分析
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditingQuery(query); }}
                  className="px-4 py-1.5 text-slate-500 text-xs font-medium rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="px-3 sm:px-4 pb-3 pt-1 text-sm text-slate-700 leading-relaxed">{query}</div>
          )}
        </div>

        {loading ? (
          <LoadingState />
        ) : !result?.success ? (
          <ErrorState error={result?.error || '未知错误'} />
        ) : result.analysis ? (
          <>
            {/* Summary + Keywords */}
            <div className="mb-4 sm:mb-8 p-4 sm:p-5 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-base sm:text-lg font-bold text-blue-900 mb-2">{result.analysis.summary}</div>
              <div className="flex flex-wrap gap-2">
                {result.analysis.keywords.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{kw}</span>
                ))}
              </div>
            </div>

            {/* Interactive mind map with inline detail */}
            <MindMapWithDetail analysis={result.analysis} />
          </>
        ) : (
          <ErrorState error="分析结果为空" />
        )}
      </main>
    </div>
  );
}

// ==================== Sub-components ====================

function LoadingState() {
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center gap-3 px-6 py-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <span className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-slate-600">AI 正在分析案件，请稍候...</span>
      </div>
      <div className="mt-4 text-xs text-slate-400">通常需要 5-15 秒</div>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">!</div>
      <p className="text-slate-600 mb-2">分析失败</p>
      <p className="text-sm text-slate-400 mb-6">{error}</p>
      <Link href="/ai" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        重新输入
      </Link>
    </div>
  );
}

// ==================== Mind Map with Inline Detail ====================

type DetailTarget =
  | { type: 'violation'; data: MatchedViolation }
  | { type: 'law'; data: MatchedLaw };

interface LawFullData {
  id: number;
  title: string;
  status: string | null;
  category: string | null;
  preamble: string | null;
  articles: {
    id: number;
    chapter: string | null;
    section: string | null;
    title: string;
    content: string | null;
    paragraphs: {
      id: number;
      number: number | null;
      content: string;
      items: { id: number; number: string | null; content: string }[];
    }[];
  }[];
}

function MindMapWithDetail({ analysis }: { analysis: NonNullable<CaseAnalysisResult['analysis']> }) {
  const { violations, laws, punishmentTypes, warnings } = analysis.branches;
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set(['violations']));
  const [activeDetail, setActiveDetail] = useState<DetailTarget | null>(null);
  const [lawFullData, setLawFullData] = useState<LawFullData | null>(null);
  const [lawLoading, setLawLoading] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const toggleBranch = (key: string) => {
    setExpandedBranches(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const showDetail = (target: DetailTarget) => {
    const isSame =
      activeDetail?.type === target.type &&
      ((target.type === 'violation' && activeDetail.type === 'violation' && activeDetail.data.id === target.data.id) ||
       (target.type === 'law' && activeDetail.type === 'law' && activeDetail.data.id === target.data.id));

    if (isSame) {
      setActiveDetail(null);
      setLawFullData(null);
      return;
    }

    setActiveDetail(target);

    if (target.type === 'law') {
      setLawLoading(true);
      setLawFullData(null);
      fetch(`/api/law/${target.data.id}`)
        .then(res => res.json())
        .then(data => { if (!data.error) setLawFullData(data); })
        .catch(() => {})
        .finally(() => setLawLoading(false));
    } else {
      setLawFullData(null);
    }

    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  };

  // Build all branches
  const allBranches: BranchData[] = [];

  if (violations.length > 0) {
    allBranches.push({
      key: 'violations',
      color: 'red',
      title: `违法行为 (${violations.length})`,
      side: 'left',
      items: violations.map(v => ({
        id: `v-${v.id}`,
        label: v.description,
        labelShort: v.description.length > 40 ? v.description.slice(0, 40) + '...' : v.description,
        children: v.code ? [{ label: v.code, onClick: undefined }] : [],
        onClick: () => showDetail({ type: 'violation', data: v }),
      })),
    });
  }

  if (laws.length > 0) {
    allBranches.push({
      key: 'laws',
      color: 'blue',
      title: `涉及法规 (${laws.length})`,
      side: 'left',
      items: laws.map(l => ({
        id: `l-${l.id}`,
        label: l.title,
        labelShort: l.title.length > 30 ? l.title.slice(0, 30) + '...' : l.title,
        children: l.relevantArticles.map(a => ({
          label: a,
          onClick: () => showDetail({ type: 'law', data: l }),
        })),
        onClick: () => showDetail({ type: 'law', data: l }),
      })),
    });
  }

  if (punishmentTypes.length > 0) {
    allBranches.push({
      key: 'punishment',
      color: 'orange',
      title: '处置建议',
      side: 'right',
      items: punishmentTypes.map((p, i) => ({
        id: `p-${i}`,
        label: p,
        labelShort: p,
        children: [],
        onClick: undefined,
      })),
    });
  }

  if (warnings.length > 0) {
    allBranches.push({
      key: 'warnings',
      color: 'amber',
      title: '注意事项',
      side: 'right',
      items: warnings.map((w, i) => ({
        id: `w-${i}`,
        label: w,
        labelShort: w,
        children: [],
        onClick: undefined,
      })),
    });
  }

  const leftBranches = allBranches.filter(b => b.side === 'left');
  const rightBranches = allBranches.filter(b => b.side === 'right');

  return (
    <div>
      {/* Mind map container */}
      <div className="mb-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-8">
        <div className="text-sm sm:text-base font-bold text-slate-500 mb-4 sm:mb-6">案件关系总览</div>

        {/* Desktop: horizontal layout */}
        <div className="hidden md:flex items-center justify-center overflow-x-auto min-w-[800px]">
          <div className="flex flex-col gap-5 items-end">
            {leftBranches.map(branch => (
              <HorizontalBranch
                key={branch.key}
                branch={branch}
                expanded={expandedBranches.has(branch.key)}
                onToggle={() => toggleBranch(branch.key)}
                direction="left"
                activeDetail={activeDetail}
              />
            ))}
          </div>

          <div className="shrink-0 mx-4">
            <div className="px-6 py-4 bg-blue-600 text-white rounded-2xl text-base font-bold shadow-lg max-w-[180px] text-center leading-snug">
              {analysis.summary.length > 16 ? analysis.summary.slice(0, 16) + '...' : analysis.summary}
            </div>
          </div>

          <div className="flex flex-col gap-5 items-start">
            {rightBranches.map(branch => (
              <HorizontalBranch
                key={branch.key}
                branch={branch}
                expanded={expandedBranches.has(branch.key)}
                onToggle={() => toggleBranch(branch.key)}
                direction="right"
                activeDetail={activeDetail}
              />
            ))}
          </div>
        </div>

        {/* Mobile: vertical layout */}
        <div className="md:hidden">
          {/* Center node */}
          <div className="flex justify-center mb-4">
            <div className="px-5 py-3 bg-blue-600 text-white rounded-2xl text-base font-bold shadow-lg text-center leading-snug">
              {analysis.summary.length > 20 ? analysis.summary.slice(0, 20) + '...' : analysis.summary}
            </div>
          </div>

          {/* Vertical connector */}
          <div className="flex justify-center mb-2">
            <div className="w-0.5 h-4 bg-slate-300"></div>
          </div>

          {/* All branches stacked vertically */}
          <div className="space-y-3">
            {allBranches.map(branch => (
              <MobileBranch
                key={branch.key}
                branch={branch}
                expanded={expandedBranches.has(branch.key)}
                onToggle={() => toggleBranch(branch.key)}
                activeDetail={activeDetail}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Inline detail panel */}
      {activeDetail && (
        <div ref={detailRef} className="mb-8">
          {activeDetail.type === 'violation' ? (
            <ViolationDetail violation={activeDetail.data} onClose={() => setActiveDetail(null)} />
          ) : (
            <LawDetail
              law={activeDetail.data}
              fullData={lawFullData}
              loading={lawLoading}
              onClose={() => { setActiveDetail(null); setLawFullData(null); }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Branch types ====================

interface BranchChild {
  label: string;
  onClick?: () => void;
}

interface BranchItem {
  id: string;
  label: string;
  labelShort: string;
  children: BranchChild[];
  onClick?: () => void;
}

interface BranchData {
  key: string;
  color: string;
  title: string;
  side: 'left' | 'right';
  items: BranchItem[];
}

const BRANCH_COLORS: Record<string, { bg: string; text: string; dot: string; line: string; activeBg: string; border: string }> = {
  red: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', line: 'bg-red-300', activeBg: 'bg-red-100', border: 'border-red-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', line: 'bg-blue-300', activeBg: 'bg-blue-100', border: 'border-blue-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', line: 'bg-orange-300', activeBg: 'bg-orange-100', border: 'border-orange-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', line: 'bg-amber-300', activeBg: 'bg-amber-100', border: 'border-amber-200' },
};

// ==================== Mobile vertical branch ====================

function MobileBranch({
  branch,
  expanded,
  onToggle,
  activeDetail,
}: {
  branch: BranchData;
  expanded: boolean;
  onToggle: () => void;
  activeDetail: DetailTarget | null;
}) {
  const c = BRANCH_COLORS[branch.color] || BRANCH_COLORS.blue;

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      {/* Branch title - tap to toggle */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 ${c.bg} cursor-pointer`}
      >
        <span className={`text-base font-bold ${c.text}`}>{branch.title}</span>
        <span className={`text-sm ${c.text} transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </button>

      {/* Expanded items */}
      {expanded && (
        <div className="p-3 space-y-2 bg-white">
          {branch.items.map(item => {
            const isActive =
              activeDetail &&
              ((activeDetail.type === 'violation' && item.id === `v-${activeDetail.data.id}`) ||
               (activeDetail.type === 'law' && item.id === `l-${activeDetail.data.id}`));

            return (
              <div key={item.id}>
                {/* Item */}
                {item.onClick ? (
                  <button
                    onClick={item.onClick}
                    className={`w-full text-left text-sm font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                      isActive ? `${c.activeBg} ${c.text} ring-1 ring-current` : `${c.bg} text-slate-800`
                    }`}
                  >
                    {item.label}
                  </button>
                ) : (
                  <div className={`text-sm text-slate-700 px-3 py-2 rounded-lg ${c.bg}`}>
                    {item.label}
                  </div>
                )}

                {/* Children (articles, codes) */}
                {item.children.length > 0 && (
                  <div className="ml-4 mt-1 flex flex-wrap gap-1.5">
                    {item.children.map((child, ci) => (
                      child.onClick ? (
                        <button
                          key={ci}
                          onClick={child.onClick}
                          className={`text-xs ${c.text} ${c.bg} px-2 py-1 rounded cursor-pointer hover:underline`}
                        >
                          {child.label}
                        </button>
                      ) : (
                        <span key={ci} className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded">
                          {child.label}
                        </span>
                      )
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== Desktop horizontal branch ====================

function HorizontalBranch({
  branch,
  expanded,
  onToggle,
  direction,
  activeDetail,
}: {
  branch: BranchData;
  expanded: boolean;
  onToggle: () => void;
  direction: 'left' | 'right';
  activeDetail: DetailTarget | null;
}) {
  const c = BRANCH_COLORS[branch.color] || BRANCH_COLORS.blue;
  const isLeft = direction === 'left';

  return (
    <div className={`flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
      {/* Items expand outward */}
      {expanded && (
        <div className={`flex flex-col gap-2 ${isLeft ? 'items-end' : 'items-start'}`}>
          {branch.items.map(item => {
            const isActive =
              activeDetail &&
              ((activeDetail.type === 'violation' && item.id === `v-${activeDetail.data.id}`) ||
               (activeDetail.type === 'law' && item.id === `l-${activeDetail.data.id}`));

            return (
              <div key={item.id} className={`flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                {/* Third level: children expand further outward */}
                {item.children.length > 0 && (
                  <div className={`flex flex-col gap-1 ${isLeft ? 'items-end' : 'items-start'}`}>
                    {item.children.map((child, ci) => (
                      <div key={ci} className={`flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                        {child.onClick ? (
                          <button
                            onClick={child.onClick}
                            className={`text-sm ${c.text} hover:underline cursor-pointer px-2 py-0.5 rounded whitespace-nowrap`}
                          >
                            {child.label}
                          </button>
                        ) : (
                          <span className="text-sm text-slate-500 px-2 py-0.5 whitespace-nowrap">{child.label}</span>
                        )}
                        <div className={`w-5 h-0.5 ${c.line} shrink-0`}></div>
                      </div>
                    ))}
                  </div>
                )}

                {item.children.length > 0 && (
                  <div className={`w-4 h-0.5 ${c.line} shrink-0`}></div>
                )}

                {/* Item node */}
                {item.onClick ? (
                  <button
                    onClick={item.onClick}
                    className={`text-sm font-medium cursor-pointer px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                      isActive ? `${c.activeBg} ${c.text} ring-2 ring-offset-1 ring-current` : `${c.bg} text-slate-800`
                    }`}
                  >
                    {item.labelShort}
                  </button>
                ) : (
                  <span className={`text-sm text-slate-700 px-3 py-1.5 rounded-lg ${c.bg} whitespace-nowrap`}>
                    {item.labelShort}
                  </span>
                )}

                <div className={`w-5 h-0.5 ${c.line} shrink-0`}></div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && <div className={`w-4 h-0.5 ${c.line} shrink-0`}></div>}

      {/* Branch title node */}
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-base ${c.text} ${c.bg} border-2 border-current/20 cursor-pointer hover:shadow-sm transition-shadow shrink-0 whitespace-nowrap`}
      >
        <span className={`text-xs transition-transform duration-200 ${expanded ? (isLeft ? 'rotate-180' : '') : (isLeft ? '' : 'rotate-180')}`}>
          {isLeft ? '\u25C0' : '\u25B6'}
        </span>
        {branch.title}
      </button>

      <div className={`w-8 h-0.5 ${c.line} shrink-0`}></div>
    </div>
  );
}

// ==================== Inline Detail Panels ====================

function ViolationDetail({ violation, onClose }: { violation: MatchedViolation; onClose: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 sm:px-5 py-3 bg-red-50 border-b border-red-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-5 bg-red-500 rounded-full shrink-0"></span>
          <span className="text-sm font-bold text-red-800 truncate">违法行为详情</span>
          {violation.code && (
            <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded shrink-0">{violation.code}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Link
            href={`/violations/${violation.id}`}
            target="_blank"
            className="text-xs text-blue-600 hover:underline hidden sm:inline"
          >
            新窗口打开
          </Link>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg leading-none">&times;</button>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <p className="text-sm text-slate-800 font-medium leading-relaxed mb-3">{violation.description}</p>
        {violation.relevanceReason && (
          <p className="text-xs text-blue-600 mb-4 px-3 py-1.5 bg-blue-50 rounded-lg">
            关联原因: {violation.relevanceReason}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {violation.violationBasis && (
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100">
              <div className="text-xs font-bold text-blue-700 mb-1">
                违法依据 ·{' '}
                <Link
                  href={`/law/${violation.violationBasis.lawId}#article-search-${encodeURIComponent(violation.violationBasis.ref)}`}
                  target="_blank"
                  className="hover:underline"
                >
                  {violation.violationBasis.lawTitle} {violation.violationBasis.ref}
                </Link>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{violation.violationBasis.content || '暂无内容'}</p>
            </div>
          )}
          {violation.punishmentBasis && (
            <div className="p-3 bg-orange-50/60 rounded-lg border border-orange-100">
              <div className="text-xs font-bold text-orange-700 mb-1">
                处罚依据 ·{' '}
                <Link
                  href={`/law/${violation.punishmentBasis.lawId}#article-search-${encodeURIComponent(violation.punishmentBasis.ref)}`}
                  target="_blank"
                  className="hover:underline"
                >
                  {violation.punishmentBasis.lawTitle} {violation.punishmentBasis.ref}
                </Link>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{violation.punishmentBasis.content || '暂无内容'}</p>
            </div>
          )}
        </div>

        {/* Mobile: show link at bottom */}
        <div className="mt-3 sm:hidden">
          <Link
            href={`/violations/${violation.id}`}
            target="_blank"
            className="text-xs text-blue-600 hover:underline"
          >
            在新窗口查看完整详情
          </Link>
        </div>
      </div>
    </div>
  );
}

function LawDetail({
  law,
  fullData,
  loading,
  onClose,
}: {
  law: MatchedLaw;
  fullData: LawFullData | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 sm:px-5 py-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-5 bg-blue-500 rounded-full shrink-0"></span>
          <span className="text-sm font-bold text-blue-800 truncate">法规详情</span>
          {(fullData?.status || law.status) && (
            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
              (fullData?.status || law.status) === '现行有效' ? 'bg-green-100 text-green-700' :
              (fullData?.status || law.status) === '已废止' ? 'bg-red-100 text-red-600' :
              'bg-slate-100 text-slate-500'
            }`}>
              {fullData?.status || law.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Link
            href={`/law/${law.id}`}
            target="_blank"
            className="text-xs text-blue-600 hover:underline hidden sm:inline"
          >
            新窗口打开
          </Link>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg leading-none">&times;</button>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <div className="text-sm sm:text-base font-bold text-slate-800 mb-4">{fullData?.title || law.title}</div>

        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center text-slate-400">
            <span className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm">加载法规全文...</span>
          </div>
        )}

        {!loading && fullData && (
          <div className="space-y-0 border-t border-slate-100 max-h-[60vh] overflow-y-auto">
            {fullData.preamble && (
              <div className="py-3 border-b border-slate-100">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{fullData.preamble}</p>
              </div>
            )}

            {fullData.articles.map(article => (
              <div key={article.id} id={`article-${article.id}`} className="py-3 border-b border-slate-100 last:border-b-0">
                {article.chapter && (
                  <div className="text-sm font-bold text-slate-700 mb-1">{article.chapter}</div>
                )}
                {article.section && (
                  <div className="text-sm font-semibold text-slate-600 mb-1 pl-2">{article.section}</div>
                )}

                <div className="text-sm font-bold text-blue-800 mb-1">
                  第{article.title}条
                </div>

                {article.content && (
                  <p className="text-sm text-slate-700 leading-relaxed pl-2 sm:pl-4">{article.content}</p>
                )}

                {article.paragraphs.map(para => (
                  <div key={para.id} className="pl-2 sm:pl-4 mt-1">
                    <p className="text-sm text-slate-700 leading-relaxed">{para.content}</p>
                    {para.items.length > 0 && (
                      <div className="pl-2 sm:pl-4 mt-1 space-y-0.5">
                        {para.items.map(item => (
                          <p key={item.id} className="text-sm text-slate-600">
                            {item.number && <span className="text-slate-500">{item.number} </span>}
                            {item.content}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {!loading && !fullData && (
          <div className="text-sm text-slate-400 py-4 text-center">无法加载法规详情</div>
        )}

        {/* Mobile: show link at bottom */}
        <div className="mt-3 sm:hidden">
          <Link
            href={`/law/${law.id}`}
            target="_blank"
            className="text-xs text-blue-600 hover:underline"
          >
            在新窗口查看完整法规
          </Link>
        </div>
      </div>
    </div>
  );
}
