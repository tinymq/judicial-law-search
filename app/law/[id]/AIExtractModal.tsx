'use client';

import { useState, useEffect } from 'react';
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
  // 匹配后的 ID
  violationArticleId?: number;
  punishmentArticleId?: number;
}

interface AIExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  lawId: number;
  lawTitle: string;
  articles: Article[];
  violations: ExtractedViolation[];
}

interface ViolationItem extends ExtractedViolation {
  id: string; // 临时 ID
  selected: boolean;
  violationArticleId: number | null;
  punishmentArticleId: number | null;
}

export default function AIExtractModal({
  isOpen,
  onClose,
  lawId,
  lawTitle,
  articles,
  violations
}: AIExtractModalProps) {
  const [items, setItems] = useState<ViolationItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });

  // 初始化：优先使用 API 返回的条款 ID，否则尝试匹配
  useEffect(() => {
    if (violations.length > 0) {
      const matchedItems: ViolationItem[] = violations.map((v, index) => {
        // 优先使用 API 返回的 ID，如果没有则尝试匹配
        const violationArticle = v.violationArticleId 
          ? articles.find(a => a.id === v.violationArticleId)
          : findArticleByTitle(v.violationArticleTitle);
        
        const punishmentArticle = v.punishmentArticleId
          ? articles.find(a => a.id === v.punishmentArticleId)
          : findArticleByTitle(v.punishmentArticleTitle);

        return {
          ...v,
          id: `temp-${index}`,
          selected: true,
          violationArticleId: violationArticle?.id || null,
          punishmentArticleId: punishmentArticle?.id || null
        };
      });
      setItems(matchedItems);
    }
  }, [violations, articles]);

  // 根据条款标题查找条款（支持"第四十二条第一款"格式）
  const findArticleByTitle = (title: string): Article | null => {
    if (!title) return null;

    // 标准化标题：移除"第"和"条"及其后面的内容（如"第一款"）
    const normalized = title
      .replace(/^第/, '')
      .replace(/条.*/, '')
      .trim();

    return articles.find(a => {
      if (!a.title) return false;
      if (a.title === normalized) return true;
      if (a.title === title) return true;
      if (`第${a.title}条` === title) return true;
      
      // 中文数字转阿拉伯数字
      const chineseToNum: Record<string, string> = {
        '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
        '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
        '十一': '11', '十二': '12', '十三': '13', '十四': '14', '十五': '15',
        '十六': '16', '十七': '17', '十八': '18', '十九': '19', '二十': '20',
        '三十': '30', '四十': '40', '五十': '50'
      };
      
      const numFromChinese = chineseToNum[normalized];
      if (numFromChinese && a.title === numFromChinese) return true;
      
      return false;
    }) || null;
  };

  // 生成条款选项
  const articleOptions = articles.map(a => ({
    id: a.id,
    label: `第${a.title}条${a.chapter ? ` (${a.chapter})` : ''}${a.section ? ` - ${a.section}` : ''}`
  }));

  // 切换选中
  const toggleSelect = (id: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  };

  // 全选/取消全选
  const toggleAll = (selected: boolean) => {
    setItems(prev => prev.map(item => ({ ...item, selected })));
  };

  // 更新描述
  const updateDescription = (id: string, description: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, description } : item
    ));
  };

  // 更新违法依据
  const updateViolationArticle = (id: string, articleId: number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, violationArticleId: articleId } : item
    ));
  };

  // 更新处罚依据
  const updatePunishmentArticle = (id: string, articleId: number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, punishmentArticleId: articleId } : item
    ));
  };

  // 更新处罚建议
  const updatePunishmentSuggestion = (id: string, suggestion: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, punishmentSuggestion: suggestion } : item
    ));
  };

  // 保存选中的违法行为
  const handleSave = async () => {
    const selectedItems = items.filter(item => item.selected);

    if (selectedItems.length === 0) {
      alert('请至少选择一条违法行为');
      return;
    }

    // 验证是否有未匹配的条款
    const unmatchedItems = selectedItems.filter(
      item => !item.violationArticleId || !item.punishmentArticleId
    );

    if (unmatchedItems.length > 0) {
      const confirm = window.confirm(
        `有 ${unmatchedItems.length} 条违法行为的条款未能匹配，这些记录将不关联具体条款。是否继续？`
      );
      if (!confirm) return;
    }

    setIsSaving(true);
    setSaveProgress({ current: 0, total: selectedItems.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      setSaveProgress({ current: i + 1, total: selectedItems.length });

      try {
        await createViolation({
          description: item.description,
          violationBasisLawId: lawId,
          violationBasisArticleId: item.violationArticleId,
          punishmentBasisLawId: lawId,
          punishmentBasisArticleId: item.punishmentArticleId,
          sentencingGuidelines: null,
          punishmentSuggestion: item.punishmentSuggestion || null
        });
        successCount++;
      } catch (error) {
        console.error('保存失败:', error);
        failCount++;
      }
    }

    setIsSaving(false);

    if (failCount === 0) {
      alert(`✅ 成功保存 ${successCount} 条违法行为！`);
      onClose();
      // 刷新页面
      window.location.reload();
    } else {
      alert(`保存完成：成功 ${successCount} 条，失败 ${failCount} 条`);
    }
  };

  if (!isOpen) return null;

  const selectedCount = items.filter(i => i.selected).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 背景遮罩 */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* 模态框 */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
          {/* 头部 */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-2xl z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  🤖 AI 拆解结果
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {lawTitle} - 共识别出 {items.length} 条潜在违法行为
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 操作栏 */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => toggleAll(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  全选
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="text-sm text-slate-500 hover:text-slate-600"
                >
                  取消全选
                </button>
                <span className="text-sm text-slate-500">
                  已选择 <span className="font-bold text-blue-600">{selectedCount}</span> 条
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || selectedCount === 0}
                  className={`
                    px-6 py-2 rounded-lg font-medium
                    ${isSaving || selectedCount === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    }
                  `}
                >
                  {isSaving ? `保存中 ${saveProgress.current}/${saveProgress.total}` : `保存选中项`}
                </button>
              </div>
            </div>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {items.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <div className="text-4xl mb-4">📭</div>
                <p>AI 未识别出任何违法行为</p>
              </div>
            ) : (
              items.map((item, index) => (
                <div
                  key={item.id}
                  className={`
                    border rounded-xl p-4 transition-all
                    ${item.selected ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-white'}
                  `}
                >
                  {/* 头部：序号 + 勾选 */}
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-1 w-5 h-5 text-blue-600 rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                        {(!item.violationArticleId || !item.punishmentArticleId) && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                            ⚠️ 条款未匹配
                          </span>
                        )}
                      </div>

                      {/* 违法行为描述 */}
                      <textarea
                        value={item.description}
                        onChange={(e) => updateDescription(item.id, e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="违法行为描述"
                      />
                    </div>
                  </div>

                  {/* 违法依据 + 处罚依据 */}
                  <div className="grid grid-cols-2 gap-4 ml-8">
                    {/* 违法依据 */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        违法依据
                      </label>
                      <select
                        value={item.violationArticleId || ''}
                        onChange={(e) => updateViolationArticle(item.id, Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- 选择条款 --</option>
                        {articleOptions.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {item.violationContent}
                      </p>
                    </div>

                    {/* 处罚依据 */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        处罚依据
                      </label>
                      <select
                        value={item.punishmentArticleId || ''}
                        onChange={(e) => updatePunishmentArticle(item.id, Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- 选择条款 --</option>
                        {articleOptions.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {item.punishmentContent}
                      </p>
                    </div>
                  </div>

                  {/* 处罚建议 */}
                  <div className="ml-8 mt-3">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      处罚建议
                    </label>
                    <textarea
                      value={item.punishmentSuggestion}
                      onChange={(e) => updatePunishmentSuggestion(item.id, e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      placeholder="处罚建议（从处罚条款提取）"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
