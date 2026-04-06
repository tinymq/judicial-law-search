'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type PrototypeTocItem = {
  title: string;
  id: string;
  level: 'chapter' | 'section' | 'article';
  children?: PrototypeTocItem[];
};

function collectExpandableIds(items: PrototypeTocItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      ids.push(item.id);
      ids.push(...collectExpandableIds(item.children));
    }
  }
  return ids;
}

export default function PrototypeToc({ toc }: { toc: PrototypeTocItem[] }) {
  const [isOpen, setIsOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const expandableIds = useMemo(() => collectExpandableIds(toc), [toc]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('pointerdown', onPointerDown);
    }

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen]);

  const toggleItem = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(expandableIds));
  const collapseAll = () => setExpanded(new Set());

  const renderItems = (items: PrototypeTocItem[], depth = 0) => (
    <div className={depth === 0 ? 'space-y-3' : 'mt-2 space-y-2'}>
      {items.map((item) => {
        const hasChildren = !!item.children?.length;
        const isExpanded = expanded.has(item.id);

        if (!hasChildren) {
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => setIsOpen(false)}
              className={`block rounded-xl px-3 py-2 transition hover:bg-slate-50 ${
                item.level === 'article' ? 'text-sm text-slate-600' : 'text-slate-700'
              }`}
            >
              {item.title}
            </a>
          );
        }

        return (
          <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-2 py-2">
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm font-semibold text-slate-900 hover:bg-white"
            >
              <span>{item.title}</span>
              <span className={`text-slate-400 transition ${isExpanded ? 'rotate-180' : ''}`}>⌄</span>
            </button>
            {isExpanded && (
              <div className={depth === 0 ? 'mt-2 ml-2 border-l border-slate-200 pl-3' : 'mt-2 ml-1 border-l border-slate-100 pl-3'}>
                {renderItems(item.children!, depth + 1)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 ${
          isOpen ? 'mb-3' : ''
        }`}
      >
        <span>条款目录</span>
        <span className={`text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {isOpen && (
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_20px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="text-base font-semibold text-slate-900">条款目录</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={expandAll} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                展开全部
              </button>
              <button type="button" onClick={collapseAll} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                收起全部
              </button>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
            {renderItems(toc)}
          </div>
        </div>
      )}
    </div>
  );
}
