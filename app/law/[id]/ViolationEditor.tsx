'use client';

import { useState } from 'react';

interface Article {
  id: number;
  title: string;
  chapter: string | null;
  section: string | null;
}

interface ViolationItem {
  id: string;
  description: string;
  violationArticleTitle: string;
  violationContent: string;
  punishmentArticleTitle: string;
  punishmentContent: string;
  punishmentSuggestion: string;
  selected: boolean;
  violationArticleId: number | null;
  punishmentArticleId: number | null;
}

interface ViolationEditorProps {
  items: ViolationItem[];
  articles: Article[];
  onItemChange: (id: string, updates: Partial<ViolationItem>) => void;
  onArticleClick: (articleId: number) => void;
}

export default function ViolationEditor({
  items,
  articles,
  onItemChange,
  onArticleClick,
}: ViolationEditorProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<string | null>(null);

  // 根据条款 ID 获取条款标题
  const getArticleTitle = (articleId: number | null) => {
    if (!articleId) return '未匹配';
    const article = articles.find(a => a.id === articleId);
    return article ? `第${article.title}条` : '未匹配';
  };

  return (
    <div className="h-full flex flex-col">
      {/* 头部信息 */}
      <div className="p-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">违法行为列表</h3>
            <p className="text-xs text-gray-500 mt-1">
              共 {items.length} 条，已选择 {items.filter(i => i.selected).length} 条
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                items.forEach(item => onItemChange(item.id, { selected: true }));
              }}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              全选
            </button>
            <button
              onClick={() => {
                items.forEach(item => onItemChange(item.id, { selected: false }));
              }}
              className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              取消全选
            </button>
          </div>
        </div>
      </div>

      {/* 违法行为列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`border rounded-lg transition-all ${
              item.selected
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-200 bg-white'
            } ${
              expandedItem === item.id ? 'shadow-md' : ''
            }`}
          >
            {/* 条目标题 */}
            <div
              className="flex items-start gap-3 p-3 cursor-pointer"
              onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
            >
              {/* 复选框 */}
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(e) => {
                  e.stopPropagation();
                  onItemChange(item.id, { selected: e.target.checked });
                }}
                className="mt-1 w-4 h-4 text-blue-600 rounded"
              />

              {/* 条目信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    #{index + 1}
                  </span>
                  <span className={`text-sm font-medium ${
                    item.selected ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {item.description}
                  </span>
                </div>

                {/* 条款信息（折叠时显示简要信息） */}
                {expandedItem !== item.id && (
                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      违法依据：{getArticleTitle(item.violationArticleId)}
                    </span>
                    <span>
                      处罚依据：{getArticleTitle(item.punishmentArticleId)}
                    </span>
                  </div>
                )}
              </div>

              {/* 展开/折叠图标 */}
              <span className="text-gray-400">
                {expandedItem === item.id ? '▼' : '▶'}
              </span>
            </div>

            {/* 展开详情 */}
            {expandedItem === item.id && (
              <div className="px-3 pb-3 pt-0 space-y-3 border-t">
                {/* 违法行为描述 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    违法行为描述
                  </label>
                  {editMode === `desc-${item.id}` ? (
                    <textarea
                      value={item.description}
                      onChange={(e) => onItemChange(item.id, { description: e.target.value })}
                      onBlur={() => setEditMode(null)}
                      className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() => setEditMode(`desc-${item.id}`)}
                      className="px-2 py-1 border rounded text-sm cursor-pointer hover:bg-gray-50"
                    >
                      {item.description}
                    </div>
                  )}
                </div>

                {/* 违法依据 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    📋 违法依据
                  </label>
                  <div className="bg-gray-50 rounded p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">条款：</span>
                      <button
                        onClick={() => item.violationArticleId && onArticleClick(item.violationArticleId)}
                        className={`text-sm font-medium ${
                          item.violationArticleId
                            ? 'text-blue-600 hover:text-blue-800 underline'
                            : 'text-red-500'
                        }`}
                        disabled={!item.violationArticleId}
                      >
                        {getArticleTitle(item.violationArticleId)}
                      </button>
                      <span className="text-xs text-gray-400">← 点击查看</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {item.violationContent || '无内容'}
                    </div>
                  </div>
                </div>

                {/* 处罚依据 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ⚖️ 处罚依据
                  </label>
                  <div className="bg-gray-50 rounded p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">条款：</span>
                      <button
                        onClick={() => item.punishmentArticleId && onArticleClick(item.punishmentArticleId)}
                        className={`text-sm font-medium ${
                          item.punishmentArticleId
                            ? 'text-blue-600 hover:text-blue-800 underline'
                            : 'text-red-500'
                        }`}
                        disabled={!item.punishmentArticleId}
                      >
                        {getArticleTitle(item.punishmentArticleId)}
                      </button>
                      <span className="text-xs text-gray-400">← 点击查看</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {item.punishmentContent || '无内容'}
                    </div>
                  </div>
                </div>

                {/* 处罚建议 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    💰 处罚建议
                  </label>
                  {editMode === `suggestion-${item.id}` ? (
                    <textarea
                      value={item.punishmentSuggestion}
                      onChange={(e) => onItemChange(item.id, { punishmentSuggestion: e.target.value })}
                      onBlur={() => setEditMode(null)}
                      className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() => setEditMode(`suggestion-${item.id}`)}
                      className="px-2 py-1 border rounded text-sm cursor-pointer hover:bg-gray-50 min-h-[40px]"
                    >
                      {item.punishmentSuggestion || '点击编辑处罚建议'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
