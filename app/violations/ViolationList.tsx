'use client'

import Link from 'next/link';

interface ViolationListProps {
  violations: any[];
}

// 格式化条款编号
function formatArticleReference(
  articleTitle: string | null,
  paragraphNumber: number | null,
  itemNumber: string | null
): string {
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
}

export default function ViolationList({ violations }: ViolationListProps) {
  if (violations.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="text-center py-20">
          <p className="text-slate-400 text-base">暂无相关违法行为</p>
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
              <th className="px-4 py-3 text-left font-semibold text-slate-700" style={{ minWidth: '100px' }}>
                编号
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700" style={{ minWidth: '250px' }}>
                违法行为描述
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700" style={{ minWidth: '300px' }}>
                违法依据
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700" style={{ minWidth: '300px' }}>
                处罚依据
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
                            className="text-blue-600 hover:text-blue-800 hover:underline"
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
                            className="text-blue-600 hover:text-blue-800 hover:underline"
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
