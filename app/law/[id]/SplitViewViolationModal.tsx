'use client';

import { useState, useEffect, useRef } from 'react';
import LawArticlePanel from './LawArticlePanel';
import ViolationEditor from './ViolationEditor';
import { createViolation } from '@/app/admin/actions';

interface Article {
  id: number;
  title: string;
  chapter: string | null;
  section: string | null;
  paragraphs: Array<{
    id: number;
    number: string | null;
    content: string | null;
    items: Array<{
      id: number;
      number: string;
      content: string;
    }>;
  }>;
}

interface ExtractedViolation {
  description: string;
  violationArticleTitle: string;
  violationContent: string;
  punishmentArticleTitle: string;
  punishmentContent: string;
  punishmentSuggestion: string;
  violationArticleId?: number;
  punishmentArticleId?: number;
}

interface ViolationItem extends ExtractedViolation {
  id: string;
  selected: boolean;
  violationArticleId: number | null;
  punishmentArticleId: number | null;
}

interface SplitViewViolationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lawId: number;
  lawTitle: string;
  articles: Article[];
  violations: ExtractedViolation[];
}

export default function SplitViewViolationModal({
  isOpen,
  onClose,
  lawId,
  lawTitle,
  articles,
  violations,
}: SplitViewViolationModalProps) {
  const [items, setItems] = useState<ViolationItem[]>([]);
  const [highlightedArticleId, setHighlightedArticleId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const articlePanelRef = useRef<HTMLDivElement>(null);

  // 初始化
  useEffect(() => {
    if (violations.length > 0) {
      const matchedItems: ViolationItem[] = violations.map((v, index) => ({
        ...v,
        id: `temp-${index}`,
        selected: true,
        violationArticleId: v.violationArticleId || null,
        punishmentArticleId: v.punishmentArticleId || null,
      }));
      setItems(matchedItems);
    }
  }, [violations]);

  // 点击条款号，滚动并高亮
  const handleArticleClick = (articleId: number) => {
    setHighlightedArticleId(articleId);
    
    // 滚动到对应条款
    const element = document.getElementById(`article-${articleId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 3秒后取消高亮
    setTimeout(() => setHighlightedArticleId(null), 3000);
  };

  // 更新条目
  const handleItemChange = (id: string, updates: Partial<ViolationItem>) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  // 保存选中项
  const handleSave = async () => {
    const selectedItems = items.filter(item => item.selected);
    if (selectedItems.length === 0) {
      alert('请至少选择一条违法行为');
      return;
    }

    setIsSaving(true);
    setSaveProgress({ current: 0, total: selectedItems.length });

    try {
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        
        await createViolation({
          description: item.description,
          violationBasisLawId: lawId,
          violationBasisArticleId: item.violationArticleId,
          punishmentBasisLawId: lawId,
          punishmentBasisArticleId: item.punishmentArticleId,
          punishmentSuggestion: item.punishmentSuggestion || null,
          sentencingGuidelines: null,
        });

        setSaveProgress({ current: i + 1, total: selectedItems.length });
      }

      alert(`成功保存 ${selectedItems.length} 条违法行为！`);
      onClose();
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">📝 违法行为编辑器</h2>
            <p className="text-sm text-gray-500 mt-1">{lawTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isSaving}
          >
            ×
          </button>
        </div>

        {/* 主内容区 - 分屏布局 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：法规条款面板 */}
          <div 
            ref={articlePanelRef}
            className="w-2/5 border-r bg-gray-50"
          >
            <LawArticlePanel
              articles={articles}
              highlightedArticleId={highlightedArticleId}
              onArticleClick={handleArticleClick}
            />
          </div>

          {/* 右侧：违法行为编辑器 */}
          <div className="w-3/5">
            <ViolationEditor
              items={items}
              articles={articles}
              onItemChange={handleItemChange}
              onArticleClick={handleArticleClick}
            />
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            💡 提示：点击右侧的条款号，左侧会自动定位到对应条款
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              disabled={isSaving}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving
                ? `保存中 ${saveProgress.current}/${saveProgress.total}...`
                : `保存选中项 (${items.filter(i => i.selected).length})`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
