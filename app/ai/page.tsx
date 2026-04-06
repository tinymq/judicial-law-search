'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

const EXAMPLE_CASES = [
  {
    title: '超市销售过期食品',
    description: '消费者投诉某超市销售的牛肉干已过保质期，食用后出现腹泻症状，要求赔偿。',
  },
  {
    title: '虚假广告宣传',
    description: '某化妆品店在宣传中声称产品有"祛斑美白"功效，但无法提供相关检测报告，涉嫌虚假宣传。',
  },
  {
    title: '无照经营餐饮',
    description: '12345转来投诉，某小区底商经营餐饮但未取得营业执照和食品经营许可证，存在食品安全隐患。',
  },
  {
    title: '价格欺诈',
    description: '消费者反映某商场促销活动中，商品标价与实际结算价格不一致，先提价后打折，涉嫌价格欺诈。',
  },
];

export default function AIPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (text?: string) => {
    const query = text || input;
    if (!query.trim() || loading) return;

    setLoading(true);
    // Store input in sessionStorage for result page to use
    sessionStorage.setItem('caseQuery', query.trim());
    router.push('/ai/result');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <SiteHeader />
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/"
              className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
            >
              法规检索
            </Link>
            <Link
              href="/violations"
              className="text-sm text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline"
            >
              违法行为查询
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-12 sm:pt-24 pb-8 sm:pb-12">
        {/* Title */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">AI 案件分析助手</h1>
          <p className="text-slate-500 text-base">
            输入案件描述或投诉内容，AI 帮你匹配违法行为和法律依据
          </p>
        </div>

        {/* Input box */}
        <div className="relative mb-10">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你遇到的案件情况，比如：消费者投诉某超市销售过期食品..."
            rows={4}
            disabled={loading}
            className="w-full px-5 py-4 bg-white border border-slate-300 rounded-2xl text-base leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || loading}
            className="absolute right-3 bottom-3 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                分析中
              </>
            ) : (
              '开始分析'
            )}
          </button>
        </div>

        {/* Example cases */}
        <div>
          <div className="text-sm font-medium text-slate-400 mb-3">试试这些案例：</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EXAMPLE_CASES.map((example, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(example.description);
                  handleSubmit(example.description);
                }}
                disabled={loading}
                className="text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group disabled:opacity-60 cursor-pointer"
              >
                <div className="text-sm font-bold text-slate-700 mb-1 group-hover:text-blue-600">
                  {example.title}
                </div>
                <div className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {example.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
