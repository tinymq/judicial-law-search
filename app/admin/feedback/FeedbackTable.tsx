'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateFeedbackStatus, deleteFeedback } from '@/app/admin/feedback-actions';
import { FEEDBACK_STATUS_OPTIONS } from '@/src/lib/feedback-config';

interface FeedbackItem {
  id: number;
  lawId: number;
  lawTitle: string;
  issueType: string;
  description: string;
  contact: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  feedbacks: FeedbackItem[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  selectedStatus: string;
  selectedIssueType: string;
}

const issueTypeColors: Record<string, string> = {
  '数据错误': 'bg-red-50 text-red-700 border-red-200',
  '内容缺失': 'bg-amber-50 text-amber-700 border-amber-200',
  '格式问题': 'bg-blue-50 text-blue-700 border-blue-200',
  '条款错误': 'bg-purple-50 text-purple-700 border-purple-200',
  '其他': 'bg-slate-50 text-slate-600 border-slate-200',
};

const statusColors: Record<string, string> = {
  '待处理': 'text-amber-600',
  '处理中': 'text-blue-600',
  '已解决': 'text-green-600',
  '已忽略': 'text-slate-400',
};

export default function FeedbackTable({
  feedbacks,
  totalCount,
  currentPage,
  totalPages,
  pageSize,
  selectedStatus,
  selectedIssueType,
}: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingNote, setEditingNote] = useState<{ id: number; note: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await updateFeedbackStatus(id, { status: newStatus });
      showToast('状态已更新', 'success');
      router.refresh();
    } catch {
      showToast('更新失败', 'error');
    }
  };

  const handleSaveNote = async (id: number, note: string) => {
    try {
      await updateFeedbackStatus(id, { adminNote: note });
      setEditingNote(null);
      showToast('备注已保存', 'success');
      router.refresh();
    } catch {
      showToast('保存失败', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这条反馈？')) return;
    try {
      await deleteFeedback(id);
      showToast('已删除', 'success');
      router.refresh();
    } catch {
      showToast('删除失败', 'error');
    }
  };

  function buildPageUrl(page: number) {
    const p = new URLSearchParams();
    if (selectedStatus) p.set('status', selectedStatus);
    if (selectedIssueType) p.set('issueType', selectedIssueType);
    p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    return `/admin/feedback?${p.toString()}`;
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (feedbacks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
        <p className="text-lg mb-1">暂无反馈记录</p>
        <p className="text-sm">用户提交的法规问题反馈将显示在这里</p>
      </div>
    );
  }

  return (
    <>
      {/* 桌面端表格 */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 w-[200px]">法规</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 w-[80px]">类型</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">描述</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 w-[100px]">联系方式</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 w-[100px]">状态</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 w-[140px]">提交时间</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 w-[80px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((fb) => (
              <Fragment key={fb.id}>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/law/${fb.lawId}`}
                      target="_blank"
                      className="text-blue-600 hover:underline truncate block max-w-[200px]"
                      title={fb.lawTitle}
                    >
                      {fb.lawTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${issueTypeColors[fb.issueType] || issueTypeColors['其他']}`}>
                      {fb.issueType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setExpandedId(expandedId === fb.id ? null : fb.id)}
                      className="text-left text-slate-700 hover:text-slate-900 truncate block max-w-[300px]"
                      title="点击展开"
                    >
                      {fb.description}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {fb.contact || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={fb.status}
                      onChange={(e) => handleStatusChange(fb.id, e.target.value)}
                      className={`text-xs font-medium border-none bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5 ${statusColors[fb.status] || ''}`}
                    >
                      {FEEDBACK_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {formatDate(fb.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(fb.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      删除
                    </button>
                  </td>
                </tr>
                {expandedId === fb.id && (
                  <tr key={`${fb.id}-detail`} className="bg-slate-50/80">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-medium text-slate-500 mb-1">完整描述</div>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-slate-100">
                            {fb.description}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-500 mb-1">管理员备注</div>
                          {editingNote?.id === fb.id ? (
                            <div className="flex gap-2">
                              <textarea
                                value={editingNote.note}
                                onChange={(e) => setEditingNote({ id: fb.id, note: e.target.value })}
                                className="flex-1 text-sm border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                placeholder="填写处理备注..."
                              />
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => handleSaveNote(fb.id, editingNote.note)}
                                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                >
                                  保存
                                </button>
                                <button
                                  onClick={() => setEditingNote(null)}
                                  className="text-xs px-3 py-1 text-slate-500 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => setEditingNote({ id: fb.id, note: fb.adminNote || '' })}
                              className="text-sm text-slate-500 bg-white rounded-lg p-3 border border-slate-100 cursor-pointer hover:border-blue-200 transition-colors min-h-[40px]"
                            >
                              {fb.adminNote || <span className="text-slate-300 italic">点击添加备注...</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 移动端卡片 */}
      <div className="md:hidden space-y-3">
        {feedbacks.map((fb) => (
          <div key={fb.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/law/${fb.lawId}`}
                target="_blank"
                className="text-sm font-medium text-blue-600 hover:underline line-clamp-2 flex-1"
              >
                {fb.lawTitle}
              </Link>
              <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${issueTypeColors[fb.issueType] || issueTypeColors['其他']}`}>
                {fb.issueType}
              </span>
            </div>
            <p className="text-sm text-slate-700 line-clamp-3">{fb.description}</p>
            {fb.contact && (
              <p className="text-xs text-slate-400">联系方式：{fb.contact}</p>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-xs text-slate-400">{formatDate(fb.createdAt)}</span>
              <div className="flex items-center gap-3">
                <select
                  value={fb.status}
                  onChange={(e) => handleStatusChange(fb.id, e.target.value)}
                  className={`text-xs font-medium border border-slate-200 rounded px-2 py-1 ${statusColors[fb.status] || ''}`}
                >
                  {FEEDBACK_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(fb.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  删除
                </button>
              </div>
            </div>
            {fb.adminNote && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                <span className="font-medium">备注：</span>{fb.adminNote}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 bg-white rounded-xl border border-slate-200 px-4 py-3">
          <span className="text-sm text-slate-500">
            共 {totalCount} 条，第 {currentPage}/{totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            {currentPage > 1 && (
              <Link
                href={buildPageUrl(currentPage - 1)}
                className="text-sm px-3 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                上一页
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={buildPageUrl(currentPage + 1)}
                className="text-sm px-3 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                下一页
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
