/**
 * 浙江省行政执法权责清单导入脚本
 *
 * 数据源：江苏执法事项数据准备_v1.2.xlsx（已清洗结构化数据）
 *
 * 主数据 Sheet "事项结构化数据" 列结构（17列）：
 *   [1] 事项ID (UUID)    [2] 事项名称        [3] 事项类型
 *   [4] 部门简称          [5] 树层级           [6] 权力代码
 *   [7] 实施主体          [8] 实施层级         [9] 国家依据
 *   [10] 省级依据         [11] 依据层级        [12] 检查对象
 *   [13] 检查内容         [14] 检查方式        [15] 执法领域代码
 *   [16] 执法领域         [17] 重复标注
 *
 * 法规映射 Sheet "事项-法规映射" 列结构（7列）：
 *   [1] 事项ID  [6] 法规标题_标准化  → 通过 UUID 关联法规
 *
 * 用法：
 *   DRY_RUN=true npx tsx scripts/governance/import-zhejiang-enforcement.ts
 *   npx tsx scripts/governance/import-zhejiang-enforcement.ts
 */

import { PrismaClient } from '@prisma/client';
import { Workbook } from 'exceljs';
import {
  generateCode,
  LEVEL_CODES,
  CodeSequencer,
} from '../../src/lib/enforcement-encoding';

const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === 'true';
const EXCEL_PATH = process.env.EXCEL_PATH
  || 'C:\\Users\\26371\\Documents\\Mo Obsidian\\Mo CCLearning\\2026CoAwareProjects\\00-项目综合\\执法事项研究\\江苏执法事项数据准备_v1.2.xlsx';
const PROVINCE_CODE = '330000';
const BATCH_SIZE = 500;

function clean(val: any): string {
  if (val == null) return '';
  return String(val).replace(/\s+/g, ' ').trim();
}

function cleanName(val: any): string {
  if (val == null) return '';
  return String(val).replace(/\n/g, '').replace(/\s+/g, '').trim();
}

function parseLevel(raw: string): string {
  if (!raw) return '';
  return raw.replace(/、/g, ',').replace(/，/g, ',').replace(/\s+/g, '').trim();
}

// ============================================================
// 预加载：法规映射（UUID → lawId）
// ============================================================

async function loadLawMapping(workbook: Workbook): Promise<Map<string, number>> {
  const titleSheet = workbook.getWorksheet('法规标题清单_清洗版');
  const mappingSheet = workbook.getWorksheet('事项-法规映射');
  if (!titleSheet || !mappingSheet) {
    console.warn('⚠ 法规映射 sheet 缺失');
    return new Map();
  }

  const dbLaws = await prisma.law.findMany({ select: { id: true, title: true } });

  // Step A: 法规标题 → DB lawId
  const titleToLawId = new Map<string, number>();
  let matched = 0, unmatched = 0;

  titleSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const title = clean(row.values[1]);
    if (!title) return;

    let lawId: number | null = null;
    for (const law of dbLaws) {
      if (law.title === title) { lawId = law.id; break; }
    }
    if (!lawId) {
      for (const law of dbLaws) {
        if (law.title.includes(title) || title.includes(law.title)) { lawId = law.id; break; }
      }
    }

    if (lawId) { titleToLawId.set(title, lawId); matched++; }
    else { unmatched++; }
  });

  console.log(`法规标题: ${matched} 匹配 / ${unmatched} 未匹配 (共 ${matched + unmatched})`);

  // Step B: 事项UUID → lawId（通过标准化标题关联）
  const uuidToLawId = new Map<string, number>();
  mappingSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const itemId = clean(row.values[1]);
    const lawTitle = clean(row.values[6]);
    if (!itemId || !lawTitle) return;
    if (uuidToLawId.has(itemId)) return;

    const lawId = titleToLawId.get(lawTitle);
    if (lawId) uuidToLawId.set(itemId, lawId);
  });

  console.log(`事项-法规映射: ${uuidToLawId.size} 条事项获得 lawId`);
  return uuidToLawId;
}

