import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ThemeToggle from '@/components/ThemeToggle';
import { prisma } from '@/src/lib/db';
import { notFound } from 'next/navigation';
import { getCategoryColor, LEVEL_COLORS } from '@/src/lib/enforcement-constants';
import { parseLegalBasis, extractBasisLawNames } from '@/src/lib/legal-basis-parser';
import LinkLawEditor from './LinkLawEditor';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await prisma.enforcementItem.findUnique({
    where: { id: parseInt(id) },
    select: { name: true },
  });
  return { title: item ? `${item.name} - 执法事项` : '执法事项未找到' };
}


// 规范化法规名称用于匹配
function normalizeLawName(name: string): string {
  return name
    .replace(/^中华人民共和国/, '')
    .replace(/\(\d{4}年?[^)]*\)/, '')
    .replace(/（\d{4}年?[^）]*）/, '')
    .replace(/\s+/g, '')
    .trim();
}

// 将《》内匹配到法规库的部分渲染为链接，其余保持普通文本
function renderBracketParts(
  text: string,
  lawNameToId: Map<string, number>,
  keyPrefix: string,
): React.ReactNode[] {
  const parts = text.split(/(《[^》]+》)/g);
  return parts.map((part, i) => {
    const match = part.match(/^《(.+)》$/);
    if (match) {
      const name = match[1].replace(/\s+/g, '').trim();
      const lawId = lawNameToId.get(name);
      if (lawId) {
        return (
          <Link key={`${keyPrefix}-${i}`} href={`/law/${lawId}`}
            className="text-blue-600 hover:text-blue-800 hover:underline underline-offset-2"
            title="查看法规详情">{part}</Link>
        );
      }
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

// 格式化展示执法依据：多条空行分隔，法规名（含无《》的）渲染为链接
function renderLegalBasisText(
  text: string,
  lawNameToId: Map<string, number>,
) {
  const entries = parseLegalBasis(text);
  if (entries.length === 0) return renderBracketParts(text, lawNameToId, '0');

  const elements: React.ReactNode[] = [];

  entries.forEach((entry, idx) => {
    if (idx > 0) elements.push(<span key={`sep-${idx}`}>{'\n\n'}</span>);

    const raw = entry.rawText;
    const hasBracketName = /^(?:\d+[.．、]?\s*)?《/.test(raw);

    if (!hasBracketName && entry.lawName) {
      const namePos = raw.indexOf(entry.lawName);
      if (namePos >= 0) {
        const before = raw.substring(0, namePos);
        const after = raw.substring(namePos + entry.lawName.length);
        if (before) elements.push(<span key={`${idx}-b`}>{before}</span>);
        const lawId = lawNameToId.get(entry.lawName);
        if (lawId) {
          elements.push(
            <Link key={`${idx}-n`} href={`/law/${lawId}`}
              className="text-blue-600 hover:text-blue-800 hover:underline underline-offset-2"
              title="查看法规详情">{entry.lawName}</Link>
          );
        } else {
          elements.push(<span key={`${idx}-n`}>{entry.lawName}</span>);
        }
        elements.push(...renderBracketParts(after, lawNameToId, `${idx}-a`));
        return;
      }
    }

    elements.push(...renderBracketParts(raw, lawNameToId, `${idx}`));
  });

  return elements;
}

export default async function EnforcementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.enforcementItem.findUnique({
    where: { id: parseInt(id) },
    include: {
      law: { select: { id: true, title: true, level: true, issuingAuthority: true, lawGroupId: true, effectiveDate: true } },
      industry: true,
      parent: { select: { id: true, name: true } },
      children: {
        select: { id: true, name: true, lawId: true, law: { select: { id: true, title: true } } },
        orderBy: { sequenceNumber: 'asc' },
      },
    },
  });

  if (!item) return notFound();

  // 从执法依据中提取每条依据的法规名（不含条文正文中的交叉引用）
  const citedNames = item.legalBasisText ? extractBasisLawNames(item.legalBasisText) : [];
  let matchedLaws: { id: number; title: string; level: string | null; issuingAuthority: string | null; lawGroupId: string | null; effectiveDate: Date | null }[] = [];
  const lawNameToId = new Map<string, number>();

  if (citedNames.length > 0) {
    // 加载候选法规（含 lawGroupId 和 effectiveDate 用于去重取最新）
    const dbLaws = await prisma.law.findMany({
      where: {
        OR: citedNames.map(name => ({
          title: { contains: normalizeLawName(name) },
        })),
      },
      select: { id: true, title: true, level: true, issuingAuthority: true, lawGroupId: true, effectiveDate: true },
    });

    // 对每个引用的法规名进行匹配（精确优先，模糊仅允许后缀匹配避免子串误匹配）
    const seenGroups = new Set<string>(); // 按 lawGroupId 去重，同组只保留最新版
    for (const cited of citedNames) {
      const normCited = normalizeLawName(cited);
      // 精确匹配优先
      let candidates = dbLaws.filter(law => normalizeLawName(law.title) === normCited);
      // 后缀匹配：引用名是法规名的后缀（如"广告法"→"中华人民共和国广告法"）
      if (candidates.length === 0) {
        candidates = dbLaws.filter(law => {
          const normTitle = normalizeLawName(law.title);
          return normTitle.endsWith(normCited) || normCited.endsWith(normTitle);
        });
      }
      if (candidates.length === 0) continue;

      // 同组取最新（按 effectiveDate 降序）
      candidates.sort((a, b) => {
        const da = a.effectiveDate?.getTime() ?? 0;
        const db = b.effectiveDate?.getTime() ?? 0;
        return db - da;
      });
      const best = candidates[0];

      // 去重：同一 lawGroupId 只展示一次
      const groupKey = best.lawGroupId || `solo_${best.id}`;
      if (seenGroups.has(groupKey)) {
        // 同组已有，仍然建立名称映射（让《》链接能用）
        lawNameToId.set(cited, best.id);
        continue;
      }
      seenGroups.add(groupKey);
      matchedLaws.push(best);
      lawNameToId.set(cited, best.id);
    }
  }

  // 确保 lawId 关联的主法规也在列表中（取同组最新版）
  if (item.law) {
    const primaryLaw = await prisma.law.findFirst({
      where: item.law.lawGroupId
        ? { lawGroupId: item.law.lawGroupId }
        : { id: item.law.id },
      select: { id: true, title: true, level: true, issuingAuthority: true, lawGroupId: true, effectiveDate: true },
      orderBy: { effectiveDate: 'desc' },
    });
    if (primaryLaw && !matchedLaws.find(l => l.id === primaryLaw.id)) {
      // 如果同组旧版在列表中，替换为最新版
      const oldIdx = matchedLaws.findIndex(l => l.lawGroupId && l.lawGroupId === primaryLaw.lawGroupId);
      if (oldIdx >= 0) {
        matchedLaws[oldIdx] = primaryLaw;
      } else {
        matchedLaws.unshift(primaryLaw);
      }
    }
  }

  const color = getCategoryColor(item.category);
  const levels = item.enforcementLevel?.split(',').filter(Boolean) || [];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary,#faf8f5)] font-sans text-slate-900">
      {/* 顶部导航栏 */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <SiteHeader />
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              法规检索
            </Link>
            <Link href="/enforcement" className="text-sm font-semibold text-slate-900 hidden sm:inline">
              执法事项
            </Link>
            <Link href="/enforcement/plan" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              梳理方案
            </Link>
            <Link href="/admin/laws" target="_blank" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">
              后台管理
            </Link>
            <ThemeToggle variant="app" className="ml-1 sm:ml-2" />
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* 返回链接 + 父事项面包屑 */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <Link
            href="/enforcement"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            执法事项目录
          </Link>
          {item.parent && (
            <>
              <span className="text-slate-300">/</span>
              <Link
                href={`/enforcement/${item.parent.id}`}
                className="text-slate-400 hover:text-blue-600 transition-colors truncate max-w-[300px]"
              >
                {item.parent.name}
              </Link>
            </>
          )}
        </div>

        {/* 标题区 */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-3">
            <span className={`inline-flex items-center gap-1.5 shrink-0 mt-1 px-2.5 py-1 rounded text-sm font-medium border ${color.bg} ${color.text} ${color.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
              {item.category}
            </span>
            {item.itemStatus && (
              <span className={`shrink-0 mt-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                item.itemStatus === '生效' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {item.itemStatus}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
            {item.name}
          </h1>
          {item.children.length > 0 && (
            <p className="text-sm text-slate-500 mt-2">
              综合事项 · 含 <span className="font-semibold text-indigo-600">{item.children.length}</span> 条子事项
            </p>
          )}
        </div>

        {/* 子事项列表（父事项时显示） */}
        {item.children.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 mb-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">子事项清单</h2>
            <div className="divide-y divide-slate-100">
              {item.children.map((child, i) => (
                <div key={child.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-xs text-slate-400 tabular-nums w-5 shrink-0 pt-0.5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/enforcement/${child.id}`}
                      className="text-sm text-slate-800 hover:text-blue-600 transition-colors leading-snug"
                    >
                      {child.name}
                    </Link>
                    {child.law && (
                      <Link
                        href={`/law/${child.law.id}`}
                        className="block text-xs text-slate-400 hover:text-blue-500 mt-0.5 truncate transition-colors"
                      >
                        依据: {child.law.title}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 元数据卡片 */}
        <div className="bg-white rounded-xl border border-slate-200/60 p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {item.enforcementDomain && (
              <div>
                <dt className="text-sm text-slate-400">执法领域</dt>
                <dd className="text-base text-slate-800 mt-0.5">{item.enforcementDomain}</dd>
              </div>
            )}
            {item.enforcementBody && (
              <div>
                <dt className="text-sm text-slate-400">执法主体</dt>
                <dd className="text-base text-slate-800 mt-0.5">{item.enforcementBody}</dd>
              </div>
            )}
            {levels.length > 0 && (
              <div>
                <dt className="text-sm text-slate-400">行使层级</dt>
                <dd className="flex gap-1.5 mt-1">
                  {levels.map(level => (
                    <span
                      key={level}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[level] || 'bg-slate-100 text-slate-500'}`}
                    >
                      {level}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {item.code && (
              <div>
                <dt className="text-sm text-slate-400">事项编码</dt>
                <dd className="text-base text-slate-800 mt-0.5 font-mono text-sm">{item.code}</dd>
              </div>
            )}
            {item.industry && (
              <div>
                <dt className="text-sm text-slate-400">所属行业</dt>
                <dd className="text-base text-slate-800 mt-0.5">{item.industry.name}</dd>
              </div>
            )}
            {item.handlingDepartment && (
              <div>
                <dt className="text-sm text-slate-400">承办机构</dt>
                <dd className="text-base text-slate-800 mt-0.5">{item.handlingDepartment}</dd>
              </div>
            )}
          </div>
        </div>

        {/* 执法依据 — 父事项不展示（拼合文本不可读，子事项各有独立依据） */}
        {item.legalBasisText && item.children.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 mb-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              执法依据
            </h2>
            <div className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">
              {renderLegalBasisText(item.legalBasisText, lawNameToId)}
            </div>
          </div>
        )}

        {/* 关联法规（含手动修改入口）— 父事项不展示 */}
        {item.children.length === 0 && (
          <LinkLawEditor
            enforcementItemId={item.id}
            linkedLaws={matchedLaws.map(l => ({ id: l.id, title: l.title, level: l.level, issuingAuthority: l.issuingAuthority }))}
            primaryLawId={item.lawId}
          />
        )}

        {/* 检查详情：仅行政检查类事项展示 */}
        {item.category === '行政检查' && (item.checkTarget || item.checkContent) && (
          <div className="bg-white rounded-xl border border-slate-200/60 p-5 mb-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">检查详情</h2>
            <div className="space-y-3">
              {item.checkTarget && (
                <div>
                  <dt className="text-sm text-slate-400">检查对象</dt>
                  <dd className="text-base text-slate-800 mt-0.5">{item.checkTarget}</dd>
                </div>
              )}
              {item.checkContent && (
                <div>
                  <dt className="text-sm text-slate-400">检查内容</dt>
                  <dd className="text-base text-slate-800 mt-0.5 whitespace-pre-wrap">{item.checkContent}</dd>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 备注 */}
        {item.remarks && (
          <div className="bg-slate-50 rounded-xl border border-slate-200/60 p-5 mb-4">
            <h2 className="text-sm font-medium text-slate-400 mb-2">备注</h2>
            <div className="text-base text-slate-600 whitespace-pre-wrap">{item.remarks}</div>
          </div>
        )}
      </section>
    </div>
  );
}
