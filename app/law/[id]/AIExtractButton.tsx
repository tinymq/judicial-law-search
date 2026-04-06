'use client';

import { useState } from 'react';

interface AIExtractButtonProps {
  lawId: number;
  lawTitle: string;
  articles: Array<{
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
  }>;
  onExtractComplete: (violations: any[]) => void;
}

export default function AIExtractButton({
  lawId,
  lawTitle,
  articles,
  onExtractComplete
}: AIExtractButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/extract-violations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lawId })
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'AI 分析失败');
        return;
      }

      // 传递条款数据用于匹配
      onExtractComplete(data.violations || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : '网络请求失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-2">
      <button
        onClick={handleExtract}
        disabled={isLoading}
        className={`
          px-4 py-2 rounded-lg font-medium text-sm
          flex items-center gap-2 transition-all
          ${isLoading
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
          }
        `}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>AI 正在分析法规...</span>
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>AI 拆解违法行为</span>
          </>
        )}
      </button>

      {error && (
        <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded border border-red-200">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
