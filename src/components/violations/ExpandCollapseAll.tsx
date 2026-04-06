'use client';

import { useState } from 'react';

export default function ExpandCollapseAll() {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    const details = document.querySelectorAll('main details');
    const next = !expanded;
    details.forEach(d => {
      (d as HTMLDetailsElement).open = next;
    });
    setExpanded(next);
  };

  return (
    <button
      onClick={toggle}
      className="text-xs text-slate-500 hover:text-blue-600 border border-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
    >
      {expanded ? '全部收起' : '全部展开'}
    </button>
  );
}
