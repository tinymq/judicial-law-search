'use client'

import { updateLaw, deleteLaw } from '../actions';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import 'react-resizable/css/styles.css';
import {
  LEVEL_OPTIONS,
  STATUS_OPTIONS,
  REGION_OPTIONS
} from '@/src/lib/category-config';
import ResizableHeader from './ResizableHeader';

interface LawItem {
  id: number;
  title: string;
  issuingAuthority: string | null;
  documentNumber: string | null;
  promulgationDate: string | Date | null;
  effectiveDate: string | Date | null;
  status: string | null;
  level: string;
  region: string | null;
}

interface LawTableProps {
  laws: LawItem[];
  currentSort: string;
  currentOrder: 'asc' | 'desc';
  searchParams?: Record<string, string>;
}

export default function LawTable({ laws, currentSort, currentOrder, searchParams = {} }: LawTableProps) {
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  const handleUpdateLaw = async (id: number, data: Record<string, unknown>) => {
    try {
      await updateLaw(id, data);
      showToast('已保存');
    } catch {
      showToast('保存失败', 'error');
    }
  };

  // 列宽状态管理 - 使用 ref 优化性能，避免每次拖拽都重新渲染
  // 方案2+3：重新分配列宽，重要列（标题、操作）更宽敞
  const columnWidthsRef = useRef<Record<string, number>>({
    title: 320,
    level: 80,
    region: 80,
    status: 80,
    issuingAuthority: 120,
    documentNumber: 100,
    promulgationDate: 100,
    effectiveDate: 100,
    actions: 130,
  });

  const handleSort = (field: string) => {
    const newOrder = field === currentSort && currentOrder === 'asc' ? 'desc' : 'asc';
    const params = new URLSearchParams();
    // 保留所有现有筛选参数
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value && key !== 'sort' && key !== 'order') {
        params.set(key, value);
      }
    });
    params.set('sort', field);
    params.set('order', newOrder);
    router.push(`/admin/laws?${params.toString()}`);
  };

  const formatDateForInput = (date: string | Date | null | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const SortIcon = ({ field }: { field: string }) => {
    const isActive = field === currentSort;
    const isAsc = isActive && currentOrder === 'asc';

    return (
      <svg
        className={`inline-block ml-1 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
        style={{
          transform: isAsc ? 'rotate(180deg)' : 'none',
          width: '10px',
          height: '10px'
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M6 9l6 6 6-6"/>
      </svg>
    );
  };

  // 处理列宽调整 - 优化性能，直接操作 DOM
  const handleColumnResize = (column: string, _e: unknown, { size }: { size: { width: number } }) => {
    // 更新 ref
    columnWidthsRef.current[column] = size.width;

    // 直接更新 DOM，不触发重新渲染
    const thElements = document.querySelectorAll(`[data-column="${column}"]`);
    thElements.forEach((el) => {
      (el as HTMLElement).style.width = `${size.width}px`;
    });
  };

  // 获取当前列宽
  const getColumnWidth = (column: string) => {
    return columnWidthsRef.current[column];
  };

  return (
    <div className="space-y-4">
      {/* Toast 提示 */}
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* 移动端卡片视图 */}
      <div className="md:hidden space-y-3">
        {laws.map((law) => (
            <div key={law.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Link href={`/law/${law.id}`} target="_blank" className="font-bold text-slate-900 hover:text-blue-600 text-sm leading-snug flex-1">
                  {law.title}
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => router.push(`/admin/edit/${law.id}`)}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-xs font-semibold"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => confirm('确定要删除吗？') && deleteLaw(law.id)}
                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-medium">
                  {law.level}
                </span>
                {law.region && law.region !== '全国' && (
                  <span className="bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded border border-teal-100">
                    {law.region}
                  </span>
                )}
                <span className={`px-1.5 py-0.5 rounded font-medium ${
                  law.status === '现行有效' ? 'bg-green-50 text-green-600' :
                  law.status === '已废止' ? 'bg-red-50 text-red-500' :
                  law.status === '已被修改' ? 'bg-amber-50 text-amber-600' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {law.status || '暂无'}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                {law.issuingAuthority && <span className="truncate max-w-[120px]">{law.issuingAuthority}</span>}
                {law.promulgationDate && <span>{formatDateForInput(law.promulgationDate)}</span>}
              </div>
            </div>
          ))}
      </div>

      {/* 桌面端表格容器 */}
      <div className="hidden md:block border border-slate-200 rounded-xl shadow-sm bg-white overflow-hidden">
        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 150px)' }}>
          <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed', minWidth: '1110px' }}>
            <thead className="bg-slate-50">
              <tr className="border-b-2 border-slate-200">
                <ResizableHeader
                  width={getColumnWidth('title')}
                  onResize={(e, data) => handleColumnResize('title', e, data)}
                  dataKey="title"
                  stickyLeft
                >
                  法规标题
                </ResizableHeader>
                <ResizableHeader
                  width={getColumnWidth('level')}
                  onResize={(e, data) => handleColumnResize('level', e, data)}
                  dataKey="level"
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('level')}
                >
                  位阶<SortIcon field="level" />
                </ResizableHeader>
                <ResizableHeader
                  width={getColumnWidth('region')}
                  onResize={(e, data) => handleColumnResize('region', e, data)}
                  dataKey="region"
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('region')}
                >
                  区域<SortIcon field="region" />
                </ResizableHeader>
                <ResizableHeader
                  width={getColumnWidth('status')}
                  onResize={(e, data) => handleColumnResize('status', e, data)}
                  dataKey="status"
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('status')}
                >
                  时效性<SortIcon field="status" />
                </ResizableHeader>
                <ResizableHeader
                  width={getColumnWidth('issuingAuthority')}
                  onResize={(e, data) => handleColumnResize('issuingAuthority', e, data)}
                  dataKey="issuingAuthority"
                >
                  制定机关
                </ResizableHeader>
                <ResizableHeader
                  width={getColumnWidth('documentNumber')}
                  onResize={(e, data) => handleColumnResize('documentNumber', e, data)}
                  dataKey="documentNumber"
                >
                  发文字号
                </ResizableHeader>
                <ResizableHeader
                  width={getColumnWidth('promulgationDate')}
                  onResize={(e, data) => handleColumnResize('promulgationDate', e, data)}
                  dataKey="promulgationDate"
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('promulgationDate')}
                >
                  公布日期<SortIcon field="promulgationDate" />
                </ResizableHeader>
                <ResizableHeader
                  width={getColumnWidth('effectiveDate')}
                  onResize={(e, data) => handleColumnResize('effectiveDate', e, data)}
                  dataKey="effectiveDate"
                  className="cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('effectiveDate')}
                >
                  施行日期<SortIcon field="effectiveDate" />
                </ResizableHeader>
                <ResizableHeader
                  width={getColumnWidth('actions')}
                  onResize={(e, data) => handleColumnResize('actions', e, data)}
                  dataKey="actions"
                  className="text-center"
                  stickyRight
                >
                  操作
                </ResizableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {laws.map((law) => (
                <tr key={law.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3 py-3 sticky-left-col" style={{ width: `${getColumnWidth('title')}px`, position: 'sticky', left: '0px', backgroundColor: 'white', zIndex: 5, borderRight: '2px solid #e2e8f0' }}>
                    <div className="truncate" title={law.title}>
                      <Link href={`/law/${law.id}`} target="_blank" className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-xs">
                        {law.title}
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-3" style={{ width: `${getColumnWidth('level')}px` }}>
                    <select
                      className="w-full bg-transparent border-none p-0 focus:ring-0 cursor-pointer text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded"
                      defaultValue={law.level}
                      onChange={(e) => handleUpdateLaw(law.id, { level: e.target.value })}
                      title={law.level}
                    >
                      {LEVEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3" style={{ width: `${getColumnWidth('region')}px` }}>
                    <select
                      className="w-full bg-transparent border-none p-0 focus:ring-0 cursor-pointer text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded"
                      defaultValue={law.region || '全国'}
                      onChange={(e) => handleUpdateLaw(law.id, { region: e.target.value })}
                      title={law.region || '全国'}
                    >
                      {REGION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3" style={{ width: `${getColumnWidth('status')}px` }}>
                    <select
                      className={`w-full bg-transparent border-none p-0 focus:ring-0 cursor-pointer text-xs font-bold rounded ${
                          law.status === '现行有效' ? 'text-green-600' : 'text-red-400'
                      }`}
                      defaultValue={law.status}
                      onChange={(e) => handleUpdateLaw(law.id, { status: e.target.value })}
                      title={law.status}
                    >
                      {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3" style={{ width: `${getColumnWidth('issuingAuthority')}px` }}>
                    <input
                        type="text"
                        defaultValue={law.issuingAuthority || ''}
                        placeholder="点击输入..."
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs text-slate-500 hover:bg-slate-100 rounded"
                        onBlur={(e) => handleUpdateLaw(law.id, { issuingAuthority: e.target.value })}
                        title={law.issuingAuthority || ''}
                    />
                  </td>
                  <td className="px-3 py-3" style={{ width: `${getColumnWidth('documentNumber')}px` }}>
                    <input
                        type="text"
                        defaultValue={law.documentNumber || ''}
                        placeholder="点击输入..."
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs text-slate-500 hover:bg-slate-100 rounded"
                        onBlur={(e) => handleUpdateLaw(law.id, { documentNumber: e.target.value })}
                        title={law.documentNumber || ''}
                    />
                  </td>
                  <td className="px-3 py-3" style={{ width: `${getColumnWidth('promulgationDate')}px` }}>
                    <input
                        type="date"
                        defaultValue={formatDateForInput(law.promulgationDate)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs text-slate-500 hover:bg-slate-100 rounded"
                        onBlur={(e) => handleUpdateLaw(law.id, { promulgationDate: e.target.value ? new Date(e.target.value) : null })}
                        title={formatDateForInput(law.promulgationDate) || '暂无日期'}
                    />
                  </td>
                  <td className="px-3 py-3" style={{ width: `${getColumnWidth('effectiveDate')}px` }}>
                    <input
                        type="date"
                        defaultValue={formatDateForInput(law.effectiveDate)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs text-slate-500 hover:bg-slate-100 rounded"
                        onBlur={(e) => handleUpdateLaw(law.id, { effectiveDate: e.target.value ? new Date(e.target.value) : null })}
                        title={formatDateForInput(law.effectiveDate) || '暂无日期'}
                    />
                  </td>
                  <td className="px-3 py-3 text-center sticky-right-col" style={{ width: `${getColumnWidth('actions')}px`, position: 'sticky', right: '0px', backgroundColor: 'white', zIndex: 5, borderLeft: '2px solid #e2e8f0' }}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => router.push(`/admin/edit/${law.id}`)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded text-xs font-semibold transition-colors"
                        title="修改全文"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => confirm('确定要删除吗？') && deleteLaw(law.id)}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                        title="删除"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
