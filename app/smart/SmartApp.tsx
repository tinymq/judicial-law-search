'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SmartHeader from './SmartHeader';
import Mindmap from './Mindmap';
import LeftPanel from './LeftPanel';
import RightDetail from './RightDetail';
import type { HistoryEntry, ViolationEntry, MindNode, MindBranch, MindmapData, LawDetail, HotTag } from './data';

type Tab = 'history' | 'violations';

type Props = {
  initialQuery: string;
  hotTags: HotTag[];
  mindmapData: MindmapData;
  lawDetail: LawDetail | null;
  resultMeta: { lawCount: number; articleHitCount: number; violationCount: number; caseCount: number };
};

function findInitialArticleNo(lawDetail: LawDetail | null): string {
  if (!lawDetail) return '';
  for (const ch of lawDetail.chapters) {
    for (const sec of ch.sections) {
      const hit = sec.articles.find((a) => a.hit);
      if (hit) return hit.no;
    }
  }
  return lawDetail.chapters[0]?.sections[0]?.articles[0]?.no || '';
}

export default function SmartApp({ initialQuery, hotTags, mindmapData, lawDetail, resultMeta }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<'smart' | 'basic'>('smart');
  const [activeTab, setActiveTab] = useState<Tab>('violations');
  const [activeViolationId, setActiveViolationId] = useState('v1');
  const [activeArticle, setActiveArticle] = useState<string>(findInitialArticleNo(lawDetail));
  const [selectedMindNode, setSelectedMindNode] = useState<string>(
    mindmapData.branches.find((b) => b.id === 'law')?.nodes[0]?.id || ''
  );

  const goSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/smart?q=${encodeURIComponent(trimmed)}`);
  };

  const onSubmitSearch = () => {
    goSearch(query);
  };

  const onPickHistory = (h: HistoryEntry) => {
    setQuery(h.q);
    goSearch(h.q);
  };

  const onPickViolation = (v: ViolationEntry) => {
    setActiveViolationId(v.id);
  };

  const onSelectMindNode = (node: MindNode, branch: MindBranch) => {
    setSelectedMindNode(node.id);
    if (branch.id === 'violation') {
      setActiveTab('violations');
      setActiveViolationId(node.id);
    } else if (branch.id === 'law') {
      // 点击法规节点 → 用该法规名搜索（切换到该法规详情）
      setQuery(node.label);
      goSearch(node.label);
    }
    // case 分支点击：暂无联动（M3 引入 CaseCitation 后再做）
  };

  return (
    <div data-screen-label="01 法规智能查询">
      <SmartHeader
        query={query}
        setQuery={setQuery}
        onSubmit={onSubmitSearch}
        mode={mode}
        setMode={setMode}
      />

      {/* Hero with mindmap */}
      <section className="relative paper-grain">
        <div className="max-w-[1440px] mx-auto px-6 pt-5 pb-6">
          {/* Breadcrumb + summary */}
          <div className="flex items-start justify-between gap-6 mb-3">
            <div>
              <div className="mono text-[11px] text-ink-500 mb-1.5 flex items-center gap-1.5">
                <span>首页</span>
                <span>›</span>
                <span>智能查询</span>
                <span>›</span>
                <span className="text-zhu">查询结果</span>
              </div>
              <h1 className="font-serif text-[28px] font-bold text-ink-900 leading-tight flex items-baseline gap-3 flex-wrap">
                <span className="text-ink-500 text-[20px] font-normal">查询：</span>
                <span>&ldquo;{query}&rdquo;</span>
                <span className="mono text-[13px] text-ink-400 font-normal">
                  · 命中 {resultMeta.lawCount} 部法规 · {resultMeta.articleHitCount} 条命中条款
                </span>
              </h1>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-[12px] border border-paper-300 bg-white rounded hover:border-ink-500 text-ink-500"
              >
                导出
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-[12px] border border-paper-300 bg-white rounded hover:border-ink-500 text-ink-500"
              >
                分享
              </button>
            </div>
          </div>

          {/* Hot tags - 来自 Industry top-N */}
          {hotTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="mono text-[10px] text-ink-400 uppercase tracking-wider">热门行业</span>
              {hotTags.slice(0, 5).map((t) => (
                <button
                  type="button"
                  key={t.label}
                  onClick={() => {
                    setQuery(t.label);
                    goSearch(t.label);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                    query === t.label
                      ? 'bg-zhu text-white border-zhu'
                      : 'bg-white text-ink-500 border-paper-300 hover:border-zhu hover:text-zhu'
                  }`}
                >
                  {t.label}
                  <span className="mono ml-1.5 opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Mindmap canvas */}
          <div
            className="relative bg-white rounded-lg border border-paper-300 card-zhu"
            style={{ height: 420 }}
          >
            <div className="absolute top-3 left-4 z-10 flex items-center gap-1.5 text-[11px] text-ink-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <circle cx="12" cy="12" r="9" strokeDasharray="2 3" />
              </svg>
              <span className="font-serif font-bold text-ink-900">知识图谱</span>
              <span className="mono text-ink-400">/ knowledge graph</span>
            </div>
            <Mindmap data={mindmapData} onSelectNode={onSelectMindNode} selectedId={selectedMindNode} />
          </div>
        </div>
      </section>

      {/* Main split layout */}
      <section className="max-w-[1440px] mx-auto px-6 pb-8">
        <div className="flex gap-4" style={{ minHeight: 720 }}>
          <aside className="shrink-0" style={{ width: 200 }}>
            <LeftPanel
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onPickHistory={onPickHistory}
              onPickViolation={onPickViolation}
              activeViolationId={activeViolationId}
            />
          </aside>

          <main className="flex-1 min-w-0">
            <RightDetail
              query={query}
              activeArticle={activeArticle}
              setActiveArticle={setActiveArticle}
              law={lawDetail}
            />
          </main>
        </div>

        {/* Footer meta */}
        <div className="mt-4 flex items-center justify-between text-[11px] text-ink-400 mono">
          <span>Smart Search · Judicial Law Search v2.2 · {new Date().toISOString().slice(0, 10)}</span>
          <span>数据来自本地 dev.db · 区域白名单过滤</span>
        </div>
      </section>
    </div>
  );
}
