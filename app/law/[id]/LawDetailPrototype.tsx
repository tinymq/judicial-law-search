import Link from 'next/link';
import LawHistory from './LawHistory';
import PrototypeToc from './PrototypeToc';
import { resolveStatus } from '@/src/lib/category-config';
import { normalizeArticleTitle, formatArticleTitle } from '@/src/lib/article-utils';

type TocItem = {
  title: string;
  id: string;
  level: 'chapter' | 'section' | 'article';
  children?: TocItem[];
};

function chineseToNumber(chinese: string): string {
  const chineseNums: { [key: string]: number } = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  };

  if (chinese.length === 1 && chineseNums[chinese] !== undefined) return chineseNums[chinese].toString();
  if (chinese.length === 2 && chinese.startsWith('十')) return (10 + (chineseNums[chinese[1]] || 0)).toString();
  if (chinese.length === 2 && chinese.endsWith('十')) return ((chineseNums[chinese[0]] || 0) * 10).toString();
  if (chinese.length === 3 && chinese.includes('十')) {
    return (((chineseNums[chinese[0]] || 0) * 10) + (chineseNums[chinese[2]] || 0)).toString();
  }
  return chinese;
}

function formatDate(value: Date | null | undefined) {
  if (!value) return '-';
  return `${value.getFullYear()}/${value.getMonth() + 1}/${value.getDate()}`;
}

function MetaRow({ label, value }: { label: string; value: string | null | undefined | Date }) {
  let displayValue = '-';
  if (value instanceof Date) {
    displayValue = formatDate(value);
  } else if (value) {
    displayValue = value;
  }

  return (
    <div className="grid grid-cols-[calc((100%-2rem)/6)_1fr] py-1.5 border-b border-slate-100 last:border-0">
      <div className="text-slate-400 font-medium text-sm">{label}</div>
      <div className="text-slate-700 text-sm">{displayValue}</div>
    </div>
  );
}

