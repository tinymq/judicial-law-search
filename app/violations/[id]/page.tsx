import { prisma } from '@/src/lib/db';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ThemeToggle from '@/components/ThemeToggle';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ADMIN_CONFIG } from '@/app/admin/admin-config';
import '@/app/app-styles.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const violation = await prisma.violation.findUnique({
    where: { id: parseInt(id) },
    select: { code: true, description: true }
  });

  if (!violation) {
    return { title: '违法行为未找到' };
  }

  return {
    title: `${violation.code} - ${violation.description.substring(0, 20)}... - 可为法规随手查`,
  };
}

// 转换项序号：（一）→ 第一项（保持中文，不做数字转换）
function convertItemNumber(itemNumber: string): string {
  // 去掉括号，保留中文数字
  const num = itemNumber.replace(/[()（）]/g, '');
  return `第${num}项`;
}

// 格式化条款引用（整合成单段文本）
// 返回 {序号部分, 内容部分}
function formatLegalCitation(
  articleTitle: string,
  articleParagraphs?: Array<{ content?: string | null } | null> | null,
  paragraph?: { number?: number | null; content?: string | null } | null,
  item?: { number?: string | null; content?: string | null } | null
): { number: string; content: string } {
  const chineseNumbers = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

  // 构建序号部分
  const numberParts: string[] = [];

  // 条的序号
  let articleNumber = articleTitle;
  if (!articleNumber.includes('第')) {
    articleNumber = `第${articleNumber}条`;
  } else if (!articleNumber.includes('条')) {
    articleNumber = `${articleNumber}条`;
  }
  numberParts.push(articleNumber);

  // 款的序号
  if (paragraph?.number !== undefined && paragraph.number !== null) {
    const cnNum = chineseNumbers[paragraph.number] || paragraph.number.toString();
    numberParts.push(`第${cnNum}款`);
  }

  // 项的序号（转换为阿拉伯数字）
  if (item?.number) {
    numberParts.push(convertItemNumber(item.number));
  }

  // 构建内容部分
  const contentParts: string[] = [];

  // 如果选择了项，先添加款的内容
  if (item?.number && paragraph?.content) {
    contentParts.push(paragraph.content);
  }

  // 如果选择了项，添加该项的内容（带冒号）
  if (item?.content) {
    // 检查款的内容是否以冒号结尾，避免双冒号
    const needsColon = !paragraph?.content?.endsWith('：') && !paragraph?.content?.endsWith(':');
    contentParts.push(`${needsColon ? '：' : ''}${item.number}${item.content}`);
  }
  // 如果只选择了款，添加该款的内容
  else if (paragraph?.content) {
    contentParts.push(paragraph.content);
  }
  // 如果只选择了条，添加所有款的内容
  else if (articleParagraphs && articleParagraphs.length > 0) {
    const allContent = articleParagraphs
      .filter((p): p is { content?: string | null } => p !== null)
      .map(p => p.content ?? '')
      .filter(c => c !== '')
      .join(' ');
    contentParts.push(allContent);
  }

  return {
    number: numberParts.join(''),
    content: contentParts.join('')
  };
}

// 获取法条内容
function getArticleContent(
  paragraph?: { content?: string | null } | null,
  item?: { content?: string | null } | null,
  articleParagraphs?: { content?: string | null }[] | null
): string {
  if (item?.content) {
    return item.content;
  }
  if (paragraph?.content) {
    return paragraph.content;
  }
  if (articleParagraphs && articleParagraphs.length > 0) {
    return articleParagraphs.map(p => p.content).join('\n');
  }
  return '';
}

