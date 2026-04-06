/**
 * 行政检查事项 AI 提取脚本
 *
 * 从数据库中读取法规，调用 AI 提取行政检查事项，写入 EnforcementItem 表。
 *
 * 用法：
 *   # Mock 模式（测试流程）
 *   npx tsx scripts/governance/extract-enforcement-items.ts
 *
 *   # 使用真实 AI API
 *   AI_PROVIDER=openai-compatible \
 *   AI_BASE_URL=https://api.deepseek.com/v1 \
 *   AI_API_KEY=sk-xxx \
 *   AI_MODEL=deepseek-chat \
 *   npx tsx scripts/governance/extract-enforcement-items.ts
 *
 * 选项（环境变量）：
 *   AI_PROVIDER    — mock | openai-compatible（默认 mock）
 *   PROVINCE       — 筛选省份简称，如"江苏"（默认处理所有 ALLOWED_PROVINCES）
 *   BATCH_SIZE     — 每批处理法规数（默认 10）
 *   DRY_RUN        — 设为 true 只分析不入库
 *   SKIP_EXISTING  — 设为 true 跳过已有提取结果的法规（默认 true）
 *   MAX_LAWS       — 最大处理法规数（默认无限制，调试用）
 *   OUTPUT_DIR     — 报告输出目录（默认 scripts/governance/reports）
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import {
  createProvider,
  type AIProvider,
  type LawContent,
  type ExtractionResult,
} from '../../src/lib/ai-provider';
import { getAllowedRegionValues, ALLOWED_PROVINCES } from '../../src/lib/region-config';
import {
  generateCode,
  findIndustryCode,
  LEVEL_CODES,
  CodeSequencer,
} from '../../src/lib/enforcement-encoding';

const prisma = new PrismaClient();

// ============================================================
// 配置
// ============================================================

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';
const SKIP_EXISTING = process.env.SKIP_EXISTING !== 'false'; // 默认 true
const MAX_LAWS = process.env.MAX_LAWS ? parseInt(process.env.MAX_LAWS, 10) : Infinity;
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'reports');
const TARGET_PROVINCE = process.env.PROVINCE || null;

// ============================================================
// 辅助函数
// ============================================================

/** 获取法规的省份代码（用于 EnforcementItem.province） */
function getProvinceCode(region: string | null): string {
  // 简易映射，根据 region-config.ts 中的 PROVINCES
  const codeMap: Record<string, string> = {
    '全国': '000000',
    '湖南': '430000',
    '海南': '460000',
    '山东': '370000',
    '江苏': '320000',
  };

  if (!region) return '000000';

  // 先尝试精确匹配
  if (codeMap[region]) return codeMap[region];

  // 尝试前缀匹配（如"长沙"→"430000"）
  // 这里需要更完整的城市-省份映射，简化处理
  for (const [prov, code] of Object.entries(codeMap)) {
    if (region.includes(prov)) return code;
  }

  return '000000';
}

