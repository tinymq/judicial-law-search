import { prisma } from '@/src/lib/db';
import { getAllowedRegionValues } from '@/src/lib/region-config';
import SmartApp from './SmartApp';
import { convertToLawDetail, shortenLawTitle } from './convert';
import { SAMPLE_QUERY } from './data';
import type { MindmapData, HotTag } from './data';

export const dynamic = 'force-dynamic';

export default async function SmartPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = ((params.q ?? SAMPLE_QUERY) || '').trim() || SAMPLE_QUERY;

  const allowedRegions = getAllowedRegionValues();
  const regionFilter = {
    OR: [{ region: { in: allowedRegions } }, { region: null }],
  };

  const lawSelect = {
    id: true,
    title: true,
    level: true,
    status: true,
    issuingAuthority: true,
    documentNumber: true,
    promulgationDate: true,
    effectiveDate: true,
    preamble: true,
  } as const;

  // 1. 标题命中 top-6
  const titleLaws = await prisma.law.findMany({
    where: { ...regionFilter, title: { contains: query } },
    select: lawSelect,
    take: 6,
  });

  // 2. 正文命中 top-6
  const contentLaws = titleLaws.length >= 4
    ? []
    : await prisma.law.findMany({
        where: {
          ...regionFilter,
          id: { notIn: titleLaws.map((l) => l.id) },
          articles: {
            some: {
              paragraphs: {
                some: { content: { contains: query } },
              },
            },
          },
        },
        select: lawSelect,
        take: 6,
      });

  const topLaws = [...titleLaws, ...contentLaws].slice(0, 4);

  // 3. 主法规完整详情
  const primaryId = topLaws[0]?.id;
  const primaryLawRaw = primaryId
    ? await prisma.law.findUnique({
        where: { id: primaryId },
        include: {
          articles: {
            orderBy: { order: 'asc' },
            include: {
              paragraphs: {
                orderBy: { order: 'asc' },
                include: {
                  items: { orderBy: { order: 'asc' } },
                },
              },
            },
          },
        },
      })
    : null;

  const lawDetail = primaryLawRaw ? convertToLawDetail(primaryLawRaw, query) : null;

  // 统计命中条款
  let articleHitCount = 0;
  if (lawDetail) {
    for (const ch of lawDetail.chapters) {
      for (const sec of ch.sections) {
        articleHitCount += sec.articles.filter((a) => a.hit).length;
      }
    }
  }

  // 4. 热门行业 top-6 作为 HOT_TAGS
  const industries = await prisma.industry.findMany({
    where: { laws: { some: regionFilter } },
    select: {
      id: true,
      name: true,
      _count: { select: { laws: { where: regionFilter } } },
    },
    orderBy: { order: 'asc' },
  });
  const hotTags: HotTag[] = industries
    .filter((i) => i._count.laws > 0)
    .sort((a, b) => b._count.laws - a._count.laws)
    .slice(0, 6)
    .map((i) => ({ label: i.name, cat: '行业', count: i._count.laws }));

  // 5. 构造 mindmap 数据：law 分支真数据 + violation/case 继续 mock
  const mindmapData: MindmapData = {
    center: {
      label: query,
      meta: topLaws.length > 0 ? `${topLaws.length} 部命中 · ${articleHitCount} 条条款` : '无匹配',
    },
    branches: [
      {
        id: 'violation',
        name: '违法行为',
        color: '#c8302b',
        angleStart: -150,
        angleEnd: -30,
        nodes: [
          { id: 'v1', label: '销售超过保质期食品', weight: 87, cases: 142 },
          { id: 'v2', label: '经营标签不符合规定的食品', weight: 54, cases: 86 },
          { id: 'v3', label: '未尽查验义务', weight: 41, cases: 63 },
          { id: 'v4', label: '未及时下架过期食品', weight: 38, cases: 51 },
        ],
      },
      {
        id: 'law',
        name: '法律法规',
        color: '#b57d28',
        angleStart: -15,
        angleEnd: 105,
        nodes:
          topLaws.length > 0
            ? topLaws.map((l, i) => ({
                id: `l${l.id}`,
                label: shortenLawTitle(l.title),
                weight: Math.max(30, 100 - i * 15),
                cases: i === 0 ? articleHitCount : 0,
                hot: i === 0,
              }))
            : [{ id: 'l-empty', label: '（无命中）', weight: 30, cases: 0 }],
      },
      {
        id: 'case',
        name: '类案',
        color: '#4a7a55',
        angleStart: 120,
        angleEnd: 210,
        nodes: [
          { id: 'c1', label: '(2024) 苏 02 行终 118 号', weight: 32, cases: 1 },
          { id: 'c2', label: '(2023) 沪 0106 行初 089 号', weight: 28, cases: 1 },
          { id: 'c3', label: '市监处字〔2024〕037 号', weight: 24, cases: 1 },
        ],
      },
    ],
  };

  return (
    <SmartApp
      initialQuery={query}
      hotTags={hotTags}
      mindmapData={mindmapData}
      lawDetail={lawDetail}
      resultMeta={{
        lawCount: topLaws.length,
        articleHitCount,
        violationCount: 4,
        caseCount: 3,
      }}
    />
  );
}
