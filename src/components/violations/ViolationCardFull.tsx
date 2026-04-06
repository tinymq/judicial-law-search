'use client';

import Link from 'next/link';
import { useState } from 'react';

interface ViolationBasis {
  ref: string;
  content: string;
}

interface ViolationCardFullProps {
  violation: {
    id: number;
    code: string | null;
    description: string;
    violationBasis: ViolationBasis | null;
    punishmentBasis: ViolationBasis | null;
  };
  query?: string;
}

function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

export default function ViolationCardFull({ violation, query }: ViolationCardFullProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (type: 'violation' | 'punishment') => {
    const basis = type === 'violation' ? violation.violationBasis : violation.punishmentBasis;
    if (!basis) return;
    const label = type === 'violation' ? '违法依据' : '处罚依据';
    const text = `${label} ${basis.ref}\n${basis.content}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <summary className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors list-none [&::-webkit-details-marker]:hidden">
        <span className="mt-0.5 text-slate-400 transition-transform group-open:rotate-90">&#9656;</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{violation.code || '未编号'}</span>
            {violation.violationBasis && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">违法 {violation.violationBasis.ref}</span>
            )}
            {violation.punishmentBasis && (
              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">处罚 {violation.punishmentBasis.ref}</span>
            )}
          </div>
          <p className="text-lg text-slate-800 leading-relaxed">
            <Highlight text={violation.description} query={query} />
          </p>
        </div>
      </summary>
      <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/50">
        {violation.violationBasis && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-blue-700">违法依据 · {violation.violationBasis.ref}</div>
              <button
                onClick={() => handleCopy('violation')}
                className="text-xs text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
              >
                {copied === 'violation' ? '已复制' : '复制'}
              </button>
            </div>
            <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap font-serif">{violation.violationBasis.content || '暂无内容'}</p>
          </div>
        )}
        {violation.punishmentBasis && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-orange-700">处罚依据 · {violation.punishmentBasis.ref}</div>
              <button
                onClick={() => handleCopy('punishment')}
                className="text-xs text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
              >
                {copied === 'punishment' ? '已复制' : '复制'}
              </button>
            </div>
            <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap font-serif">{violation.punishmentBasis.content || '暂无内容'}</p>
          </div>
        )}
        <div className="flex justify-end">
          <Link href={`/violations/${violation.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            查看详情 →
          </Link>
        </div>
      </div>
    </details>
  );
}
