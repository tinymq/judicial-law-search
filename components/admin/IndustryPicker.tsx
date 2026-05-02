'use client';

import { useEffect, useState } from 'react';
import { getIndustryTree } from '@/app/admin/actions';

type IndustryLeaf = {
  id: number;
  code: string;
  name: string;
  parentCode: string | null;
  order: number;
};

type IndustryNode = IndustryLeaf & {
  children: IndustryLeaf[];
};

interface IndustryPickerProps {
  primaryIndustryId: number | null;
  secondaryIndustryIds: number[];
  onChange: (primary: number | null, secondary: number[]) => void;
}

export default function IndustryPicker({
  primaryIndustryId,
  secondaryIndustryIds,
  onChange,
}: IndustryPickerProps) {
  const [tree, setTree] = useState<IndustryNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Derived state: which level-1 and level-2 are selected for primary
  const [selectedL1Code, setSelectedL1Code] = useState<string>('');
  const [selectedL2Id, setSelectedL2Id] = useState<number | null>(null);

  // Secondary industry add state
  const [addingSecondary, setAddingSecondary] = useState(false);
  const [secL1Code, setSecL1Code] = useState<string>('');
  const [secL2Id, setSecL2Id] = useState<number | null>(null);

  useEffect(() => {
    getIndustryTree().then(data => {
      setTree(data);
      setLoading(false);
    });
  }, []);

  // When tree loads or primaryIndustryId changes, derive L1/L2 selection
  useEffect(() => {
    if (tree.length === 0 || primaryIndustryId === null) return;

    // Check if primaryIndustryId is a level-1
    const asL1 = tree.find(n => n.id === primaryIndustryId);
    if (asL1) {
      setSelectedL1Code(asL1.code);
      setSelectedL2Id(null);
      return;
    }

    // Check if it's a level-2
    for (const l1 of tree) {
      const l2 = l1.children.find(c => c.id === primaryIndustryId);
      if (l2) {
        setSelectedL1Code(l1.code);
        setSelectedL2Id(l2.id);
        return;
      }
    }
  }, [tree, primaryIndustryId]);

  const currentL1 = tree.find(n => n.code === selectedL1Code);
  const hasChildren = currentL1 && currentL1.children.length > 0;

  const handleL1Change = (code: string) => {
    setSelectedL1Code(code);
    setSelectedL2Id(null);
    const l1 = tree.find(n => n.code === code);
    if (!l1) {
      onChange(null, secondaryIndustryIds);
      return;
    }
    if (l1.children.length === 0) {
      onChange(l1.id, secondaryIndustryIds);
    } else {
      onChange(null, secondaryIndustryIds);
    }
  };

  const handleL2Change = (id: number | null) => {
    setSelectedL2Id(id);
    if (id) {
      onChange(id, secondaryIndustryIds);
    } else if (currentL1 && currentL1.children.length === 0) {
      onChange(currentL1.id, secondaryIndustryIds);
    } else {
      onChange(null, secondaryIndustryIds);
    }
  };

  const addSecondary = () => {
    const id = secL2Id || tree.find(n => n.code === secL1Code)?.id;
    if (!id || id === primaryIndustryId || secondaryIndustryIds.includes(id)) return;
    onChange(primaryIndustryId, [...secondaryIndustryIds, id]);
    setSecL1Code('');
    setSecL2Id(null);
    setAddingSecondary(false);
  };

  const removeSecondary = (id: number) => {
    onChange(primaryIndustryId, secondaryIndustryIds.filter(x => x !== id));
  };

  const findIndustryName = (id: number): string => {
    for (const l1 of tree) {
      if (l1.id === id) return l1.name;
      const l2 = l1.children.find(c => c.id === id);
      if (l2) return `${l1.name} > ${l2.name}`;
    }
    return `ID:${id}`;
  };

  if (loading) {
    return <div className="text-xs text-slate-400 py-2">加载行业分类...</div>;
  }

  const secL1Node = tree.find(n => n.code === secL1Code);

  return (
    <div className="space-y-3">
      {/* Primary industry */}
      <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
          执法领域（主领域）
        </label>
        <div className="grid grid-cols-2 gap-2">
          <select
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm"
            value={selectedL1Code}
            onChange={e => handleL1Change(e.target.value)}
          >
            <option value="">-- 选择一级领域 --</option>
            {tree.map(l1 => (
              <option key={l1.code} value={l1.code}>
                {l1.name}{l1.children.length > 0 ? ` (${l1.children.length}个子领域)` : ''}
              </option>
            ))}
          </select>

          {hasChildren && (
            <select
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm"
              value={selectedL2Id ?? ''}
              onChange={e => handleL2Change(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">-- 选择二级领域 --</option>
              {currentL1!.children.map(l2 => (
                <option key={l2.id} value={l2.id}>{l2.name}</option>
              ))}
            </select>
          )}
        </div>
        {selectedL1Code && !hasChildren && currentL1 && (
          <div className="text-xs text-slate-500 mt-1">
            已选: {currentL1.name}（无子领域）
          </div>
        )}
        {hasChildren && selectedL2Id && (
          <div className="text-xs text-emerald-600 mt-1">
            已选: {currentL1!.name} &gt; {currentL1!.children.find(c => c.id === selectedL2Id)?.name}
          </div>
        )}
        {hasChildren && !selectedL2Id && (
          <div className="text-xs text-amber-600 mt-1">
            请选择二级领域（或留空表示该一级领域下全部）
          </div>
        )}
      </div>

      {/* Secondary industries */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            附属领域（可选）
          </label>
          {!addingSecondary && (
            <button
              type="button"
              onClick={() => setAddingSecondary(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              + 添加
            </button>
          )}
        </div>

        {/* Existing secondary tags */}
        {secondaryIndustryIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {secondaryIndustryIds.map(id => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 text-xs"
              >
                {findIndustryName(id)}
                <button
                  type="button"
                  onClick={() => removeSecondary(id)}
                  className="text-indigo-400 hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add secondary form */}
        {addingSecondary && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                value={secL1Code}
                onChange={e => { setSecL1Code(e.target.value); setSecL2Id(null); }}
              >
                <option value="">-- 一级 --</option>
                {tree.map(l1 => (
                  <option key={l1.code} value={l1.code}>{l1.name}</option>
                ))}
              </select>
              {secL1Node && secL1Node.children.length > 0 && (
                <select
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                  value={secL2Id ?? ''}
                  onChange={e => setSecL2Id(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">-- 二级 --</option>
                  {secL1Node.children.map(l2 => (
                    <option key={l2.id} value={l2.id}>{l2.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addSecondary}
                disabled={!secL1Code}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                确认添加
              </button>
              <button
                type="button"
                onClick={() => { setAddingSecondary(false); setSecL1Code(''); setSecL2Id(null); }}
                className="px-3 py-1 bg-slate-200 text-slate-600 rounded text-xs font-medium hover:bg-slate-300"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