// ============================================================
// 预加载：行业代码 → DB industryId
// ============================================================

async function loadIndustryMap(): Promise<Map<string, number>> {
  const dbIndustries = await prisma.industry.findMany({ select: { id: true, code: true } });
  const map = new Map<string, number>();
  for (const ind of dbIndustries) {
    map.set(ind.code, ind.id);
  }
  console.log(`行业表: ${map.size} 条`);
  return map;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('=== 浙江省执法事项目录导入 ===\n');
  console.log(`模式: ${DRY_RUN ? '试运行（不入库）' : '正式导入'}`);
  console.log(`文件: ${EXCEL_PATH}`);
  console.log(`省份: ${PROVINCE_CODE} (浙江)\n`);

  const workbook = new Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  console.log(`Sheets: ${workbook.worksheets.map(s => s.name).join(', ')}\n`);

  // 预加载
  console.log('--- 预加载 ---');
  const lawMap = await loadLawMapping(workbook);
  const industryMap = await loadIndustryMap();
  console.log('');

  // 主数据
  const mainSheet = workbook.getWorksheet('事项结构化数据');
  if (!mainSheet) throw new Error('未找到"事项结构化数据" sheet');

  const existingCount = await prisma.enforcementItem.count();
  const sequencer = new CodeSequencer(existingCount);
  let globalSeq = existingCount;

  // 统计
  let imported = 0, skipped = 0;
  let lawMatchedCount = 0, industryMatchedCount = 0, checkFilledCount = 0;
  const categoryStats: Record<string, number> = {};
  const levelStats: Record<string, number> = {};
  const domainStats: Record<string, number> = {};
  const errors: { row: number; error: string }[] = [];

  const rows: { rowNum: number; values: any[] }[] = [];
  mainSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    rows.push({ rowNum, values: row.values as any[] });
  });

  console.log(`主数据行数: ${rows.length}\n--- 开始处理 ---\n`);

  let batch: any[] = [];
  let batchNum = 0;

  for (const { rowNum, values } of rows) {
    try {
      // 列映射（exceljs values[0] 空，从 [1] 开始）
      const itemId = clean(values[1]);         // UUID
      const name = cleanName(values[2]);       // 事项名称
      const category = clean(values[3]);       // 事项类型
      const deptShort = clean(values[4]);      // 部门简称
      const powerCode = clean(values[6]);      // 权力代码
      const body = clean(values[7]);           // 实施主体
      const levelRaw = clean(values[8]);       // 实施层级
      const basisNational = String(values[9] || '');   // 国家依据
      const basisProvince = String(values[10] || '');  // 省级依据
      const checkTarget = clean(values[12]);   // 检查对象
      const checkContent = clean(values[13]);  // 检查内容
      const checkMethod = clean(values[14]);   // 检查方式
      const industryCode = clean(values[15]);  // 执法领域代码
      const domainName = clean(values[16]);    // 执法领域

      if (!name) { skipped++; continue; }

      const levels = parseLevel(levelRaw);

      // 执法依据：国家依据 + 省级依据合并
      const basisParts = [basisNational.trim(), basisProvince.trim()].filter(Boolean);
      const legalBasisText = basisParts.join('\n\n') || null;

      // 法规匹配
      const lawId = lawMap.get(itemId) ?? null;
      if (lawId) lawMatchedCount++;

      // 行业匹配
      const paddedCode = industryCode.padStart(2, '0');
      const industryId = industryMap.get(paddedCode) ?? industryMap.get(industryCode) ?? null;
      if (industryId) industryMatchedCount++;

      // 检查字段统计
      if (category === '行政检查' && (checkTarget || checkContent || checkMethod)) {
        checkFilledCount++;
      }

      // 统计
      categoryStats[category] = (categoryStats[category] || 0) + 1;
      domainStats[domainName || '(空)'] = (domainStats[domainName || '(空)'] || 0) + 1;
      if (levels) {
        for (const l of levels.split(',')) {
          if (l) levelStats[l] = (levelStats[l] || 0) + 1;
        }
      }

      // 生成18位编码
      globalSeq++;
      const encIndustryCode = paddedCode || '30';
      const primaryLevel = levels.split(',')[0] || '各级';
      const levelCode = LEVEL_CODES[primaryLevel] || 'GJ';
      const orgName = body || deptShort || '执法部门';
      const orgSeq = sequencer.getOrgSequence(PROVINCE_CODE, encIndustryCode, levelCode, orgName);
      const itemSeq = sequencer.nextItemSequence();
      const code = generateCode(PROVINCE_CODE, encIndustryCode, levelCode, orgSeq, itemSeq, category);

      batch.push({
        sequenceNumber: globalSeq,
        name,
        category,
        enforcementBody: body || null,
        legalBasisText,
        remarks: deptShort || null,
        province: PROVINCE_CODE,
        industryId,
        code,
        enforcementLevel: levels || null,
        checkTarget: checkTarget || null,
        checkContent: checkContent || null,
        checkMethod: checkMethod || null,
        enforcementDomain: domainName || null,
        itemStatus: '生效',
        lawId,
      });
      imported++;

      if (batch.length >= BATCH_SIZE) {
        batchNum++;
        if (!DRY_RUN) {
          await prisma.enforcementItem.createMany({ data: batch });
        }
        console.log(`  批次 ${batchNum}: ${batch.length} 条 (累计 ${imported}/${rows.length})`);
        batch = [];
      }
    } catch (err: any) {
      errors.push({ row: rowNum, error: err.message });
      skipped++;
    }
  }

  if (batch.length > 0) {
    batchNum++;
    if (!DRY_RUN) {
      await prisma.enforcementItem.createMany({ data: batch });
    }
    console.log(`  批次 ${batchNum}: ${batch.length} 条 (累计 ${imported}/${rows.length})`);
  }

  // 报告
  console.log('\n=== 导入完成 ===\n');
  console.log(`导入: ${imported} 条`);
  console.log(`跳过: ${skipped} 条`);
  console.log(`模式: ${DRY_RUN ? '试运行（未入库）' : '已入库'}`);

  console.log(`\n--- 法规匹配 ---`);
  console.log(`  匹配成功: ${lawMatchedCount} 条 (${(lawMatchedCount / imported * 100).toFixed(1)}%)`);

  console.log(`\n--- 行业映射 ---`);
  console.log(`  匹配成功: ${industryMatchedCount} 条 (${(industryMatchedCount / imported * 100).toFixed(1)}%)`);

  console.log(`\n--- 检查字段 ---`);
  console.log(`  已填充: ${checkFilledCount} / ${categoryStats['行政检查'] || 0} 条行政检查事项`);

  console.log('\n--- 类别分布 ---');
  for (const [k, v] of Object.entries(categoryStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  console.log('\n--- 层级分布 ---');
  for (const [k, v] of Object.entries(levelStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  console.log('\n--- 领域分布 (Top 15) ---');
  const domainEntries = Object.entries(domainStats).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of domainEntries.slice(0, 15)) {
    console.log(`  ${k}: ${v}`);
  }
  if (domainEntries.length > 15) console.log(`  ... 共 ${domainEntries.length} 个领域`);

  if (errors.length > 0) {
    console.log(`\n--- 错误 (${errors.length} 条) ---`);
    for (const e of errors.slice(0, 10)) console.log(`  行 ${e.row}: ${e.error}`);
    if (errors.length > 10) console.log(`  ... 等 ${errors.length - 10} 条`);
  }
}

main()
  .catch(err => { console.error('致命错误:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