export default async function ViolationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const violation = await prisma.violation.findUnique({
    where: { id: parseInt(id) },
    include: {
      violationBasisLaw: {
        select: {
          id: true,
          title: true,
          level: true,
        }
      },
      violationBasisArticle: {
        select: {
          id: true,
          title: true,
          paragraphs: {
            select: {
              id: true,
              number: true,
              content: true,
              order: true,
              items: {
                select: {
                  id: true,
                  number: true,
                  content: true,
                  order: true
                },
                orderBy: { order: 'asc' }
              }
            },
            orderBy: { order: 'asc' }
          }
        }
      },
      violationBasisParagraph: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
      violationBasisItem: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
      punishmentBasisLaw: {
        select: {
          id: true,
          title: true,
          level: true,
        }
      },
      punishmentBasisArticle: {
        select: {
          id: true,
          title: true,
          paragraphs: {
            select: {
              id: true,
              number: true,
              content: true,
              order: true,
              items: {
                select: {
                  id: true,
                  number: true,
                  content: true,
                  order: true
                },
                orderBy: { order: 'asc' }
              }
            },
            orderBy: { order: 'asc' }
          }
        }
      },
      punishmentBasisParagraph: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
      punishmentBasisItem: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
    },
  });

  if (!violation) {
    notFound();
  }

  // 主题支持
  const theme = ADMIN_CONFIG.getTheme(new URLSearchParams());
  const isOptimized = ADMIN_CONFIG.isOptimized(theme);
  const themeClass = isOptimized ? 'app-optimized' : '';

  return (
    <div className={`min-h-screen bg-slate-50 font-sans text-slate-900 ${themeClass}`}>
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <SiteHeader />

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link
              href="/violations"
              target="_blank"
              className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline"
            >
              查询界面
            </Link>
            <Link
              href={`/admin/violations/${violation.id}/edit`}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 text-sm"
            >
              修改
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* 页面标题 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-900">
              违法行为 {violation.code}
            </h1>
          </div>
        </div>

        {/* 违法行为描述 */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3">违法行为描述</h2>
          <p className="text-base text-slate-900">{violation.description}</p>
        </div>

        {/* 违法依据 */}
        {violation.violationBasisLaw && violation.violationBasisArticle && (() => {
          const citation = formatLegalCitation(
            violation.violationBasisArticle.title,
            violation.violationBasisArticle.paragraphs,
            violation.violationBasisParagraph,
            violation.violationBasisItem
          );
          return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-sm font-bold text-slate-700 mb-3">📋 违法依据</h2>

              <div className="mb-3">
                <Link
                  href={`/law/${violation.violationBasisLaw.id}`}
                  target="_blank"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  {violation.violationBasisLaw.title}
                </Link>
              </div>

              <div className="text-sm text-slate-700 whitespace-pre-wrap">
                <span className="font-bold">{citation.number}</span> {citation.content}
              </div>
            </div>
          );
        })()}

        {/* 处罚依据 */}
        {violation.punishmentBasisLaw && violation.punishmentBasisArticle && (() => {
          const citation = formatLegalCitation(
            violation.punishmentBasisArticle.title,
            violation.punishmentBasisArticle.paragraphs,
            violation.punishmentBasisParagraph,
            violation.punishmentBasisItem
          );
          return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-sm font-bold text-slate-700 mb-3">⚖️ 处罚依据</h2>

              <div className="mb-3">
                <Link
                  href={`/law/${violation.punishmentBasisLaw.id}`}
                  target="_blank"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  {violation.punishmentBasisLaw.title}
                </Link>
              </div>

              <div className="text-sm text-slate-700 whitespace-pre-wrap">
                <span className="font-bold">{citation.number}</span> {citation.content}
              </div>
            </div>
          );
        })()}

        {/* 裁量标准 */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3">⚖️ 裁量标准</h2>
          {violation.sentencingGuidelines ? (
            <div className="text-sm text-slate-700 whitespace-pre-wrap">
              {violation.sentencingGuidelines}
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic">
              （暂无信息，例如：从轻处罚情形 - 及时改正、首次违法；从重处罚情形 - 拒不改正、造成严重后果）
            </div>
          )}
        </div>

        {/* 处罚建议 */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3">💡 处罚建议</h2>
          {violation.punishmentSuggestion ? (
            <div className="text-sm text-slate-700 whitespace-pre-wrap">
              {violation.punishmentSuggestion}
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic">
              （暂无信息，例如：责令限期改正、处以XXX元罚款、吊销许可证、责令停产停业等）
            </div>
          )}
        </div>

        {/* 返回按钮 */}
        <div className="flex gap-3">
          <Link
            href="/violations"
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            返回列表
          </Link>
        </div>
      </main>
    </div>
  );
}
