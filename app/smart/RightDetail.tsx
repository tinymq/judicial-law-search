'use client';

import { Fragment, useState } from 'react';
import type { LawDetail } from './data';

type Props = {
  query: string;
  activeArticle: string;
  setActiveArticle: (a: string) => void;
  law: LawDetail | null;
};

export default function RightDetail({ query, activeArticle, setActiveArticle, law }: Props) {
  const [showCites, setShowCites] = useState(true);

  if (!law) {
    return (
      <div className="h-full flex flex-col bg-white border border-paper-300 rounded-lg overflow-hidden card-zhu items-center justify-center">
        <div className="text-center p-8">
          <div className="mono text-[11px] text-ink-400 mb-2">NO MATCH</div>
          <div className="font-serif text-[18px] text-ink-700 mb-2">未找到命中的法规</div>
          <div className="text-[12px] text-ink-500">
            试试：「{query}」换个关键词，或切换到
            <a href="/" className="text-zhu hover:text-zhu-700 underline underline-offset-2 mx-1">常规搜索</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white border border-paper-300 rounded-lg overflow-hidden card-zhu">
      {/* Sticky header: law meta */}
      <div className="px-6 pt-5 pb-4 border-b border-paper-300 bg-gradient-to-b from-paper-50 to-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-full zhu-hatch opacity-40 pointer-events-none"></div>
        <div className="flex items-start justify-between gap-4 relative">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-semibold bg-zhu-100 text-zhu border border-zhu-200">
                {law.level}
              </span>
              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-semibold bg-[rgba(74,122,85,.1)] text-[#4a7a55] border border-[rgba(74,122,85,.2)]">
                {law.status}
              </span>
              <span className="mono text-[10px] text-ink-400">LAW ID #{law.id}</span>
            </div>
            <h1 className="font-serif text-[22px] font-bold text-ink-900 leading-tight">{law.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-500">
              <span>{law.authority}</span>
              <span className="text-paper-300">│</span>
              <span className="mono">{law.docNumber}</span>
              <span className="text-paper-300">│</span>
              <span>{law.promulgated} 公布</span>
              <span className="text-paper-300">│</span>
              <span>{law.effective} 施行</span>
            </div>
            <div className="mt-1 text-[11px] text-ochre flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              最新修订：{law.revised}
            </div>
          </div>
          <div className="shrink-0 flex flex-col gap-2">
            <button type="button" className="px-3 py-1.5 text-[11px] bg-zhu text-white rounded hover:bg-zhu-700 font-semibold">
              打开全文
            </button>
            <button type="button" className="px-3 py-1.5 text-[11px] border border-paper-300 text-ink-500 rounded hover:border-ink-500">
              收藏
            </button>
          </div>
        </div>

        {/* Match stats row */}
        <div className="mt-4 flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5 bg-white border border-paper-300 rounded-md px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zhu"></span>
            <span className="text-ink-500">命中条款</span>
            <span className="mono font-bold text-zhu">03</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-paper-300 rounded-md px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-ochre"></span>
            <span className="text-ink-500">关键词</span>
            <span className="mono text-ink-900">&ldquo;{query}&rdquo;</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-paper-300 rounded-md px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sage"></span>
            <span className="text-ink-500">相关违法行为</span>
            <span className="mono font-bold text-ink-900">{law.related.length}</span>
          </div>
        </div>
      </div>

      {/* Body: article tree + side panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Article tree */}
        <div className="flex-1 overflow-y-auto scroll-thin p-6 art-tree">
          {law.chapters.map((ch) => (
            <div key={ch.id} className="mb-6">
              <div className="sticky top-0 bg-white z-10 pb-2 pt-1 -mx-2 px-2 border-b border-paper-300 mb-3">
                <h2 className="font-serif font-bold text-[15px] text-ink-900 flex items-center gap-2">
                  <span className="w-1 h-4 bg-zhu rounded-sm"></span>
                  {ch.name}
                </h2>
              </div>
              {ch.sections.map((sec) => (
                <div key={sec.id} className="mb-4">
                  {sec.name && (
                    <h3 className="font-serif text-[13px] font-semibold text-ink-500 mb-2 ml-3">{sec.name}</h3>
                  )}
                  {sec.articles.map((art) => {
                    const isActive = activeArticle === art.no;
                    return (
                      <div
                        key={art.no}
                        onClick={() => setActiveArticle(art.no)}
                        className={`art-item rounded-md mb-3 ml-2 p-3 cursor-pointer transition-all ${
                          isActive ? 'active' : art.hit ? 'has-hit' : ''
                        } ${isActive ? '' : 'hover:bg-paper-50'}`}
                      >
                        <div className="flex items-baseline gap-3 mb-2">
                          <span className="font-serif font-bold text-zhu text-[14px]">{art.no}</span>
                          <span className="text-ink-500 text-[12.5px]">{art.title}</span>
                          {art.hit && (
                            <span className="ml-auto mono text-[9px] text-zhu bg-zhu-100 border border-zhu-200 px-1.5 py-0.5 rounded">
                              命中 ·{art.keyword.length}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5 text-[13px] leading-7 text-ink-700 font-serif">
                          {art.items.map((txt, i) => (
                            <p key={i} className="pl-2">
                              {highlight(txt, art.keyword)}
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}

          <div className="mt-6 text-center py-6 border-t border-dashed border-paper-300">
            <p className="text-[11px] text-ink-400 mono">—— 仅显示命中章节摘要，共 151 条 ——</p>
            <button type="button" className="mt-2 text-[12px] text-zhu hover:text-zhu-700 font-semibold">
              查看完整法规 →
            </button>
          </div>
        </div>

        {/* Right-side related rail */}
        <aside className="w-64 shrink-0 border-l border-paper-300 bg-paper-50/60 overflow-y-auto scroll-thin">
          <div className="p-4 border-b border-paper-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-serif text-[13px] font-bold text-ink-900">关联违法行为</h3>
              <span className="mono text-[10px] text-ink-400">{law.related.length}</span>
            </div>
            <div className="space-y-2">
              {law.related.map((r, i) => (
                <button
                  type="button"
                  key={i}
                  className="w-full text-left p-2 rounded bg-white border border-paper-300 hover:border-zhu transition-colors group"
                >
                  <div className="text-[12px] text-ink-900 leading-snug group-hover:text-zhu">{r.name}</div>
                  <div className="mt-1 flex items-center justify-between text-[10px]">
                    <span className="mono text-ink-400">类案 {r.cases}</span>
                    <span className="text-zhu opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-serif text-[13px] font-bold text-ink-900">引用的其他法规</h3>
              <button
                type="button"
                onClick={() => setShowCites(!showCites)}
                className="mono text-[10px] text-ink-400 hover:text-ink-900"
              >
                {showCites ? '收起' : '展开'}
              </button>
            </div>
            {showCites && (
              <div className="space-y-2">
                {law.cites.map((c, i) => (
                  <div key={i} className="p-2 rounded border border-paper-300 bg-white">
                    <div className="text-[12px] text-ink-900 font-semibold">{c.name}</div>
                    <div className="text-[10px] text-ink-500 mt-0.5">{c.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-paper-300">
            <h3 className="font-serif text-[13px] font-bold text-ink-900 mb-2">时间线</h3>
            <div className="space-y-2 text-[11px]">
              <TimelineDot date="1995.10" label="首次制定《食品卫生法》" />
              <TimelineDot date="2009.06" label="《食品安全法》首次颁布" />
              <TimelineDot date="2015.10" label="修订施行（现行版本）" primary />
              <TimelineDot date="2018.12" label="第一次修正" />
              <TimelineDot date="2021.04" label="第二次修正" primary />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TimelineDot({ date, label, primary }: { date: string; label: string; primary?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-col items-center pt-1">
        <div className={`w-2 h-2 rounded-full ${primary ? 'bg-zhu' : 'bg-paper-300'}`}></div>
        <div className="w-px h-5 bg-paper-300"></div>
      </div>
      <div className="-mt-0.5">
        <div className="mono text-[10px] text-ink-500">{date}</div>
        <div className={`text-[11px] ${primary ? 'text-ink-900 font-semibold' : 'text-ink-500'}`}>{label}</div>
      </div>
    </div>
  );
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text: string, keywords: string[]) {
  if (!keywords || !keywords.length) return text;
  const re = new RegExp(`(${keywords.map(escapeReg).join('|')})`, 'g');
  const split = text.split(re);
  return split.map((seg, i) => {
    if (keywords.includes(seg)) return <mark key={i} className="hit">{seg}</mark>;
    return <Fragment key={i}>{seg}</Fragment>;
  });
}
