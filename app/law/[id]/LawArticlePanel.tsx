'use client';

import { useState } from 'react';
import { formatArticleTitle } from '@/src/lib/article-utils';

interface Paragraph {
  id: number;
  number: string | null;
  content: string | null;
  items: Array<{
    id: number;
    number: string;
    content: string;
  }>;
}

interface Article {
  id: number;
  title: string;
  chapter: string | null;
  section: string | null;
  paragraphs: Paragraph[];
}

interface LawArticlePanelProps {
  articles: Article[];
  highlightedArticleId: number | null;
  onArticleClick?: (articleId: number) => void;
  articleFormat?: string;
}

export default function LawArticlePanel({
  articles,
  highlightedArticleId,
  onArticleClick,
  articleFormat = 'standard',
}: LawArticlePanelProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // 过滤包含搜索关键词的条款
  const filteredArticles = searchKeyword
    ? articles.filter(a => 
        a.title?.includes(searchKeyword) ||
        a.chapter?.includes(searchKeyword) ||
        a.paragraphs.some(p => p.content?.includes(searchKeyword))
      )
    : articles;

  // 按章节分组
  const chapters = filteredArticles.reduce((acc, article) => {
    const chapter = article.chapter || '其他';
    if (!acc[chapter]) acc[chapter] = [];
    acc[chapter].push(article);
    return acc;
  }, {} as Record<string, Article[]>);

  // 切换章节展开状态
  const toggleChapter = (chapter: string) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapter)) {
        newSet.delete(chapter);
      } else {
        newSet.add(chapter);
      }
      return newSet;
    });
  };

  // 判断是否是法律责任条款
  const isLiabilityArticle = (article: Article) => {
    return article.chapter?.includes('法律责任') || false;
  };

  return (
    <div className="h-full flex flex-col">
      {/* 搜索框 */}
      <div className="p-3 border-b">
        <input
          type="text"
          placeholder="🔍 搜索条款..."
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 条款列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        {Object.entries(chapters).map(([chapter, chapterArticles]) => (
          <div key={chapter} className="mb-4">
            {/* 章节标题 */}
            <div
              className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer ${
                chapter.includes('法律责任') ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'
              }`}
              onClick={() => toggleChapter(chapter)}
            >
              <span className="font-medium text-sm">{chapter}</span>
              <span className="text-xs text-gray-500">
                {chapterArticles.length} 条
                {expandedChapters.has(chapter) ? ' ▼' : ' ▶'}
              </span>
            </div>

            {/* 条款列表 */}
            {expandedChapters.has(chapter) && (
              <div className="mt-2 space-y-2">
                {chapterArticles.map(article => (
                  <div
                    key={article.id}
                    id={`article-${article.id}`}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      highlightedArticleId === article.id
                        ? 'bg-yellow-100 border-l-4 border-yellow-500 shadow-md'
                        : isLiabilityArticle(article)
                        ? 'bg-red-50 border-l-2 border-red-300'
                        : 'bg-white border-l-2 border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => onArticleClick?.(article.id)}
                  >
                    {/* 条款标题 */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-blue-600">
                        {formatArticleTitle(article.title, articleFormat === 'ordinal' ? 'ordinal' : 'standard')}
                      </span>
                      {isLiabilityArticle(article) && (
                        <span className="text-xs px-2 py-0.5 bg-red-500 text-white rounded">
                          法律责任
                        </span>
                      )}
                    </div>

                    {/* 条款内容 */}
                    {article.paragraphs.map(para => (
                      <div key={para.id} className="text-xs text-gray-600 leading-relaxed">
                        {para.content}
                        {para.items.map(item => (
                          <div key={item.id} className="ml-4 mt-1">
                            {item.number} {item.content}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
