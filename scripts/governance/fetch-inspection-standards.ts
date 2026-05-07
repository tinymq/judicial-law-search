/**
 * 检查标准采集脚本 - 从浙江政务服务网 API 批量采集行政检查事项的检查标准
 *
 * API: POST /jpaas-zjservice-server/open-api/department/getCheckContent
 * 参数: qlInnerCode={sourceId}&current=1&pageSize=100
 *
 * 用法：
 *   npx tsx scripts/governance/fetch-inspection-standards.ts              # 分析模式
 *   npx tsx scripts/governance/fetch-inspection-standards.ts --apply      # 采集并写库
 *   MAX_ITEMS=10 npx tsx scripts/governance/fetch-inspection-standards.ts --apply  # 测试10条
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const RESUME = process.env.RESUME !== 'false';
const MAX_ITEMS = process.env.MAX_ITEMS ? parseInt(process.env.MAX_ITEMS) : Infinity;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10');
const DELAY_MS = parseInt(process.env.DELAY_MS || '1500');
const API_URL = 'https://www.zjzwfw.gov.cn/jpaas-zjservice-server/open-api/department/getCheckContent';

interface CheckContentItem {
  id: number;
  checkItem: string;
  checkContent: string;
  checkOperate?: string;
  law?: string;
  contentLevel?: string;
  checkType?: string;
}

async function fetchCheckContent(sourceId: string): Promise<CheckContentItem[]> {
  const body = new URLSearchParams({
    qlInnerCode: sourceId,
    current: '1',
    pageSize: '200',
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (res.status === 429) {
        console.log('  频率限制，等待 10s...');
        await sleep(10000);
        continue;
      }

      if (!res.ok) {
        console.log(`  HTTP ${res.status}`);
        return [];
      }

      const json = await res.json();
      const innerData = json?.data?.data;
      if (!innerData?.success) return [];

      return innerData.data?.dataList || [];
    } catch (e: any) {
      if (attempt < 2) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      console.log(`  网络错误: ${e.message}`);
      return [];
    }
  }
  return [];
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`模式: ${APPLY ? '采集写库' : '分析（加 --apply 采集写库）'}`);
  console.log(`续传: ${RESUME}, 批量: ${BATCH_SIZE}, 延迟: ${DELAY_MS}ms`);
  if (MAX_ITEMS < Infinity) console.log(`限制: ${MAX_ITEMS} 条`);
  console.log();

  // 查询目标事项
  const where: any = {
    category: '行政检查',
    sourceId: { not: null },
  };

  const totalCheckItems = await prisma.enforcementItem.count({ where });
  console.log(`行政检查事项（有 sourceId）: ${totalCheckItems}`);

  if (RESUME) {
    const alreadyFetched = await prisma.inspectionStandard.groupBy({
      by: ['enforcementItemId'],
    });
    const fetchedIds = new Set(alreadyFetched.map(g => g.enforcementItemId));
    console.log(`已采集: ${fetchedIds.size}`);

    if (!APPLY) {
      console.log(`待采集: ${totalCheckItems - fetchedIds.size}`);
      console.log('\n分析完成。加 --apply 参数执行采集。');
      await prisma.$disconnect();
      return;
    }
  }

  if (!APPLY) {
    console.log('\n分析完成。加 --apply 参数执行采集。');
    await prisma.$disconnect();
    return;
  }

  // 加载所有目标事项
  let items = await prisma.enforcementItem.findMany({
    where,
    select: { id: true, sourceId: true, name: true },
    orderBy: { id: 'asc' },
  });

  if (RESUME) {
    const existing = await prisma.inspectionStandard.groupBy({
      by: ['enforcementItemId'],
    });
    const existingIds = new Set(existing.map(g => g.enforcementItemId));
    items = items.filter(i => !existingIds.has(i.id));
    console.log(`跳过已采集，剩余: ${items.length}`);
  }

  if (items.length > MAX_ITEMS) {
    items = items.slice(0, MAX_ITEMS);
    console.log(`限制为 ${MAX_ITEMS} 条`);
  }

  let fetched = 0;
  let withData = 0;
  let empty = 0;
  let errors = 0;
  let totalStandards = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    for (const item of batch) {
      const standards = await fetchCheckContent(item.sourceId!);

      if (standards.length > 0) {
        await prisma.inspectionStandard.createMany({
          data: standards.map((s, idx) => ({
            enforcementItemId: item.id,
            sequenceNumber: idx + 1,
            checkItem: s.checkItem || '',
            checkContent: s.checkContent || '',
            checkOperate: s.checkOperate || null,
            law: s.law || null,
            contentLevel: s.contentLevel || null,
            checkType: s.checkType || null,
          })),
        });
        withData++;
        totalStandards += standards.length;
      } else {
        empty++;
      }
      fetched++;
    }

    const progress = Math.min(i + BATCH_SIZE, items.length);
    console.log(`进度: ${progress}/${items.length} | 有数据: ${withData} | 空: ${empty} | 检查标准: ${totalStandards}`);

    if (i + BATCH_SIZE < items.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n采集完成！`);
  console.log(`  处理事项: ${fetched}`);
  console.log(`  有检查标准: ${withData}`);
  console.log(`  无检查标准: ${empty}`);
  console.log(`  检查标准总条数: ${totalStandards}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