function LawArticles({ articles, articleFormat = 'standard' }: { articles: Array<any>; articleFormat?: string }) {
  return (
    <div className="space-y-12">
      {articles.map((article, idx) => {
        const isFirstInChapter = idx === 0 || articles[idx - 1].chapter !== article.chapter;
        const isFirstInSection = idx === 0 || articles[idx - 1].section !== article.section;

        return (
          <div key={article.id} id={`article-${article.id}`} className="group scroll-mt-24">
            {article.chapter && article.chapter.trim() !== '' && isFirstInChapter && (
              <div id={`chapter-${article.id}`} className="flex items-center gap-4 mb-8 scroll-mt-24">
                <div className="h-px bg-blue-200 flex-1"></div>
                <span className="text-lg font-bold text-slate-700 bg-white px-6 py-2 border-2 border-blue-300 rounded-lg shadow-sm">
                  {article.chapter}
                </span>
                <div className="h-px bg-blue-200 flex-1"></div>
              </div>
            )}

            {article.section && article.section.trim() !== '' && isFirstInSection && (
              <div id={`section-${article.id}`} className="mb-5 pl-4 border-l-4 border-blue-300">
                <span className="text-lg font-bold text-blue-700">{article.section}</span>
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className="mt-1 flex flex-col items-center">
                <div className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shadow-inner shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {chineseToNumber(normalizeArticleTitle(article.title))}
                </div>
                {idx !== articles.length - 1 && <div className="w-0.5 flex-1 bg-slate-50 mt-2"></div>}
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-lg font-bold text-slate-800 mb-3">{formatArticleTitle(article.title, articleFormat === 'ordinal' ? 'ordinal' : 'standard')}</h3>
                {article.paragraphs?.length > 0 && (
                  <div className="space-y-4">
                    {article.paragraphs.map((para: any) => (
                      <div key={para.id} className="ml-6">
                        {para.content && (
                          <div className="text-slate-700 leading-loose text-lg whitespace-pre-wrap font-serif mb-3">
                            {para.content}
                          </div>
                        )}
                        {para.items?.length > 0 && (
                          <div className="space-y-2 ml-4">
                            {para.items.map((item: any) => (
                              <div key={item.id} className="flex items-start gap-2">
                                <span className="text-blue-600 font-semibold shrink-0">{item.number}</span>
                                <span className="text-slate-700 leading-relaxed text-base font-serif">{item.content}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LawDetailPrototype({
  law,
  lawHistory,
  toc,
  modificationDecisions = [],
  modifiedLawVersions = [],
}: {
  law: any;
  lawHistory: any[];
  toc: TocItem[];
  modificationDecisions?: any[];
  modifiedLawVersions?: any[];
}) {
  const normalizedStatus = resolveStatus(law.status, law.effectiveDate);

  const statusTone =
    normalizedStatus === '现行有效' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
    normalizedStatus === '已被修改' ? 'bg-amber-100 text-amber-800 border-amber-200' :
    normalizedStatus === '已废止' ? 'bg-rose-100 text-rose-800 border-rose-200' :
    'bg-violet-100 text-violet-800 border-violet-200';

  const usageSummary = `这部法规主要服务于${law.industry?.name || '综合'}场景，可用于执法监督与检查清单编制。`;

  return (
    <div id="page-top" className="max-w-7xl mx-auto px-4 py-8">
      <main className="min-w-0">
        <header className="mb-12">
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_28%),linear-gradient(135deg,#f8fbff_0%,#ffffff_52%,#f4f8ff_100%)] p-7 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] md:p-10">
            <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full bg-blue-100/70 blur-2xl" />
            <div className="relative">
              <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 font-semibold ${statusTone}`}>{normalizedStatus}</span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-medium text-slate-700">{law.level}</span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-medium text-slate-700">{law.region || '全国'}</span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-medium text-slate-600">{formatDate(law.effectiveDate)}施行</span>
              </div>

              <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">{law.title}</h1>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)] lg:items-end">
                <div>
                  <p className="max-w-3xl text-lg leading-8 text-slate-700">{usageSummary}</p>
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <a href="#fulltext" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 hover:bg-blue-700">查看法规全文</a>
                    <Link href={`/law/${law.id}`} className="text-sm font-semibold text-slate-600 underline-offset-4 transition hover:text-slate-900 hover:underline">经典版</Link>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-slate-200 bg-white/85 p-5 backdrop-blur-sm">
                  <div className="mb-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">基本信息</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-slate-50 p-3"><div className="text-slate-400">公布日期</div><div className="mt-1 font-semibold text-slate-800">{formatDate(law.promulgationDate)}</div></div>
                    <div className="rounded-2xl bg-slate-50 p-3"><div className="text-slate-400">施行日期</div><div className="mt-1 font-semibold text-slate-800">{formatDate(law.effectiveDate)}</div></div>
                    <div className="rounded-2xl bg-slate-50 p-3"><div className="text-slate-400">效力位阶</div><div className="mt-1 font-semibold text-slate-800">{law.level || '-'}</div></div>
                    <div className="rounded-2xl bg-slate-50 p-3"><div className="text-slate-400">执法领域</div><div className="mt-1 font-semibold text-slate-800">{law.industry?.name || '未分类'}</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="sticky top-16 z-20 mb-8">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
            <a href="#support" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">基本信息</a>
            {lawHistory.length > 0 && (
              <a href="#history" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">历史版本</a>
            )}
            <a href="#fulltext" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">法规全文</a>
            <a href="#page-top" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">回到顶部</a>
          </div>
        </div>

        <section id="support" className="mb-12 scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">基本信息</h2>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 mb-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">发布信息</div>
            <div className="space-y-1 text-base">
              <MetaRow label="制定机关" value={law.issuingAuthority} />
              <MetaRow label="发文字号" value={law.documentNumber} />
              <div className="grid grid-cols-[calc((100%-2rem)/6)_1fr_2rem_calc((100%-2rem)/6)_1fr] py-1.5 border-b border-slate-100">
                <div className="text-slate-400 font-medium text-sm">公布日期</div>
                <div className="text-slate-700 text-sm">{formatDate(law.promulgationDate)}</div>
                <div></div>
                <div className="text-slate-400 font-medium text-sm">施行日期</div>
                <div className="text-slate-700 text-sm">{formatDate(law.effectiveDate)}</div>
              </div>
              <div className="grid grid-cols-[calc((100%-2rem)/6)_1fr_2rem_calc((100%-2rem)/6)_1fr] py-1.5 border-b border-slate-100">
                <div className="text-slate-400 font-medium text-sm">时效性</div>
                <div className={`text-sm font-medium ${
                  normalizedStatus === '现行有效' ? 'text-green-600' :
                  normalizedStatus === '已废止' ? 'text-red-500' :
                  normalizedStatus === '已被修改' ? 'text-blue-600' :
                  normalizedStatus === '尚未生效' ? 'text-red-700' :
                  'text-slate-700'
                }`}>{normalizedStatus}</div>
                <div></div>
                <div className="text-slate-400 font-medium text-sm">效力位阶</div>
                <div className="text-slate-700 text-sm">{law.level || '-'}</div>
              </div>
              <MetaRow label="执法领域" value={law.industry?.name || '未分类'} />
            </div>
          </div>

          {law.preamble && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 mb-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">序言</div>
              <p className="text-base leading-8 text-slate-700 whitespace-pre-wrap font-serif">{law.preamble}</p>
            </div>
          )}

          {(lawHistory.length > 0 || modificationDecisions.length > 0 || modifiedLawVersions.length > 0) && (
            <div id="history" className="scroll-mt-24">
              <LawHistory
                currentLaw={law}
                history={lawHistory}
                modificationDecisions={modificationDecisions}
                modifiedLawVersions={modifiedLawVersions}
              />
            </div>
          )}
        </section>

        <section id="fulltext" className="scroll-mt-24">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">法规全文</h2>
            </div>
            <a href="#page-top" className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:inline-flex">
              回到顶部
            </a>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
            <aside className="hidden lg:block sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
              <PrototypeToc toc={toc} />
            </aside>

            <div className="lg:rounded-[2rem] lg:border lg:border-slate-200 lg:bg-white lg:p-8 lg:shadow-sm">
              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                条款目录现在固定在正文左侧，默认收起；展开后不会覆盖正文，专门承担法条间快速切换的作用。
              </div>
              <div className="mb-4 lg:hidden">
                <PrototypeToc toc={toc} />
              </div>
              <LawArticles articles={law.articles} articleFormat={law.articleFormat} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
