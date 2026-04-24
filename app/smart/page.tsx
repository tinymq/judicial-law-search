'use client';

import { useState } from 'react';
import SmartHeader from './SmartHeader';
import Mindmap from './Mindmap';
import LeftPanel from './LeftPanel';
import RightDetail from './RightDetail';
import { SAMPLE_QUERY, HOT_TAGS, MINDMAP } from './data';
import type { HistoryEntry, ViolationEntry, MindNode, MindBranch } from './data';

type Tab = 'history' | 'violations';

export default function SmartPage() {
  const [query, setQuery] = useState(SAMPLE_QUERY);
  const [mode, setMode] = useState<'smart' | 'basic'>('smart');
  const [activeTab, setActiveTab] = useState<Tab>('violations');
  const [activeViolationId, setActiveViolationId] = useState('v1');
  const [activeArticle, setActiveArticle] = useState('第三十四条');
  const [selectedMindNode, setSelectedMindNode] = useState('l1');

  const onSubmitSearch = () => {
    // M0：仅静态数据，搜索提交为 no-op；M1 会接 Prisma 查询
  };

  const onPickHistory = (h: HistoryEntry) => {
    setQuery(h.q);
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
      if (node.label.includes('§34')) setActiveArticle('第三十四条');
      else if (node.label.includes('§54')) setActiveArticle('第五十四条');
      else if (node.label.includes('§124')) setActiveArticle('第一百二十四条');
    }
  };

  return (
    <div data-screen-label="01 法规智能查询" className="min-h-screen">
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
                  · 命中 3 部法规 · 4 类违法行为 · 3 件类案
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

          {/* Hot tags */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="mono text-[10px] text-ink-400 uppercase tracking-wider">相似查询</span>
            {HOT_TAGS.slice(0, 5).map((t) => (
              <button
                type="button"
                key={t.label}
                onClick={() => setQuery(t.label)}
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
            <Mindmap data={MINDMAP} onSelectNode={onSelectMindNode} selectedId={selectedMindNode} />
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
            />
          </main>
        </div>

        {/* Footer meta */}
        <div className="mt-4 flex items-center justify-between text-[11px] text-ink-400 mono">
          <span>Smart Search · Judicial Law Search v2.2 · {new Date().toISOString().slice(0, 10)}</span>
          <span>数据更新于 2026-04-21 08:00 · 共 18,432 部法规</span>
        </div>
      </section>
    </div>
  );
}
