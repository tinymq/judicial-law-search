'use client';

import { useState } from 'react';
import { submitFeedback } from '@/app/admin/feedback-actions';
import { FEEDBACK_ISSUE_TYPES } from '@/src/lib/feedback-config';

export default function FeedbackButton({ lawId, lawTitle }: { lawId: number; lawTitle: string }) {
  const [open, setOpen] = useState(false);
  const [issueType, setIssueType] = useState<string>(FEEDBACK_ISSUE_TYPES[0]);
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      showToast('请填写问题描述', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitFeedback({
        lawId,
        lawTitle,
        issueType,
        description: description.trim(),
        contact: contact.trim() || undefined,
      });
      if (result.success) {
        showToast(result.message, 'success');
        setOpen(false);
        setDescription('');
        setContact('');
        setIssueType(FEEDBACK_ISSUE_TYPES[0]);
      } else {
        showToast(result.message, 'error');
      }
    } catch {
      showToast('提交失败，请稍后重试', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 浮动反馈按钮 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-8 p-3 bg-white border border-slate-200 rounded-full shadow-lg hover:shadow-xl transition-all text-slate-400 hover:text-amber-600 group hidden md:flex items-center gap-2"
        title="反馈问题"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M12 7v2" />
          <path d="M12 13h.01" />
        </svg>
      </button>

      {/* 模态框 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">问题反馈</h3>
              <button
                onClick={() => !submitting && setOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2 truncate">
              {lawTitle}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">问题类型</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {FEEDBACK_ISSUE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                问题描述 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请描述您发现的问题，如条款内容有误、缺少条款等..."
                rows={4}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">联系方式（选填）</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="邮箱或手机号，方便我们跟进"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => !submitting && setOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={submitting}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !description.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '提交中...' : '提交反馈'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 通知 */}
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
