'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Law {
  id: number;
  title: string;
  level: string | null;
  issuingAuthority: string | null;
}

interface Props {
  enforcementItemId: number;
  linkedLaws: Law[];
  primaryLawId: number | null;
}

export default function LinkLawEditor({ enforcementItemId, linkedLaws, primaryLawId }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Law[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPrimaryId, setCurrentPrimaryId] = useState(primaryLawId);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // 防抖搜索
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/laws/search?q=${encodeURIComponent(query)}&limit=8`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  async function handleSelect(lawId: number) {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/enforcement/${enforcementItemId}/link-law`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lawId }),
      });
      if (res.ok) {
        setCurrentPrimaryId(lawId);
        setMessage('已关联，刷新页面查看完整效果');
        setIsEditing(false);
        setQuery('');
        setResults([]);
      } else {
        const err = await res.json();
        setMessage(`失败: ${err.error}`);
      }
    } catch {
      setMessage('网络错误');
    }
    setSaving(false);
  }

  async function handleUnlink() {
    setSaving(true);
    try {
      const res = await fetch(`/api/enforcement/${enforcementItemId}/link-law`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lawId: null }),
      });
      if (res.ok) {
        setCurrentPrimaryId(null);
        setMessage('已取消关联，刷新页面查看');
        setIsEditing(false);
      }
    } catch {
      setMessage('网络错误');
    }
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-800">
          关联法规
          {linkedLaws.length > 0 && (
            <span className="text-sm font-normal text-slate-400 ml-2">{linkedLaws.length} 部</span>
          )}
        </h2>
        <button
          onClick={() => { setIsEditing(!isEditing); setMessage(''); }}
          className="text-sm text-slate-400 hover:text-blue-600 transition-colors"
        >
          {isEditing ? '取消' : '修改关联'}
        </button>
      </div>

      {/* 编辑区域 */}
      {isEditing && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="输入法规名称搜索..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none"
              disabled={saving}
            />
            {searching && (
              <span className="absolute right-3 top-2.5 text-xs text-slate-400">搜索中...</span>
            )}
          </div>
          {results.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
              {results.map(law => (
                <button
                  key={law.id}
                  onClick={() => handleSelect(law.id)}
                  disabled={saving}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <div className="text-sm font-medium text-slate-800">{law.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {law.level}{law.issuingAuthority ? ` · ${law.issuingAuthority}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
          {query.length >= 2 && !searching && results.length === 0 && (
            <div className="mt-2 text-sm text-slate-400 text-center py-2">未找到匹配法规</div>
          )}
          {currentPrimaryId && (
            <button
              onClick={handleUnlink}
              disabled={saving}
              className="mt-2 text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              取消当前关联
            </button>
          )}
        </div>
      )}

      {message && (
        <div className="mb-3 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">{message}</div>
      )}

      {/* 法规列表 */}
      {linkedLaws.length > 0 ? (
        <div className="space-y-2">
          {linkedLaws.map(law => (
            <Link
              key={law.id}
              href={`/law/${law.id}`}
              className="block rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm p-4 transition-all"
            >
              <div className="text-base font-semibold text-slate-800 hover:text-blue-600 transition-colors">
                {law.title}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-400">
                {law.level && <span>{law.level}</span>}
                {law.issuingAuthority && (
                  <>
                    <span className="text-slate-200">·</span>
                    <span>{law.issuingAuthority}</span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-400 text-center py-4">
          暂无关联法规，点击"修改关联"手动添加
        </div>
      )}
    </div>
  );
}
