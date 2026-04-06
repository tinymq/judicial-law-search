'use client'

import { useState, useEffect } from 'react';

interface TocItem {
  title: string;
  id: string;
  level: 'chapter' | 'section' | 'article';
  children?: TocItem[];
}

interface TableOfContentsProps {
  toc: TocItem[];
}

export default function TableOfContents({ toc }: TableOfContentsProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  // 切换单个项目的展开/收起
  const toggleItem = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // 展开/收起全部
  const toggleAll = () => {
    if (allExpanded) {
      setExpandedItems(new Set());
      setAllExpanded(false);
    } else {
      const allIds = new Set(toc.map(item => item.id));
      setExpandedItems(allIds);
      setAllExpanded(true);
    }
  };

  // 当 toc 变化时重置状态
  useEffect(() => {
    setExpandedItems(new Set());
    setAllExpanded(false);
  }, [toc]);

  // 递归渲染目录项
  const renderTocItem = (item: TocItem, depth: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const isChapter = item.level === 'chapter';
    const isSection = item.level === 'section';
    const isArticle = item.level === 'article';

    // 根据层级设置样式
    const baseClasses = "w-full text-left rounded-lg transition-all border-l-2 leading-tight flex items-center justify-between group";
    let sizeClasses = "";
    let colorClasses = "";

    if (isChapter) {
      sizeClasses = "px-3 py-2 text-sm font-semibold";
      colorClasses = isExpanded
        ? "text-blue-600 bg-blue-50 border-blue-400"
        : "text-slate-700 border-transparent hover:text-blue-600 hover:bg-blue-50 hover:border-blue-400";
    } else if (isSection) {
      sizeClasses = "px-3 py-1.5 text-sm font-medium";
      colorClasses = isExpanded
        ? "text-blue-600 bg-blue-50 border-blue-400"
        : "text-slate-600 border-transparent hover:text-blue-600 hover:bg-blue-50 hover:border-blue-300";
    } else {
      sizeClasses = "px-3 py-1 text-sm";
      colorClasses = "text-slate-600 border-transparent hover:text-blue-600 hover:bg-blue-50 hover:border-blue-300";
    }

    return (
      <div key={item.id} className={depth > 0 ? "ml-4" : "mb-2"}>
        {hasChildren ? (
          // 有子项的章节/节
          <button
            onClick={() => toggleItem(item.id)}
            className={`${baseClasses} ${sizeClasses} ${colorClasses}`}
          >
            <span>{item.title}</span>
            <svg
              className={`w-4 h-4 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        ) : (
          // 没有子项的条，使用链接
          <a
            href={`#${item.id}`}
            className={`${baseClasses} ${sizeClasses} ${colorClasses}`}
          >
            <span>{item.title}</span>
          </a>
        )}
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-0.5">
            {item.children!.map(child => renderTocItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (toc.length === 0) {
    return (
      <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 custom-scrollbar">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">目录导航</h3>
        <p className="text-sm text-slate-400 px-3 italic">此法规未划分章节</p>
      </div>
    );
  }

  return (
    <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 custom-scrollbar">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">目录导航</h3>
        <button
          onClick={toggleAll}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          {allExpanded ? '收起全部' : '展开全部'}
        </button>
      </div>
      <nav className="space-y-1">
        {toc.map(item => renderTocItem(item))}
      </nav>
    </div>
  );
}
