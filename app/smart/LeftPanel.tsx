'use client';

import { HISTORY, VIOLATIONS } from './data';
import type { HistoryEntry, ViolationEntry, Severity } from './data';

type Tab = 'history' | 'violations';

type Props = {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  onPickHistory: (h: HistoryEntry) => void;
  onPickViolation: (v: ViolationEntry) => void;
  activeViolationId: string;
};

export default function LeftPanel({
  activeTab,
  setActiveTab,
  onPickHistory,
  onPickViolation,
  activeViolationId,
}: Props) {
  return (
    <div className="h-full flex flex-col bg-white border border-paper-300 rounded-lg overflow-hidden card-zhu">
      {/* Tab header */}
      <div className="flex items-center border-b border-paper-300 bg-paper-50 relative">
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-3 py-3 text-[13px] font-semibold transition-colors relative ${
            activeTab === 'history' ? 'text-zhu' : 'text-ink-500 hover:text-ink-900'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            历史查询
            <span className="mono text-[10px] text-ink-400">{HISTORY.length}</span>
          </span>
        </button>
        <div className="w-px h-6 bg-paper-300"></div>
        <button
          type="button"
          onClick={() => setActiveTab('violations')}
          className={`flex-1 px-3 py-3 text-[13px] font-semibold transition-colors relative ${
            activeTab === 'violations' ? 'text-zhu' : 'text-ink-500 hover:text-ink-900'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            违法行为
            <span className="mono text-[10px] text-ink-400">{VIOLATIONS.length}</span>
          </span>
        </button>
        <div
          className="absolute bottom-0 h-0.5 bg-zhu tab-indicator"
          style={{ width: '50%', transform: `translateX(${activeTab === 'history' ? 0 : 100}%)` }}
        ></div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-thin">
        {activeTab === 'history' ? (
          <HistoryList onPick={onPickHistory} />
        ) : (
          <ViolationList onPick={onPickViolation} activeId={activeViolationId} />
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-paper-300 bg-paper-50 flex items-center justify-between text-[11px] text-ink-500">
        {activeTab === 'history' ? (
          <>
            <span className="mono">本月 87 次查询</span>
            <button type="button" className="text-zhu hover:text-zhu-700">清空 →</button>
          </>
        ) : (
          <>
            <span className="mono">按关联法规数排序</span>
            <button type="button" className="text-zhu hover:text-zhu-700">全部 →</button>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryList({ onPick }: { onPick: (h: HistoryEntry) => void }) {
  const today = HISTORY.filter((h) => h.t.startsWith('2026-04-21'));
  const earlier = HISTORY.filter((h) => !h.t.startsWith('2026-04-21'));

  const Item = ({ h }: { h: HistoryEntry }) => (
    <button
      type="button"
      onClick={() => onPick(h)}
      className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors ${
        h.active
          ? 'border-zhu bg-zhu-50'
          : 'border-transparent hover:bg-paper-50 hover:border-paper-300'
      }`}
    >
      <div className={`text-[12.5px] leading-snug ${h.active ? 'text-ink-900 font-semibold' : 'text-ink-900'}`}>
        {h.q}
      </div>
      <div className="flex items-center justify-between mt-1 mono text-[10px]">
        <span className="text-ink-400">{h.t.split(' ')[1]}</span>
        <span className={h.active ? 'text-zhu' : 'text-ink-400'}>{h.hits} 结果</span>
      </div>
    </button>
  );

  return (
    <div className="py-1">
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-ink-400 mono uppercase tracking-wider">
        今天 · 04/21
      </div>
      {today.map((h, i) => <Item key={`t-${i}`} h={h} />)}
      <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-ink-400 mono uppercase tracking-wider">
        更早
      </div>
      {earlier.map((h, i) => <Item key={`e-${i}`} h={h} />)}
    </div>
  );
}

function severityColor(s: Severity) {
  if (s === '高') return { c: '#c8302b', bg: 'rgba(200,48,43,.1)' };
  if (s === '中') return { c: '#b57d28', bg: 'rgba(181,125,40,.1)' };
  return { c: '#4a7a55', bg: 'rgba(74,122,85,.1)' };
}

function ViolationList({
  onPick,
  activeId,
}: {
  onPick: (v: ViolationEntry) => void;
  activeId: string;
}) {
  return (
    <div>
      {VIOLATIONS.map((v) => {
        const isActive = activeId ? v.id === activeId : !!v.active;
        const sc = severityColor(v.severity);
        return (
          <button
            type="button"
            key={v.id}
            onClick={() => onPick(v)}
            className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors ${
              isActive ? 'border-zhu bg-zhu-50' : 'border-transparent hover:bg-paper-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`text-[12.5px] leading-snug flex-1 ${isActive ? 'font-semibold text-ink-900' : 'text-ink-900'}`}>
                {v.name}
              </div>
              <span
                className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold mono"
                style={{ background: sc.bg, color: sc.c }}
              >
                {v.severity}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-ink-400">{v.industry}</span>
              <span className={`mono text-[10px] ${isActive ? 'text-zhu' : 'text-ink-500'}`}>
                {v.laws} 部法规 →
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
