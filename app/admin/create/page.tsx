'use client'

import { useEffect, useState } from 'react';
import { createLaw, findRelatedLaws, searchLaws } from '../actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseQuickInput, parseContent } from '../utils/contentParser';
import {
  LEVEL_OPTIONS,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  REGION_OPTIONS
} from '@/src/lib/category-config';

type LawOption = {
  id: number;
  title: string;
  lawGroupId: string | null;
  effectiveDate: Date | string | null;
  promulgationDate?: Date | string | null;
  status: string | null;
  level: string;
  score?: number;
  matchReason?: string;
  shouldAutoSelect?: boolean;
};

export default function CreateLawPage() {
  const router = useRouter();

  const [formData, setData] = useState({
    title: '',
    preamble: '',
    issuingAuthority: '',
    documentNumber: '',
    promulgationDate: '',
    effectiveDate: '',
    status: '现行有效',
    level: '法律',
    category: '综合监管',
    region: '全国',
    rawContent: ''
  });

  const [previewArticles, setPreview] = useState<{
    title: string;
    content: string | null;
    chapter: string | null;
    section: string | null;
    paragraphs?: {
      number: number;
      content: string | null;
      items?: {
        number: string;
        content: string;
        order: number;
      }[];
      order: number;
    }[];
  }[]>([]);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // 法规关联相关状态
  const [shouldLinkExisting, setShouldLinkExisting] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLaw, setSelectedLaw] = useState<LawOption | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [matchHint, setMatchHint] = useState<{
    recommended: LawOption | null;
    normalizedTitle: string;
    baseTitle: string;
  } | null>(null);
  const [hasManualSelection, setHasManualSelection] = useState(false);
  const [hasExplicitNoLink, setHasExplicitNoLink] = useState(false);

  // 快速解析格式化的法规信息
  const [quickInputText, setQuickInputText] = useState('');

  // ============ 包装函数：调用共享解析逻辑 ============

  /**
   * 包装函数：快速解析法规元数据
   */
  const handleParseQuickInput = () => {
    parseQuickInput(quickInputText, formData, (data) => setData(data as any), CATEGORY_OPTIONS);
  };

  /**
   * 包装函数：解析法规文本内容
   * 添加了状态保护和错误处理
   */
  const handleParseContent = () => {
    if (isParsing) {
      console.warn('⚠️ 正在解析中，请稍候...');
      return;
    }

    setPreview([]);
    setIsParsing(true);

    try {
      const { articles, preamble } = parseContent(formData.rawContent);
      setPreview(articles);
      // 如果解析到序言，填充到表单
      if (preamble) {
        setData(prev => ({ ...prev, preamble }));
      }
    } catch (error) {
      console.error('❌ 解析失败:', error);
      alert('解析失败，请检查文本格式');
    } finally {
      setIsParsing(false);
    }
  };

  // ============ 原有业务逻辑 ============
  const handleSearchLaws = async (keyword: string) => {
    setSearchKeyword(keyword);
    setHasExplicitNoLink(false);

    // 清除之前的定时器
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // 如果关键词为空，清空结果
    if (!keyword || keyword.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    // 使用 debounce 优化搜索
    const timeout = setTimeout(async () => {
      try {
        const results = await searchLaws(keyword);
        setSearchResults(results);
      } catch (error) {
        console.error('搜索失败:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    setSearchTimeout(timeout);
  };

  // 选择要关联的法规
  const handleSelectLaw = (law: any) => {
    setSelectedLaw(law);
    setSearchResults([]);
    setSearchKeyword(law.title);
    setHasManualSelection(true);
    setHasExplicitNoLink(false);
  };

  // 取消选择
  const handleClearSelection = () => {
    setSelectedLaw(null);
    setSearchKeyword('');
    setHasManualSelection(false);
  };

  // 明确选择不关联
  const handleChooseNoLink = () => {
    setSelectedLaw(null);
    setHasManualSelection(false);
    setHasExplicitNoLink(true);
  };

  useEffect(() => {
    if (!shouldLinkExisting) {
      setMatchHint(null);
      setSelectedLaw(null);
      setSearchKeyword('');
      setSearchResults([]);
      setHasManualSelection(false);
      setHasExplicitNoLink(false);
      return;
    }

    const title = formData.title.trim();
    if (title.length < 2) {
      setMatchHint(null);
      if (!hasManualSelection) {
        setSelectedLaw(null);
      }
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const result = await findRelatedLaws(title);
        setMatchHint({
          recommended: result.recommended,
          normalizedTitle: result.normalizedTitle,
          baseTitle: result.baseTitle,
        });

        if (!hasManualSelection && !hasExplicitNoLink && result.recommended?.shouldAutoSelect) {
          setSelectedLaw(result.recommended);
          setSearchKeyword(result.recommended.title);
        } else if (!hasManualSelection && !hasExplicitNoLink && !result.recommended) {
          setSelectedLaw(null);
        }
      } catch (error) {
        console.error('自动关联候选查询失败:', error);
        setMatchHint(null);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [formData.title, shouldLinkExisting, hasManualSelection, hasExplicitNoLink]);

  const handleSubmit = async () => {
    if (!formData.title || previewArticles.length === 0) { alert('请填写标题并解析内容'); return; }

    // 如果选择了关联法规，确认是否使用其 groupId
    let lawGroupIdToUse = undefined;
    if (selectedLaw) {
      const confirm = window.confirm(
        `即将关联到现有法规："${selectedLaw.title}"\n` +
        `新法规将使用相同的 lawGroupId\n` +
        `系统会根据公布/施行时间自动判断版本新旧\n\n` +
        `确定继续吗？`
      );
      if (!confirm) return;
      lawGroupIdToUse = selectedLaw.lawGroupId;
    }

    setSubmitting(true);
    try {
      const newLawId = await createLaw({
        ...formData,
        lawGroupId: lawGroupIdToUse,
        selectedLawId: selectedLaw?.id,
        articles: previewArticles.map((a, i) => ({ ...a, order: i + 1 }))
      });
      alert('录入成功！');
      router.push(`/law/${newLawId}`);
    } catch (e: any) { alert('录入失败: ' + e.message); setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-8 py-5 flex justify-between items-center bg-slate-50/50">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">录入新法规</h1>
            <Link href="/admin/laws" className="text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors">取消返回</Link>
        </div>

        <div className="p-8 space-y-4">
            {/* 快速解析输入框 */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200">
                <label className="block text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">
                    ⚡ 快速导入（粘贴法规元数据后点击"解析"）
                </label>
                <textarea
                    className="w-full h-28 p-3 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-xs leading-relaxed resize-none"
                    placeholder="粘贴格式如下：&#10;中华人民共和国渔业法(2025修订)  English 尚未生效&#10;【法宝引证码】CLI.1.5332699 &#10;制定机关：全国人大常委会&#10;发文字号：中华人民共和国主席令第63号&#10;公布日期：2025.12.27&#10;施行日期：2026.05.01&#10;时效性：尚未生效&#10;效力位阶：法律&#10;法规类别：渔业资源繁殖保护 渔业管理"
                    value={quickInputText}
                    onChange={e => setQuickInputText(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={handleParseQuickInput}
                        className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all shadow-md text-sm"
                    >
                        解析并填充表单
                    </button>
                    <button
                        onClick={() => setQuickInputText('')}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-all text-sm"
                    >
                        清空
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">法规名称</label>
                <input type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={formData.title} onChange={e => setData({...formData, title: e.target.value})} placeholder="如：中华人民共和国食品安全法" />
            </div>

                {/* 关联现有法规 */}
                <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={shouldLinkExisting}
                                onChange={e => setShouldLinkExisting(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm font-semibold text-slate-700">关联到现有法规（同一条法规的不同版本）</span>
                        </label>
                        {selectedLaw && (
                            <button
                                onClick={handleClearSelection}
                                className="text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                                清除选择
                            </button>
                        )}
                    </div>

                    {shouldLinkExisting && (
                        <div className="space-y-3">
                            {matchHint?.recommended && !selectedLaw && !hasExplicitNoLink && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                    <div className="text-xs text-emerald-700 font-semibold mb-1">系统推荐自动关联</div>
                                    <div className="text-sm text-slate-800 font-medium">{matchHint.recommended.title}</div>
                                    <div className="text-xs text-slate-600 mt-1">
                                        {matchHint.recommended.matchReason || '标准化标题命中'}
                                        {typeof matchHint.recommended.score === 'number' && (
                                            <span> · 置信度 {Math.round(matchHint.recommended.score * 100)}%</span>
                                        )}
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => handleSelectLaw(matchHint.recommended!)}
                                            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition-colors"
                                        >
                                            使用推荐
                                        </button>
                                        <button
                                            onClick={handleChooseNoLink}
                                            className="px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded text-xs font-medium hover:bg-slate-50 transition-colors"
                                        >
                                            不关联
                                        </button>
                                    </div>
                                </div>
                            )}

                            {matchHint && (
                                <div className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                    标准化标题：{matchHint.normalizedTitle || '—'}；核心标题：{matchHint.baseTitle || '—'}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs text-slate-500 mb-1">搜索现有法规（输入名称关键字）</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    placeholder="如：公司法、食品安全法..."
                                    value={searchKeyword}
                                    onChange={e => handleSearchLaws(e.target.value)}
                                />
                            </div>

                            {/* 搜索结果 */}
                            {searchKeyword && searchResults.length > 0 && !selectedLaw && (
                                <div className="bg-white border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                                    {searchResults.map(law => (
                                        <button
                                            key={law.id}
                                            onClick={() => handleSelectLaw(law)}
                                            className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                                        >
                                            <div className="text-sm font-medium text-slate-800">{law.title}</div>
                                            <div className="text-xs text-slate-500 mt-1 flex gap-2 flex-wrap">
                                                <span>{law.level}</span>
                                                <span>•</span>
                                                <span>{law.status}</span>
                                                {law.effectiveDate && (
                                                    <>
                                                        <span>•</span>
                                                        <span>施行: {new Date(law.effectiveDate).toLocaleDateString('zh-CN')}</span>
                                                    </>
                                                )}
                                                {law.promulgationDate && (
                                                    <>
                                                        <span>•</span>
                                                        <span>公布: {new Date(law.promulgationDate).toLocaleDateString('zh-CN')}</span>
                                                    </>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* 选中的法规 */}
                            {selectedLaw && (
                                <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="text-xs text-blue-600 font-medium mb-1">已选择关联法规</div>
                                            <div className="text-sm font-semibold text-slate-800 mb-1">{selectedLaw.title}</div>
                                            <div className="text-xs text-slate-600">
                                                将使用相同的 lawGroupId: <code className="bg-blue-200 px-1 rounded">{selectedLaw.lawGroupId}</code>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                系统会根据公布/施行时间自动判断新旧版本
                                            </div>
                                            {selectedLaw.matchReason && (
                                                <div className="text-xs text-slate-500 mt-1">
                                                    匹配依据：{selectedLaw.matchReason}
                                                    {typeof selectedLaw.score === 'number' && (
                                                        <span> · 置信度 {Math.round(selectedLaw.score * 100)}%</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {hasExplicitNoLink && (
                                <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                                    已明确选择不关联，保存时将生成新的 lawGroupId。
                                </div>
                            )}

                            {isSearching && (
                                <div className="text-xs text-slate-500 text-center py-2">搜索中...</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">制定机关</label>
                        <input type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.issuingAuthority || ''} onChange={e => setData({...formData, issuingAuthority: e.target.value})} placeholder="全国人大常委会" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">发文字号</label>
                        <input type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.documentNumber || ''} onChange={e => setData({...formData, documentNumber: e.target.value})} placeholder="主席令第66号" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">公布日期</label>
                        <input type="date" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.promulgationDate} onChange={e => setData({...formData, promulgationDate: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">施行日期</label>
                        <input type="date" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.effectiveDate} onChange={e => setData({...formData, effectiveDate: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">时效性</label>
                        <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={formData.status} onChange={e => setData({...formData, status: e.target.value})}>
                            {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">位阶</label>
                        <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={formData.level} onChange={e => setData({...formData, level: e.target.value})}>
                            {LEVEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">类别</label>
                        <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={formData.category} onChange={e => setData({...formData, category: e.target.value})}>
                            {CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">区域</label>
                        <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" value={formData.region} onChange={e => setData({...formData, region: e.target.value})}>
                            {REGION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">全文粘贴</label>
                    <textarea className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm leading-relaxed" value={formData.rawContent} onChange={e => setData({...formData, rawContent: e.target.value})} placeholder="第一章 总则..."></textarea>
                </div>

                <button onClick={handleParseContent} disabled={isParsing} className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                  {isParsing ? '解析中...' : '解析文本结构'}
                </button>

                <div className="bg-yellow-50/50 rounded-lg p-4 border border-yellow-200">
                    <label className="block text-xs font-bold text-yellow-600 uppercase tracking-widest mb-2">修订记录（可选 - 放在正文前可解析）</label>
                    <textarea
                        className="w-full h-24 p-3 bg-white border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none font-mono text-xs leading-relaxed resize-none"
                        placeholder="输入修订记录，如（2xxx年x月xx日xxxx令第xx号公布 根据2xxx年x月xx日...）"
                        value={formData.preamble || ''}
                        onChange={e => setData({...formData, preamble: e.target.value})}
                    />
                    <div className="mt-2 text-xs text-yellow-700 bg-yellow-100/50 rounded px-2 py-1">
                        💡 提示：粘贴全文时请从修订记录开始，无需复制法规标题
                    </div>
                </div>
        </div>

        <div className="bg-slate-50 flex flex-col h-[800px]">
            <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10 flex justify-between items-center">
                <span className="font-bold text-slate-500 text-sm tracking-tight">预览分条 ({previewArticles.length})</span>
                {previewArticles.length > 0 && (
                    <button onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 text-white px-6 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md shadow-blue-100 disabled:opacity-50">确认并保存</button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {previewArticles.map((art, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">{art.title}</span>
                            {art.chapter && <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{art.chapter}</span>}
                            {art.section && <span className="text-[10px] text-slate-400 font-medium">→ {art.section}</span>}
                        </div>
                        {art.paragraphs ? (
                            <div className="space-y-3">
                                {art.paragraphs.map((para: any, pIdx: number) => {
                                    // 判断是否需要显示"第X款"标签
                                    // 规则：只有1款且无项时，不显示标签
                                    const shouldShowLabel = (art.paragraphs?.length || 0) > 1 || (para.items && para.items.length > 0);

                                    return (
                                        <div key={pIdx} className="ml-4 border-l-2 border-slate-200 pl-3">
                                            {/* 只有当需要时才显示"第X款"标签 */}
                                            {shouldShowLabel && (
                                                <div className="text-[10px] text-slate-400 font-medium mb-1">第{para.number}款</div>
                                            )}
                                            {para.items && para.items.length > 0 ? (
                                                <div className="space-y-1">
                                                    {para.content && (
                                                        <div className="text-slate-600 text-sm leading-relaxed mb-2">{para.content}</div>
                                                    )}
                                                    {para.items.map((item: any, iIdx: number) => (
                                                        <div key={iIdx} className="text-sm text-slate-600">
                                                            <span className="font-medium text-slate-700">{item.number}</span> {item.content}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{para.content}</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{art.content}</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}
