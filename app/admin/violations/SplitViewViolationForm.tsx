'use client';

import { useState, useEffect } from 'react';
import LawArticlePanel from '@/app/law/[id]/LawArticlePanel';
import { getLawArticlesWithContent } from '@/app/admin/actions';

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

interface Law {
  id: number;
  title: string;
}

interface ViolationFormData {
  description: string;
  violationBasisLawId: number | null;
  violationBasisArticleId: number | null;
  punishmentBasisLawId: number | null;
  punishmentBasisArticleId: number | null;
  punishmentSuggestion: string | null;
}

interface SplitViewViolationFormProps {
  mode: 'create' | 'edit';
  initialData?: ViolationFormData;
  laws: Law[];
  onSave: (data: ViolationFormData) => Promise<void>;
  onCancel: () => void;
}

export default function SplitViewViolationForm({
  mode,
  initialData,
  laws,
  onSave,
  onCancel,
}: SplitViewViolationFormProps) {
  const [selectedLawId, setSelectedLawId] = useState<number | null>(
    initialData?.violationBasisLawId || null
  );
  const [description, setDescription] = useState(initialData?.description || '');
  const [violationArticleId, setViolationArticleId] = useState<number | null>(
    initialData?.violationBasisArticleId || null
  );
  const [punishmentArticleId, setPunishmentArticleId] = useState<number | null>(
    initialData?.punishmentBasisArticleId || null
  );
  const [punishmentSuggestion, setPunishmentSuggestion] = useState(
    initialData?.punishmentSuggestion || ''
  );

  const [highlightedArticleId, setHighlightedArticleId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectingMode, setSelectingMode] = useState<'violation' | 'punishment' | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);

  // 编辑模式：初始化时加载已选法规的条款
  useEffect(() => {
    if (initialData?.violationBasisLawId) {
      setLoadingArticles(true);
      getLawArticlesWithContent(initialData.violationBasisLawId)
        .then(data => setArticles(data as Article[]))
        .catch(e => console.error('加载条款失败:', e))
        .finally(() => setLoadingArticles(false));
    }
  }, []);

  // 切换法规时按需加载条款
  const handleLawChange = async (lawId: number) => {
    setSelectedLawId(lawId);
    setViolationArticleId(null);
    setPunishmentArticleId(null);
    setSelectingMode(null);
    setArticles([]);

    if (lawId) {
      setLoadingArticles(true);
      try {
        const data = await getLawArticlesWithContent(lawId);
        setArticles(data as Article[]);
      } catch (e) {
        console.error('加载条款失败:', e);
      } finally {
        setLoadingArticles(false);
      }
    }
  };

  // 点击条款
  const handleArticleClick = (articleId: number) => {
    setHighlightedArticleId(articleId);
    setTimeout(() => setHighlightedArticleId(null), 3000);

    if (selectingMode === 'violation') {
      setViolationArticleId(articleId);
      setSelectingMode(null);
    } else if (selectingMode === 'punishment') {
      setPunishmentArticleId(articleId);
      setSelectingMode(null);
    }
  };

  // 开始选择条款
  const startSelecting = (mode: 'violation' | 'punishment') => {
    setSelectingMode(selectingMode === mode ? null : mode);
  };

  // 保存
  const handleSave = async () => {
    if (!description.trim()) {
      alert('请输入违法行为描述');
      return;
    }

    if (!violationArticleId) {
      alert('请选择违法依据');
      return;
    }

    if (!punishmentArticleId) {
      alert('请选择处罚依据');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        description: description.trim(),
        violationBasisLawId: selectedLawId,
        violationBasisArticleId: violationArticleId,
        punishmentBasisLawId: selectedLawId,
        punishmentBasisArticleId: punishmentArticleId,
        punishmentSuggestion: punishmentSuggestion.trim() || null,
      });
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 获取条款标题
  const getArticleTitle = (articleId: number | null) => {
    if (!articleId || articles.length === 0) return '未选择';
    const article = articles.find(a => a.id === articleId);
    return article ? `第${article.title}条` : '未找到';
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {mode === 'create' ? '📝 新建违法行为' : '✏️ 编辑违法行为'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            选择法规后，点击左侧条款设置违法依据和处罚依据
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            disabled={isSaving}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：法规选择 + 条款树 */}
        <div className="w-2/5 border-r bg-white flex flex-col">
          {/* 法规选择 */}
          <div className="p-3 border-b">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              选择法规
            </label>
            <select
              value={selectedLawId || ''}
              onChange={(e) => handleLawChange(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择法规</option>
              {laws.map(law => (
                <option key={law.id} value={law.id}>
                  {law.title}
                </option>
              ))}
            </select>
          </div>

          {/* 条款树 */}
          {loadingArticles ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              加载条款中...
            </div>
          ) : articles.length > 0 ? (
            <div className="flex-1 overflow-hidden">
              <LawArticlePanel
                articles={articles}
                highlightedArticleId={highlightedArticleId}
                onArticleClick={handleArticleClick}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              {selectedLawId ? '该法规暂无条款数据' : '请先选择法规'}
            </div>
          )}
        </div>

        {/* 右侧：违法行为编辑 */}
        <div className="w-3/5 bg-white p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* 违法行为描述 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                违法行为描述 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请输入违法行为描述"
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {/* 违法依据 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📋 违法依据 <span className="text-red-500">*</span>
              </label>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                      selectingMode === 'violation'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {getArticleTitle(violationArticleId)}
                    </span>
                    {violationArticleId && selectedLawId && (
                      <span className="text-xs text-gray-500">
                        {laws.find(l => l.id === selectedLawId)?.title}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => startSelecting('violation')}
                    className={`px-4 py-1.5 rounded text-sm ${
                      selectingMode === 'violation'
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {selectingMode === 'violation' ? '选择中...' : '选择条款'}
                  </button>
                </div>
                {selectingMode === 'violation' && (
                  <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded">
                    💡 请在左侧点击要选择的条款
                  </div>
                )}
              </div>
            </div>

            {/* 处罚依据 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⚖️ 处罚依据 <span className="text-red-500">*</span>
              </label>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                      selectingMode === 'punishment'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {getArticleTitle(punishmentArticleId)}
                    </span>
                    {punishmentArticleId && selectedLawId && (
                      <span className="text-xs text-gray-500">
                        {laws.find(l => l.id === selectedLawId)?.title}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => startSelecting('punishment')}
                    className={`px-4 py-1.5 rounded text-sm ${
                      selectingMode === 'punishment'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {selectingMode === 'punishment' ? '选择中...' : '选择条款'}
                  </button>
                </div>
                {selectingMode === 'punishment' && (
                  <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">
                    💡 请在左侧点击要选择的条款
                  </div>
                )}
              </div>
            </div>

            {/* 处罚建议 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💰 处罚建议
              </label>
              <textarea
                value={punishmentSuggestion}
                onChange={(e) => setPunishmentSuggestion(e.target.value)}
                placeholder="请输入处罚建议（可选）"
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {/* 提示信息 */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
              <div className="text-sm text-blue-700">
                <strong>操作提示：</strong>
                <ol className="list-decimal ml-4 mt-2 space-y-1">
                  <li>选择法规</li>
                  <li>点击"选择条款"按钮</li>
                  <li>在左侧点击对应条款</li>
                  <li>填写违法行为描述和处罚建议</li>
                  <li>点击保存</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
