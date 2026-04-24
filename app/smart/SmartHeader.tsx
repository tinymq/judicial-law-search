'use client';

import Link from 'next/link';

type Props = {
  query: string;
  setQuery: (q: string) => void;
  onSubmit: () => void;
  mode: 'smart' | 'basic';
  setMode: (m: 'smart' | 'basic') => void;
};

export default function SmartHeader({ query, setQuery, onSubmit, mode, setMode }: Props) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-paper-300">
      <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded flex items-center justify-center bg-zhu text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-serif font-bold text-[15px] text-ink-900">执法监督法规查</div>
            <div className="mono text-[9px] text-ink-400 tracking-wider">JUDICIAL LAW SEARCH · v2.2</div>
          </div>
        </Link>

        {/* Search form */}
        <form
          className="flex-1 max-w-2xl relative"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="描述你遇到的情况，例如：超市买到过期食品..."
            className="w-full pl-9 pr-24 py-1.5 bg-paper-100 border border-paper-300 rounded-md text-[13px] focus:bg-white focus:border-zhu outline-none transition-all font-sans"
          />
          <div className="absolute inset-y-0 right-1 flex items-center">
            <div className="toggle-pill">
              <button
                type="button"
                onClick={() => setMode('basic')}
                className={mode === 'basic' ? 'on' : ''}
              >
                常规
              </button>
              <button
                type="button"
                onClick={() => setMode('smart')}
                className={mode === 'smart' ? 'on' : ''}
              >
                智能
              </button>
            </div>
          </div>
        </form>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className="text-[12px] text-ink-500 hover:text-zhu transition-colors"
          >
            常规搜索
          </Link>
          <span className="text-paper-300">·</span>
          <Link
            href="/enforcement"
            className="text-[12px] text-ink-500 hover:text-zhu transition-colors"
          >
            执法事项
          </Link>
          <span className="text-paper-300">·</span>
          <Link
            href="/admin/laws"
            target="_blank"
            className="text-[12px] text-ink-500 hover:text-zhu transition-colors"
          >
            后台
          </Link>
        </div>
      </div>

      {/* Custom toggle pill styles */}
      <style jsx>{`
        .toggle-pill {
          display: inline-flex;
          padding: 3px;
          border-radius: 999px;
          background: var(--paper-200, #efece7);
          border: 1px solid var(--paper-300, #e8e6e3);
        }
        .toggle-pill button {
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 11px;
          color: var(--ink-500, #6b6b6b);
          font-weight: 500;
          transition: all 0.2s;
          cursor: pointer;
        }
        .toggle-pill button.on {
          background: #fff;
          color: var(--ink-900, #1a1a1a);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
        }
      `}</style>
    </header>
  );
}
