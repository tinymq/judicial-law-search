'use client'

import { deleteViolation } from '../actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ViolationTableProps {
  violations: any[];
  currentSort: string;
  currentOrder: 'asc' | 'desc';
}

export default function ViolationTable({ violations, currentSort, currentOrder }: ViolationTableProps) {
  const router = useRouter();

  const handleSort = (field: string) => {
    const newOrder = field === currentSort && currentOrder === 'asc' ? 'desc' : 'asc';
    router.push(`/admin/violations?sort=${field}&order=${newOrder}`);
  };

  const SortIcon = ({ field }: { field: string }) => {
    const isActive = field === currentSort;
    const isAsc = isActive && currentOrder === 'asc';

    return (
      <svg
        className={`inline-block ml-1 ${isActive ? 'text-red-600' : 'text-slate-400'}`}
        style={{
          transform: isAsc ? 'rotate(180deg)' : 'none',
          width: '10px',
          height: '10px'
        }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M6 9l6 6 6-6"/>
      </svg>
    );
  };

  // 格式化条款编号
  const formatArticleReference = (
    articleTitle: string | null,
    paragraphNumber: number | null,
    itemNumber: string | null
  ): string => {
    const parts: string[] = [];

    if (articleTitle) {
      // 兼容"十八"、"十八条"、"第十八条"等多种格式
      if (!articleTitle.includes('第')) {
        parts.push(`第${articleTitle}条`);
      } else if (!articleTitle.includes('条')) {
        parts.push(`${articleTitle}条`);
      } else {
        parts.push(articleTitle);
      }
    }

    if (paragraphNumber) {
      const chineseNumbers = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
        '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
      const cnNum = chineseNumbers[paragraphNumber] || paragraphNumber.toString();
      parts.push(`第${cnNum}款`);
    }

    if (itemNumber) {
      parts.push(`第${itemNumber}项`);
    }

    return parts.join('');
  };

  // 处理删除
  const handleDelete = async (id: number, description: string) => {
    if (!confirm(`确定要删除以下违法行为吗？\n\n${description}\n\n此操作不可恢复！`)) {
      return;
    }

    try {
      await deleteViolation(id);
      router.refresh();
    } catch (error) {
      alert('删除失败：' + (error as Error).message);
    }
  };

  if (violations.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="text-center py-20">
          <p className="text-slate-400 text-base">暂无违法行为数据</p>
          <Link
            href="/admin/violations/new"
            className="inline-block mt-4 text-red-600 hover:text-red-700 font-medium"
          >
            录入第一条违法行为 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700"
                style={{ minWidth: '80px' }}
              >
                编号
              </th>
              <th
                onClick={() => handleSort('description')}
                className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                style={{ minWidth: '250px' }}
              >
                违法行为描述
                <SortIcon field="description" />
              </th>
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700"
                style={{ minWidth: '300px' }}
              >
                违法依据
              </th>
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700"
                style={{ minWidth: '300px' }}
              >
                处罚依据
              </th>
              <th
                onClick={() => handleSort('createdAt')}
                className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                style={{ minWidth: '120px' }}
              >
                创建时间
                <SortIcon field="createdAt" />
              </th>
              <th
                className="px-4 py-3 text-center font-semibold text-slate-700"
                style={{ minWidth: '150px' }}
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {violations.map((violation) => (
              <tr key={violation.id} className="hover:bg-slate-50 transition-colors">
                {/* 编号 */}
                <td className="px-4 py-3">
                  <div className="text-slate-900 font-medium text-xs">
                    {violation.code || '-'}
                  </div>
                </td>

                {/* 违法行为描述 */}
                <td className="px-4 py-3">
                  <Link
                    href={`/violations/${violation.id}`}
                    target="_blank"
                    className="text-blue-600 hover:text-blue-800 font-medium line-clamp-2 cursor-pointer"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {violation.description}
                  </Link>
                </td>

                {/* 违法依据 */}
                <td className="px-4 py-3">
                  <div className="text-slate-600">
                    {violation.violationBasisLaw ? (
                      <>
                        <div className="text-xs mb-1">
                          <Link
                            href={`/law/${violation.violationBasisLaw.id}`}
                            target="_blank"
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {violation.violationBasisLaw.title}
                          </Link>
                        </div>
                        {violation.violationBasisArticle && (
                          <div className="text-xs font-medium text-slate-700 mb-1">
                            {formatArticleReference(
                              violation.violationBasisArticle.title,
                              violation.violationBasisParagraph?.number,
                              violation.violationBasisItem?.number
                            )}
                          </div>
                        )}
                        {/* 条款内容 */}
                        {(violation.violationBasisParagraph?.content || violation.violationBasisItem?.content || violation.violationBasisArticle?.paragraphs) && (
                          <div className="text-xs text-slate-600 line-clamp-2">
                            {violation.violationBasisItem?.content ||
                             violation.violationBasisParagraph?.content ||
                             violation.violationBasisArticle?.paragraphs?.map((p: any) => p.content).join(' ')}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">未设置</span>
                    )}
                  </div>
                </td>

                {/* 处罚依据 */}
                <td className="px-4 py-3">
                  <div className="text-slate-600">
                    {violation.punishmentBasisLaw ? (
                      <>
                        <div className="text-xs mb-1">
                          <Link
                            href={`/law/${violation.punishmentBasisLaw.id}`}
                            target="_blank"
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {violation.punishmentBasisLaw.title}
                          </Link>
                        </div>
                        {violation.punishmentBasisArticle && (
                          <div className="text-xs font-medium text-slate-700 mb-1">
                            {formatArticleReference(
                              violation.punishmentBasisArticle.title,
                              violation.punishmentBasisParagraph?.number,
                              violation.punishmentBasisItem?.number
                            )}
                          </div>
                        )}
                        {/* 条款内容 */}
                        {(violation.punishmentBasisParagraph?.content || violation.punishmentBasisItem?.content || violation.punishmentBasisArticle?.paragraphs) && (
                          <div className="text-xs text-slate-600 line-clamp-2">
                            {violation.punishmentBasisItem?.content ||
                             violation.punishmentBasisParagraph?.content ||
                             violation.punishmentBasisArticle?.paragraphs?.map((p: any) => p.content).join(' ')}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">未设置</span>
                    )}
                  </div>
                </td>

                {/* 创建时间 */}
                <td className="px-4 py-3">
                  <div className="text-slate-500 text-xs">
                    {new Date(violation.createdAt).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </div>
                </td>

                {/* 操作 */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      href={`/admin/violations/${violation.id}/edit`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(violation.id, violation.description)}
                      className="text-red-600 hover:text-red-800 font-medium text-xs flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
