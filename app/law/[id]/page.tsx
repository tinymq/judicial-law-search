import { prisma } from '@/src/lib/db';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ThemeToggle from '@/components/ThemeToggle';
import { notFound } from 'next/navigation';
import BackToTopButton from './BackToTopButton';
import LawHistory from './LawHistory';
import TableOfContents from './TableOfContents';
import type { Metadata } from 'next';
import { ADMIN_CONFIG } from '@/app/admin/admin-config';
import LawDetailPrototype from './LawDetailPrototype';
import RecentViewTracker from '@/src/components/RecentViewTracker';
import { resolveStatus, statusColor } from '@/src/lib/category-config';
import '@/app/app-styles.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const law = await prisma.law.findUnique({
    where: { id: parseInt(id) },
    select: { title: true },
  });

  if (!law) {
    return {
      title: '法规未找到',
    };
  }

  return {
    title: law.title,
  };
}

export default async function LawDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ prototype?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const isPrototype = resolvedSearchParams.prototype === '1';

  const law = await prisma.law.findUnique({
    where: { id: parseInt(id) },
    include: {
      articles: {
        orderBy: { order: 'asc' },
        include: {
          paragraphs: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      }
    }
  });

  if (!law) {
    notFound();
  }

  // 查询同一法规组的历史版本
  const lawHistory = await prisma.law.findMany({
    where: {
      lawGroupId: law.lawGroupId,
      id: { not: law.id } // 排除当前法规
    },
    orderBy: {
      effectiveDate: 'desc'
    },
    select: {
      id: true,
      title: true,
      effectiveDate: true,
      promulgationDate: true,
      status: true
    }
  });

  // 1. 生成目录数据（章-节-条三层结构）
  const toc: { title: string; id: string; level: 'chapter' | 'section' | 'article'; children?: any[] }[] = [];

  // 用于记录已添加的章和节
  const chapterMap = new Map<string, { title: string; id: string; level: 'chapter'; children: any[] }>();
  const sectionMap = new Map<string, any>();

  for (const art of law.articles) {
    // 处理章
    if (art.chapter) {
      if (!chapterMap.has(art.chapter)) {
        const chapterItem = {
          title: art.chapter,
          id: `chapter-${art.id}`,
          level: 'chapter' as const,
          children: []
        };
        chapterMap.set(art.chapter, chapterItem);
        toc.push(chapterItem);
      }
    }

    // 处理节
    if (art.section) {
      const sectionKey = art.chapter ? `${art.chapter}||${art.section}` : art.section;
      if (!sectionMap.has(sectionKey)) {
        const sectionItem = {
          title: art.section,
          id: `section-${art.id}`,
          level: 'section' as const,
          children: []
        };
        sectionMap.set(sectionKey, sectionItem);

        // 将节添加到对应的章下
        if (art.chapter && chapterMap.has(art.chapter)) {
          chapterMap.get(art.chapter)!.children.push(sectionItem);
        } else {
          toc.push(sectionItem);
        }
      }
    }

    // 处理条
    const articleItem = {
      title: `第${art.title}条`,
      id: `article-${art.id}`,
      level: 'article' as const
    };

    // 将条添加到节下，或章下，或根目录
    if (art.section) {
      const sectionKey = art.chapter ? `${art.chapter}||${art.section}` : art.section;
      if (sectionMap.has(sectionKey)) {
        sectionMap.get(sectionKey)!.children.push(articleItem);
      }
    } else if (art.chapter && chapterMap.has(art.chapter)) {
      chapterMap.get(art.chapter)!.children.push(articleItem);
    } else {
      toc.push(articleItem);
    }
  }

  // 中文数字转阿拉伯数字
  function chineseToNumber(chinese: string): string {
    const chineseNums: { [key: string]: number } = {
      '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
      '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
      '十': 10
    };

    // 处理简单的个位数：一、二、三...九
    if (chinese.length === 1 && chineseNums[chinese] !== undefined) {
      return chineseNums[chinese].toString();
    }

    // 处理十几：十一...十九
    if (chinese.length === 2 && chinese.startsWith('十')) {
      const num = 10 + (chineseNums[chinese[1]] || 0);
      return num.toString();
    }

    // 处理几十：二十...九十九
    if (chinese.length === 2 && chinese.endsWith('十')) {
      const num = (chineseNums[chinese[0]] || 0) * 10;
      return num.toString();
    }

    // 处理几十几：二十一...九十九
    if (chinese.length === 3 && chinese.includes('十')) {
      const tens = chineseNums[chinese[0]] || 0;
      const ones = chineseNums[chinese[2]] || 0;
      return (tens * 10 + ones).toString();
    }

    // 处理几百、几百零几等复杂情况
    if (chinese.includes('百')) {
      let result = 0;
      const parts = chinese.split('百');
      if (parts[0]) {
        result += (chineseNums[parts[0]] || 1) * 100;
      } else {
        result += 100;
      }

      if (parts[1]) {
        if (parts[1].includes('十')) {
          const tensParts = parts[1].split('十');
          if (tensParts[0]) {
            result += (chineseNums[tensParts[0]] || 0) * 10;
          } else {
            result += 10;
          }
          if (tensParts[1]) {
            result += chineseNums[tensParts[1]] || 0;
          }
        } else if (parts[1].startsWith('零')) {
          // 处理 "零一" → "一" → 1 (一百零一)
          const afterZero = parts[1].substring(1);
          if (afterZero && chineseNums[afterZero] !== undefined) {
            result += chineseNums[afterZero];
          }
        } else if (parts[1] !== '') {
          result += chineseNums[parts[1]] || 0;
        }
      }

      return result.toString();
    }

    // 如果无法转换，返回原文
    return chinese;
  }

  const MetaRow = ({ label, value }: { label: string; value: string | null | undefined | Date }) => {
    let displayValue = '-';
    if (value instanceof Date) {
        displayValue = value.toLocaleDateString('zh-CN');
    } else if (value) {
        displayValue = value;
    }
    return (
        <div className="grid grid-cols-[calc((100%-2rem)/6)_1fr] py-1.5 border-b border-slate-100 last:border-0">
            <div className="text-slate-400 font-medium text-sm">{label}</div>
            <div className="text-slate-700 text-sm">{displayValue}</div>
        </div>
    );
  };

  // 检测主题（支持通过URL参数切换）
  const themeParams = new URLSearchParams();
  if (resolvedSearchParams.prototype) {
    themeParams.set('prototype', resolvedSearchParams.prototype);
  }
  const theme = ADMIN_CONFIG.getTheme(themeParams);
  const isOptimized = ADMIN_CONFIG.isOptimized(theme);
  const themeClass = isOptimized ? 'app-optimized' : '';

  if (isPrototype) {
    return (
      <div className={`min-h-screen bg-white font-sans selection:bg-blue-100 pb-20 text-slate-900 ${themeClass}`}>
        {/* 顶部固定导航 */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 z-30">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <SiteHeader />
            <div className="text-base font-bold text-slate-800 truncate max-w-[200px] md:max-w-md">
              {law.title}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/law/${law.id}`}
                className="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                看默认页
              </Link>
              <ThemeToggle />
              <Link href={`/admin/edit/${law.id}`} className="text-sm font-bold text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">修改</Link>
            </div>
          </div>
        </div>

        <LawDetailPrototype
          law={law}
          lawHistory={lawHistory}
          toc={toc}
        />
        <BackToTopButton />
      </div>
    );
  }

  return (
    <div id="top" className={`min-h-screen bg-white font-sans selection:bg-blue-100 pb-20 text-slate-900 ${themeClass}`}>
      <RecentViewTracker lawId={law.id} lawTitle={law.title} />
      {/* 顶部固定导航 */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
            <SiteHeader />
            <div className="text-sm sm:text-base font-bold text-slate-800 truncate max-w-[100px] sm:max-w-[200px] md:max-w-md">
                {law.title}
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                <Link
                  href={`/law/${law.id}?prototype=1`}
                  className="text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50 hidden sm:inline-flex"
                >
                  看原型
                </Link>
                <ThemeToggle />
                <Link href={`/admin/edit/${law.id}`} className="text-xs sm:text-sm font-bold text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">修改</Link>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 flex gap-6 sm:gap-12">

        {/* 左侧悬浮目录 (仅桌面端显示) */}
        <aside className="w-64 shrink-0 hidden lg:block">
            <TableOfContents toc={toc} />
        </aside>

        {/* 右侧主内容区 */}
        <main className="flex-1 min-w-0">
          <header className="mb-12">
            {/* 1. 法规标题 */}
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight mb-6 tracking-tight border-l-8 border-blue-600 pl-6">
                {law.title}
            </h1>

            {/* 2. 序言内容 */}
            {law.preamble && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-base text-slate-800 leading-relaxed whitespace-pre-wrap font-serif">
                        {law.preamble}
                    </p>
                </div>
            )}

            {/* 3. 元数据表格 + 法规类别 + 本法变迁 - 合并到一个框内 */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
               <div className="space-y-1 text-base">
                  {/* 第1行：制定机关（单列） */}
                  <MetaRow label="制定机关" value={law.issuingAuthority} />

                  {/* 第2行：发文字号（单列） */}
                  <MetaRow label="发文字号" value={law.documentNumber} />

                  {/* 第3行：公布日期 + 施行日期（两列） */}
                  <div className="grid grid-cols-2 gap-x-8 py-1.5 border-b border-slate-100">
                      <div className="grid grid-cols-3">
                          <div className="text-slate-400 font-medium text-sm">公布日期</div>
                          <div className="col-span-2 text-slate-700 text-sm">
                              {law.promulgationDate ? law.promulgationDate.toLocaleDateString('zh-CN') : '-'}
                          </div>
                      </div>
                      <div className="grid grid-cols-3">
                          <div className="text-slate-400 font-medium text-sm">施行日期</div>
                          <div className="col-span-2 text-slate-700 text-sm">
                              {law.effectiveDate ? law.effectiveDate.toLocaleDateString('zh-CN') : '-'}
                          </div>
                      </div>
                  </div>

                  {/* 第4行：效力位阶 + 时效性（两列） */}
                  <div className="grid grid-cols-2 gap-x-8 py-1.5 border-b border-slate-100">
                      <div className="grid grid-cols-3">
                          <div className="text-slate-400 font-medium text-sm">效力位阶</div>
                          <div className="col-span-2 text-slate-700 text-sm">
                              {law.level || '-'}
                          </div>
                      </div>
                      <div className="grid grid-cols-3">
                          <div className="text-slate-400 font-medium text-sm">时效性</div>
                          <div className={`col-span-2 text-sm font-medium ${statusColor(resolveStatus(law.status, law.effectiveDate))}`}>
                              {resolveStatus(law.status, law.effectiveDate)}
                          </div>
                      </div>
                  </div>

                  {/* 第5行：法规类别（单列） */}
                  <MetaRow label="法规类别" value={law.category} />
               </div>
            </div>
          </header>

          {/* 本法变迁 */}
          {lawHistory.length > 0 && (
            <LawHistory currentLaw={law} history={lawHistory} />
          )}

          {/* 4. 正文内容 */}
          <div className="space-y-12">
            {law.articles.map((article, idx) => {
              // 判断是否是首条（用于显示章节标题）
              const isFirstInChapter = idx === 0 || law.articles[idx - 1].chapter !== article.chapter;
              const isFirstInSection = idx === 0 || law.articles[idx - 1].section !== article.section;

              return (
                <div
                    key={article.id}
                    id={`article-${article.id}`}
                    className="group scroll-mt-24"
                >
                   {/* 章标题 */}
                   {article.chapter && article.chapter.trim() !== '' && isFirstInChapter && (
                       <div
                           id={`chapter-${article.id}`}
                           className="flex items-center gap-4 mb-8 scroll-mt-24"
                       >
                           <div className="h-px bg-blue-200 flex-1"></div>
                           <span className="text-lg font-bold text-slate-700 bg-white px-6 py-2 border-2 border-blue-300 rounded-lg shadow-sm">
                               {article.chapter}
                           </span>
                           <div className="h-px bg-blue-200 flex-1"></div>
                       </div>
                   )}

                   {/* 节标题 */}
                   {article.section && article.section.trim() !== '' && isFirstInSection && (
                       <div
                           id={`section-${article.id}`}
                           className="mb-5 pl-4 border-l-4 border-blue-300"
                       >
                           <span className="text-lg font-bold text-blue-700">
                               {article.section}
                           </span>
                       </div>
                   )}

                   <div className="flex items-start gap-4">
                      <div className="mt-1 flex flex-col items-center">
                          <div className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shadow-inner shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              {chineseToNumber(article.title.replace('第', '').replace('条', ''))}
                          </div>
                          {idx !== law.articles.length - 1 && <div className="w-0.5 flex-1 bg-slate-50 mt-2"></div>}
                      </div>
                      <div className="flex-1 pt-1">
                          <h3 className="text-lg font-bold text-slate-800 mb-3">第{article.title}条</h3>

                          {/* 款 */}
                          {article.paragraphs && article.paragraphs.length > 0 && (
                            <div className="space-y-4">
                              {article.paragraphs.map((para) => (
                                <div key={para.id} className="ml-6">
                                  {/* 款的内容 */}
                                  {para.content && (
                                    <div className="text-slate-700 leading-loose text-lg whitespace-pre-wrap font-serif mb-3">
                                        {para.content}
                                    </div>
                                  )}

                                  {/* 项 */}
                                  {para.items && para.items.length > 0 && (
                                    <div className="space-y-2 ml-4">
                                      {para.items.map((item) => (
                                        <div key={item.id} className="flex items-start gap-2">
                                            <span className="text-blue-600 font-semibold shrink-0">
                                                {item.number}
                                            </span>
                                            <span className="text-slate-700 leading-relaxed text-base font-serif">
                                                {item.content}
                                            </span>
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

        </main>
      </div>

      {/* 返回顶部按钮 */}
      <BackToTopButton />
    </div>
  );
}