/** 组装法规的完整条文内容 */
async function buildLawContent(lawId: number, title: string, level: string, issuingAuthority: string | null): Promise<LawContent> {
  const articles = await prisma.article.findMany({
    where: { lawId },
    include: {
      paragraphs: {
        include: { items: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  });

  return {
    lawId,
    title,
    level,
    issuingAuthority: issuingAuthority || undefined,
    articles: articles.map(art => {
      // 组装条款全文（含款和项）
      let content = '';
      for (const para of art.paragraphs) {
        if (para.content) {
          content += para.content + '\n';
        }
        for (const item of para.items) {
          content += `${item.number} ${item.content}\n`;
        }
      }
      return {
        title: art.title,
        chapter: art.chapter || undefined,
        section: art.section || undefined,
        content: content.trim(),
      };
    }),
  };
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('=== 行政检查事项 AI 提取 ===\n');

  // 初始化 AI 提供者
  const provider = createProvider();
  console.log(`AI 提供者: ${provider.name}`);
  console.log(`批次大小: ${BATCH_SIZE}`);
  console.log(`模式: ${DRY_RUN ? '试运行（不入库）' : '正式运行'}`);
  console.log(`跳过已提取: ${SKIP_EXISTING}`);
  if (TARGET_PROVINCE) console.log(`目标省份: ${TARGET_PROVINCE}`);
  if (MAX_LAWS < Infinity) console.log(`最大处理数: ${MAX_LAWS}`);
  console.log('');

  // 确定区域筛选范围
  const allowedRegions = getAllowedRegionValues();
  const regionFilter = TARGET_PROVINCE
    ? { region: { contains: TARGET_PROVINCE } }
    : { OR: [{ region: { in: allowedRegions } }, { region: null }] };

  // 查询待处理法规
  const laws = await prisma.law.findMany({
    where: regionFilter as any,
    select: {
      id: true,
      title: true,
      level: true,
      region: true,
      issuingAuthority: true,
      _count: { select: { articles: true } },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`符合条件的法规: ${laws.length} 部`);

  // 过滤无条文的法规
  let candidates = laws.filter(law => law._count.articles > 0);
  console.log(`有条文的法规: ${candidates.length} 部`);

  // 跳过已有提取结果的法规（通过 lawId 关联判断）
  if (SKIP_EXISTING) {
    const existingLawIds = await prisma.enforcementItem.findMany({
      where: { lawId: { not: null } },
      select: { lawId: true },
      distinct: ['lawId'],
    });
    const processedLawIds = new Set(existingLawIds.map(e => e.lawId));
    if (processedLawIds.size > 0) {
      const before = candidates.length;
      candidates = candidates.filter(law => !processedLawIds.has(law.id));
      console.log(`已提取过的法规: ${before - candidates.length} 部（跳过）`);
    }
  }

  // 限制最大处理数
  if (candidates.length > MAX_LAWS) {
    candidates = candidates.slice(0, MAX_LAWS);
    console.log(`限制处理数量为: ${candidates.length} 部`);
  }

  console.log('');

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 初始化编码序号管理器
  const existingItemCount = await prisma.enforcementItem.count();
  const sequencer = new CodeSequencer(existingItemCount);
  let globalSeq = existingItemCount;

  // 分批处理
  const allResults: ExtractionResult[] = [];
  let totalItems = 0;
  let processedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(candidates.length / BATCH_SIZE);

    console.log(`--- 批次 ${batchNum}/${totalBatches} (法规 ${i + 1}-${Math.min(i + BATCH_SIZE, candidates.length)}) ---`);

    for (const law of batch) {
      try {
        // 组装法规内容
        const lawContent = await buildLawContent(law.id, law.title, law.level, law.issuingAuthority);

        // 跳过条文内容为空的法规
        const totalContentLength = lawContent.articles.reduce((sum, a) => sum + a.content.length, 0);
        if (totalContentLength === 0) {
          console.log(`  [跳过] #${law.id} ${law.title} — 无条文内容`);
          continue;
        }

        // 调用 AI 提取
        const result = await provider.extractEnforcementItems(lawContent);
        allResults.push(result);

        if (result.items.length > 0) {
          console.log(`  [提取] #${law.id} ${law.title} — ${result.items.length} 项 (${result.durationMs}ms)`);

          // 入库
          if (!DRY_RUN) {
            const provinceCode = getProvinceCode(law.region);

            for (const item of result.items) {
              globalSeq++;

              // 生成 18 位编码
              const domainCode = findIndustryCode(item.enforcementDomain || '') || '00';
              const levelCode = LEVEL_CODES[item.enforcementLevel || '各级'] || 'GJ';
              const orgName = item.enforcementBody || '未知';
              const orgSeq = sequencer.getOrgSequence(provinceCode, domainCode, levelCode, orgName);
              const itemSeq = sequencer.nextItemSequence();
              const code = generateCode(provinceCode, domainCode, levelCode, orgSeq, itemSeq, item.category);

              await prisma.enforcementItem.create({
                data: {
                  sequenceNumber: globalSeq,
                  name: item.name,
                  category: item.category || '行政检查',
                  enforcementBody: item.enforcementBody,
                  legalBasisText: item.legalBasisText,
                  remarks: item.remarks || null,
                  province: provinceCode,
                  industryId: null,
                  // 新增字段
                  code,
                  enforcementLevel: item.enforcementLevel,
                  checkTarget: item.checkTarget,
                  checkContent: item.checkContent,
                  checkMethod: item.checkMethod,
                  enforcementDomain: item.enforcementDomain,
                  itemStatus: '生效',
                  lawId: law.id,
                },
              });
            }
          }

          totalItems += result.items.length;
        } else {
          console.log(`  [无事项] #${law.id} ${law.title}`);
        }

        processedCount++;
      } catch (err) {
        errorCount++;
        console.error(`  [错误] #${law.id} ${law.title}:`, err instanceof Error ? err.message : err);
      }
    }

    // 批次间暂停（避免 API 限流）
    if (provider.name !== 'mock' && i + BATCH_SIZE < candidates.length) {
      console.log('  等待 2 秒...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // ============================================================
  // 输出报告
  // ============================================================

  console.log('\n=== 提取完成 ===');
  console.log(`处理法规: ${processedCount} 部`);
  console.log(`提取事项: ${totalItems} 条`);
  console.log(`错误: ${errorCount} 次`);
  console.log(`模式: ${DRY_RUN ? '试运行（未入库）' : '已入库'}`);

  // 保存详细报告
  const reportPath = path.join(OUTPUT_DIR, `extraction-report-${new Date().toISOString().slice(0, 10)}.json`);
  const report = {
    timestamp: new Date().toISOString(),
    provider: provider.name,
    config: {
      batchSize: BATCH_SIZE,
      dryRun: DRY_RUN,
      skipExisting: SKIP_EXISTING,
      maxLaws: MAX_LAWS === Infinity ? 'unlimited' : MAX_LAWS,
      targetProvince: TARGET_PROVINCE,
    },
    summary: {
      totalLaws: candidates.length,
      processedLaws: processedCount,
      extractedItems: totalItems,
      errors: errorCount,
      lawsWithItems: allResults.filter(r => r.items.length > 0).length,
      lawsWithoutItems: allResults.filter(r => r.items.length === 0).length,
    },
    results: allResults.map(r => ({
      lawId: r.lawId,
      lawTitle: r.lawTitle,
      itemCount: r.items.length,
      durationMs: r.durationMs,
      items: r.items,
    })),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n报告已保存: ${reportPath}`);

  // 保存提取结果 CSV
  if (totalItems > 0) {
    const csvPath = path.join(OUTPUT_DIR, `extracted-items-${new Date().toISOString().slice(0, 10)}.csv`);
    let csv = '法规ID,法规标题,事项名称,执法类别,执法领域,执法主体,行使层级,检查对象,检查内容,检查方式,相关条款,执法依据\n';
    for (const result of allResults) {
      for (const item of result.items) {
        const esc = (s: string | undefined) => `"${(s || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
        csv += [
          result.lawId,
          esc(result.lawTitle),
          esc(item.name),
          item.category || '行政检查',
          item.enforcementDomain || '',
          item.enforcementBody || '',
          item.enforcementLevel || '',
          item.checkTarget || '',
          item.checkContent || '',
          item.checkMethod || '',
          `"${(item.relatedArticles || []).join(', ')}"`,
          esc(item.legalBasisText),
        ].join(',') + '\n';
      }
    }
    fs.writeFileSync(csvPath, '\uFEFF' + csv);
    console.log(`CSV 已保存: ${csvPath}`);
  }
}

main()
  .catch(err => {
    console.error('致命错误:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
