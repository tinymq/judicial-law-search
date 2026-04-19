'use client'

import { useState, useEffect } from 'react';
import { updateLawWithArticles, findRelatedLaws, getLawGroupMembers, createIndependentLawGroup, mergeIntoLawGroup } from '../../actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { parseQuickInput, parseContent, reconstructText, detectRegionFromTitle } from '../../utils/contentParser';
import {
  LEVEL_OPTIONS,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  REGION_OPTIONS
} from '@/src/lib/category-config';

interface Article {
  id: number;
  title: string;
  chapter: string | null;
  section: string | null;
  order: number;
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
}

interface Law {
  id: number;
  title: string;
  preamble: string | null;
  issuingAuthority: string | null;
  documentNumber: string | null;
  promulgationDate: Date | null;
  effectiveDate: Date | null;
  status: string | null;
  level: string;
  category: string;
  region: string | null;
  lawGroupId: string | null;
  articles: Article[];
}

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
};

export default function EditLawClient({ law }: { law: Law }) {
  const router = useRouter();

  // 格式化日期为 YYYY-MM-DD
  const formatDate = (date: Date | null) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const [formData, setData] = useState({
    title: law.title,
    preamble: law.preamble || '',
    issuingAuthority: law.issuingAuthority || '',
    documentNumber: law.documentNumber || '',
    promulgationDate: formatDate(law.promulgationDate),
    effectiveDate: formatDate(law.effectiveDate),
    status: law.status || '现行有效',
    level: law.level,
    category: law.category,
    region: law.region || detectRegionFromTitle(law.title),
    rawContent: reconstructText(law.articles as any)
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

  // 快速解析格式化的法规信息
  const [quickInputText, setQuickInputText] = useState('');

  // 法规关联相关状态
  const [shouldManageLawGroup, setShouldManageLawGroup] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLaw, setSelectedLaw] = useState<LawOption | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isLoadingGroupMembers, setIsLoadingGroupMembers] = useState(false);
  const [pendingGroupOperation, setPendingGroupOperation] = useState<{
    type: 'independent' | 'merge';
    targetGroupId?: string;
    targetLawTitle?: string;
  } | null>(null);

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

  // ============ 法规关联相关函数 ============

  // 搜索法规
  const handleSearchLaws = async (keyword: string) => {
    setSearchKeyword(keyword);

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
        const result = await findRelatedLaws(keyword, law.id);
        setSearchResults(result.candidates);
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
  const handleSelectLaw = (lawToLink: any) => {
    setSelectedLaw(lawToLink);
    setSearchResults([]);
    setSearchKeyword(lawToLink.title);
  };

  // 取消选择
  const handleClearSelection = () => {
    setSelectedLaw(null);
    setSearchKeyword('');
  };

  // 创建独立的法规组（从当前组分离）- 只记录意图
  const handleCreateIndependentGroup = () => {
    const memberCount = groupMembers.length;
    const confirmMsg = memberCount > 1
      ? `确定要创建独立的法规组吗？\n\n这将断开与当前组内所有法规的关联：\n${groupMembers.map(m => `[${m.id}] ${m.title}`).join('\n')}\n\n⚠️ 此操作将在"更新并保存"时执行。\n如果点"取消返回"，操作将不会执行。`
      : `确定要创建独立的法规组吗？\n\n⚠️ 此操作将在"更新并保存"时执行。\n如果点"取消返回"，操作将不会执行。`;

    const confirm = window.confirm(confirmMsg);
    if (!confirm) return;

    setPendingGroupOperation({ type: 'independent' });
    setShouldManageLawGroup(false); // 收起管理面板

    // 显示提示
    const confirm2 = window.confirm(
      '✅ 已记录操作意图：创建独立组\n\n' +
      '请点击页面底部的"更新并保存"按钮执行。\n\n' +
      '如果点"取消返回"，操作将不会执行。'
    );
  };

  // 合并到其他法规组 - 只记录意图
  const handleMergeIntoOtherGroup = () => {
    if (!selectedLaw) {
      alert('请先选择要合并到的法规');
      return;
    }

    const targetGroupId = selectedLaw.lawGroupId;
    if (!targetGroupId) {
      alert('目标法规缺少 lawGroupId，无法合并');
      return;
    }

    const confirm = window.confirm(
      `确定要合并到法规组 "${targetGroupId}" 吗？\n\n` +
      `当前法规将加入该组，与该组内的所有法规建立关联：\n` +
      `当前法规: [${law.id}] ${law.title}\n` +
      `目标法规: [${selectedLaw.id}] ${selectedLaw.title}\n\n` +
      `⚠️ 此操作将在"更新并保存"时执行。\n` +
      `如果点"取消返回"，操作将不会执行。`
    );

    if (!confirm) return;

    setPendingGroupOperation({
      type: 'merge',
      targetGroupId: targetGroupId,
      targetLawTitle: selectedLaw.title
    });
    setShouldManageLawGroup(false); // 收起管理面板

    // 显示提示
    window.confirm(
      '✅ 已记录操作意图：合并到法规组\n\n' +
      `目标: ${selectedLaw.title}\n` +
      `法规组: ${targetGroupId}\n\n` +
      '请点击页面底部的"更新并保存"按钮执行。\n\n' +
      '如果点"取消返回"，操作将不会执行。'
    );
  };

  // 取消待执行的操作
  const handleCancelPendingOperation = () => {
    const confirm = window.confirm('确定要取消待执行的法规组操作吗？');
    if (!confirm) return;
    setPendingGroupOperation(null);
  };

  // ============ 原有业务逻辑 ============
  // 初始化时解析现有条款
  useEffect(() => {
    if (law.articles.length > 0) {
      const articles = law.articles.map(a => ({
        title: a.title,
        content: null,
        chapter: a.chapter || null,
        section: a.section || null,
        paragraphs: a.paragraphs?.map(p => ({
          number: p.number,
          content: p.content,
          order: p.order,
          items: p.items?.map(i => ({
            number: i.number,
            content: i.content,
            order: i.order
          }))
        })) || [],
        order: a.order
      }));
      setPreview(articles);
    }
  }, [law.articles]);

  // 初始化时获取同组法规
  useEffect(() => {
    const fetchGroupMembers = async () => {
      if (!law.lawGroupId) {
        setGroupMembers([]);
        return;
      }

      setIsLoadingGroupMembers(true);
      try {
        const members = await getLawGroupMembers(law.lawGroupId);
        setGroupMembers(members);
      } catch (error) {
        console.error('获取同组法规失败:', error);
        setGroupMembers([]);
      } finally {
        setIsLoadingGroupMembers(false);
      }
    };

    fetchGroupMembers();
  }, [law.lawGroupId]);

  const handleSubmit = async () => {
    if (!formData.title || previewArticles.length === 0) {
      alert('请填写标题并解析内容');
      return;
    }

    // 如果有待执行的法规组操作，确认
    if (pendingGroupOperation) {
      const operationDesc = pendingGroupOperation.type === 'independent'
        ? '创建独立组（断开所有关联）'
        : `合并到法规组 ${pendingGroupOperation.targetGroupId}`;

      const confirm = window.confirm(
        `即将执行以下法规组操作：\n\n${operationDesc}\n\n` +
        `确定要继续吗？`
      );
      if (!confirm) return;
    }

    setSubmitting(true);
    try {
      // 先执行法规组操作
      if (pendingGroupOperation?.type === 'independent') {
        await createIndependentLawGroup(law.id);
      } else if (pendingGroupOperation?.type === 'merge') {
        await mergeIntoLawGroup(law.id, pendingGroupOperation.targetGroupId!);
      }

      // 再更新法规内容
      await updateLawWithArticles(law.id, {
        ...formData,
        articles: previewArticles.map((a, i) => ({ ...a, order: i + 1 }))
      });

      alert('更新成功！');
      router.push(`/law/${law.id}`);
    } catch (e: any) {
      alert('更新失败: ' + e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-8 py-5 flex justify-between items-center bg-slate-50/50">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">编辑法规全文</h1>
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

            {/* 修订记录（元数据，解析正文时会自动回填） */}
            <div className="bg-yellow-50/50 rounded-lg p-4 border border-yellow-200">
                <label className="block text-xs font-bold text-yellow-600 uppercase tracking-widest mb-2">修订记录（可选）</label>
                <textarea
                    className="w-full h-24 p-3 bg-white border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none font-mono text-xs leading-relaxed resize-none"
                    placeholder="输入修订记录，如（2xxx年x月xx日xxxx令第xx号公布 根据2xxx年x月xx日...）"
                    value={formData.preamble || ''}
                    onChange={e => setData({...formData, preamble: e.target.value})}
                />
                <div className="mt-2 text-xs text-yellow-700 bg-yellow-100/50 rounded px-2 py-1">
                    💡 如果正文开头已含修订记录，解析后会自动填充此字段；否则手动输入
                </div>
            </div>

            {/* 法规关联管理 */}
            <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">法规组管理</h3>

                {/* 显示当前 lawGroupId */}
                <div className="mb-3 p-3 bg-white rounded border border-slate-200">
                    <div className="text-xs text-slate-500 mb-1">当前法规组 ID</div>
                    <code className="text-xs font-mono text-blue-700 break-all block">
                        {law.lawGroupId || '未设置'}
                    </code>
                </div>

                {/* 显示已关联的法规 */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-slate-500">
                            已关联的法规
                            {isLoadingGroupMembers ? ' (加载中...)' : ` (${groupMembers.length} 条)`}
                        </div>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={shouldManageLawGroup}
                                onChange={e => setShouldManageLawGroup(e.target.checked)}
                                className="w-3 h-3 text-blue-600 rounded focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs text-slate-600">管理</span>
                        </label>
                    </div>

                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {groupMembers.length === 0 ? (
                            <div className="text-xs text-slate-400 italic p-2">未关联任何法规</div>
                        ) : (
                            groupMembers.map(member => (
                                <div
                                    key={member.id}
                                    className={`text-xs p-2 rounded border ${
                                        member.id === law.id
                                            ? 'bg-blue-100 border-blue-300'
                                            : 'bg-white border-slate-200'
                                    }`}
                                >
                                    <span className={member.id === law.id ? 'font-bold text-blue-700' : 'text-slate-700'}>
                                        {member.id === law.id ? '✓ ' : ''}[{member.id}] {member.title}
                                    </span>
                                    <div className="text-[10px] text-slate-500 mt-1">
                                        {member.status} · 施行: {member.effectiveDate ? new Date(member.effectiveDate).toLocaleDateString('zh-CN') : '—'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 管理操作 */}
                {shouldManageLawGroup && (
                    <div className="space-y-3 pt-3 border-t border-blue-200">
                        {/* 操作1: 创建独立组 */}
                        <button
                            onClick={handleCreateIndependentGroup}
                            className="w-full py-2 bg-slate-600 text-white rounded text-sm font-medium hover:bg-slate-700 transition-colors"
                        >
                            创建独立组（断开所有关联）
                        </button>

                        {/* 操作2: 合并到其他组 */}
                        <div className="space-y-2">
                            <div className="text-xs text-slate-600 font-medium">切换到其他法规组</div>
                            <input
                                type="text"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                placeholder="搜索法规名称..."
                                value={searchKeyword}
                                onChange={e => handleSearchLaws(e.target.value)}
                            />

                            {/* 搜索结果 */}
                            {searchKeyword && searchResults.length > 0 && !selectedLaw && (
                                <div className="bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                                    {searchResults.map((lawItem) => (
                                        <button
                                            key={lawItem.id}
                                            onClick={() => handleSelectLaw(lawItem)}
                                            className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                                        >
                                            <div className="text-sm font-medium text-slate-800">{lawItem.title}</div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                法规组: <code className="text-[10px] bg-slate-100 px-1 rounded">{lawItem.lawGroupId}</code>
                                            </div>
                                            {lawItem.matchReason && (
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {lawItem.matchReason}
                                                    {typeof lawItem.score === 'number' && (
                                                        <span> · 置信度 {Math.round(lawItem.score * 100)}%</span>
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* 选中的法规 */}
                            {selectedLaw && (
                                <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="text-xs text-blue-600 font-medium mb-1">已选择目标法规组</div>
                                            <div className="text-sm font-semibold text-slate-800 mb-1">{selectedLaw.title}</div>
                                            <div className="text-xs text-slate-600 mb-2">
                                                法规组 ID: <code className="bg-blue-200 px-1 rounded">{selectedLaw.lawGroupId}</code>
                                            </div>
                                            {selectedLaw.matchReason && (
                                                <div className="text-xs text-slate-500 mb-2">
                                                    {selectedLaw.matchReason}
                                                    {typeof selectedLaw.score === 'number' && (
                                                        <span> · 置信度 {Math.round(selectedLaw.score * 100)}%</span>
                                                    )}
                                                </div>
                                            )}
                                            <button
                                                onClick={handleMergeIntoOtherGroup}
                                                className="w-full py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                                            >
                                                确认合并到此组
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleClearSelection}
                                            className="text-xs text-red-600 hover:text-red-700 font-medium ml-2"
                                        >
                                            取消
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isSearching && (
                                <div className="text-xs text-slate-500 text-center py-2">搜索中...</div>
                            )}
                        </div>
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
        </div>

        <div className="bg-slate-50 flex flex-col h-[800px]">
            <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10 space-y-3">
                {/* 待保存的法规组操作提示 */}
                {pendingGroupOperation && (
                    <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-3">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="text-xs text-yellow-800 font-medium mb-1">
                                    ⚠️ 待保存的法规组操作
                                </div>
                                <div className="text-xs text-yellow-700">
                                    {pendingGroupOperation.type === 'independent'
                                        ? '创建独立组（断开所有关联）'
                                        : `合并到法规组 ${pendingGroupOperation.targetGroupId}`
                                    }
                                    {pendingGroupOperation.targetLawTitle && (
                                        <div className="mt-1">
                                          目标法规: {pendingGroupOperation.targetLawTitle}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleCancelPendingOperation}
                                className="text-xs text-red-600 hover:text-red-700 font-medium ml-3"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500 text-sm tracking-tight">
                        预览分条 ({previewArticles.length})
                    </span>
                    {previewArticles.length > 0 && (
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="bg-blue-600 text-white px-6 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md shadow-blue-100 disabled:opacity-50"
                        >
                            更新并保存
                        </button>
                    )}
                </div>
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
