/**
 * 湖南省市场监督管理行政执法事项目录 Excel 导入脚本
 *
 * 用法：
 *   # 试运行（不入库）
 *   DRY_RUN=true npx tsx scripts/governance/import-hunan-enforcement.ts
 *
 *   # 正式导入
 *   npx tsx scripts/governance/import-hunan-enforcement.ts
 */

import { PrismaClient } from '@prisma/client';
import { Workbook } from 'exceljs';
import {
  generateCode,
  findIndustryCode,
  LEVEL_CODES,
  CATEGORY_PREFIXES,
  CodeSequencer,
} from '../../src/lib/enforcement-encoding';

const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === 'true';
const EXCEL_PATH = process.env.EXCEL_PATH
  || 'C:\\Users\\26371\\Documents\\EchoSyncMo\\湖南省市场监督管理行政执法事项目录.xlsx';
const PROVINCE_CODE = '430000'; // 湖南

// ============================================================
// 辅助函数
// ============================================================

/** 清理单元格内容（去除换行、多余空格） */
function clean(val: any): string {
  if (!val) return '';
  return String(val).replace(/\n/g, '').replace(/\s+/g, ' ').trim();
}

/** 清理名称（保留换行替换为空格） */
function cleanName(val: any): string {
  if (!val) return '';
  return String(val).replace(/\n/g, '').replace(/\s+/g, '').trim();
}

/**
 * 从"执法主体（实施层级）"列中拆分出 enforcementBody 和 enforcementLevel
 * 示例输入："市场监督管理部门（省级、设区的市级或县级）"
 * 输出：{ body: "市场监督管理部门", levels: "省级,市级,县级" }
 */
function splitBodyAndLevel(raw: string): { body: string; levels: string } {
  const cleaned = clean(raw);

  // 匹配括号内容（中文括号或英文括号）
  const match = cleaned.match(/^(.+?)[（(](.+?)[）)]$/);
  if (!match) {
    // 无括号时，尝试从名称前缀提取层级（如"省级市场监督管理部门"）
    const prefixMatch = cleaned.match(/^(省级|市级|县级|乡级|设区的市级)(.+)$/);
    if (prefixMatch) {
      const levelMap: Record<string, string> = { '省级': '省级', '市级': '市级', '县级': '县级', '乡级': '乡级', '设区的市级': '市级' };
      return { body: prefixMatch[2], levels: levelMap[prefixMatch[1]] || prefixMatch[1] };
    }
    return { body: cleaned, levels: '' };
  }

  const body = match[1].trim();
  const levelText = match[2];

  // 从层级文本中提取标准层级
  const levelSet: string[] = [];
  if (/省级/.test(levelText)) levelSet.push('省级');
  if (/市级|设区的市|地级/.test(levelText)) levelSet.push('市级');
  if (/县级|区级/.test(levelText)) levelSet.push('县级');
  if (/乡级|乡镇|街道/.test(levelText)) levelSet.push('乡级');

  return {
    body,
    levels: levelSet.length > 0 ? levelSet.join(',') : levelText,
  };
}

/**
 * 从"所属章节"列中提取 enforcementDomain
 * 示例："10.食品监督管理" → "食品监督管理"
 */
function extractDomain(chapter: string): string {
  const cleaned = clean(chapter);
  const match = cleaned.match(/^\d+\.(.+)$/);
  return match ? match[1] : cleaned;
}

/**
 * 从执法依据文本中提取引用的法规名称列表
 */
function extractLawNames(basisText: string): string[] {
  const cleaned = basisText.replace(/\n/g, '');
  const matches = cleaned.match(/《([^》]+)》/g);
  if (!matches) return [];

  const names = new Set<string>();
  for (const m of matches) {
    const name = m.slice(1, -1).replace(/\s+/g, '').trim();
    if (name.length > 3) names.add(name);
  }
  return Array.from(names);
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('=== 湖南省执法事项目录导入 ===\n');
  console.log(`模式: ${DRY_RUN ? '试运行（不入库）' : '正式导入'}`);
  console.log(`文件: ${EXCEL_PATH}`);
  console.log(`省份: ${PROVINCE_CODE} (湖南)\n`);

  // 读取 Excel
  const workbook = new Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.worksheets[0];
  console.log(`Sheet: ${sheet.name}`);
  console.log(`行数: ${sheet.rowCount}\n`);

  // 预加载数据库法规（用于 lawId 匹配）
  const dbLaws = await prisma.law.findMany({
    select: { id: true, title: true },
  });
  console.log(`数据库法规数: ${dbLaws.length}`);

  // 构建法规名称→ID映射
  const lawTitleMap = new Map<string, number>();
  for (const law of dbLaws) {
    lawTitleMap.set(law.title, law.id);
  }

  // 查找法规ID的辅助函数（支持模糊匹配）
  function findLawId(lawName: string): number | null {
    // 精确匹配
    const exact = lawTitleMap.get(lawName);
    if (exact) return exact;

    // 包含匹配
    for (const law of dbLaws) {
      if (law.title.includes(lawName) || lawName.includes(law.title)) {
        return law.id;
      }
    }
    return null;
  }

  // 初始化编码序号管理器
  const existingCount = await prisma.enforcementItem.count();
  const sequencer = new CodeSequencer(existingCount);
  let globalSeq = existingCount;

  // 统计
  let imported = 0;
  let skipped = 0;
  let lawMatched = 0;
  let lawUnmatched = 0;
  const categoryStats: Record<string, number> = {};
  const domainStats: Record<string, number> = {};

  // 遍历行
  const rows: any[][] = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return; // 跳过表头
    rows.push(row.values as any[]);
  });

  console.log(`数据行数: ${rows.length}\n`);

  for (const values of rows) {
    // Excel 列映射（exceljs values[0] 是空的，从 [1] 开始）
    const chapter = String(values[1] || '');
    const seqNum = parseInt(String(values[2] || '0'), 10);
    const name = cleanName(values[3]);
    const category = clean(values[4]);
    const bodyLevelRaw = String(values[5] || '');
    const orgRaw = String(values[6] || '');
    const basisText = String(values[7] || '');
    const remark = clean(values[8]);

    if (!name) {
      skipped++;
      continue;
    }

    // 拆分执法主体和层级
    const { body, levels } = splitBodyAndLevel(bodyLevelRaw);

    // 提取执法领域
    const domain = extractDomain(chapter);

    // 匹配 lawId
    const lawNames = extractLawNames(basisText);
    let lawId: number | null = null;
    if (lawNames.length > 0) {
      // 优先匹配第一条引用的法规
      for (const ln of lawNames) {
        lawId = findLawId(ln);
        if (lawId) break;
      }
    }

    if (lawId) {
      lawMatched++;
    } else if (lawNames.length > 0) {
      lawUnmatched++;
    }

    // 统计
    categoryStats[category] = (categoryStats[category] || 0) + 1;
    domainStats[domain] = (domainStats[domain] || 0) + 1;

    // 生成编码
    globalSeq++;
    const industryCode = findIndustryCode(domain) || findIndustryCode('市场监督管理') || '30';
    const primaryLevel = levels.split(',')[0] || '各级';
    const levelCode = LEVEL_CODES[primaryLevel] || 'GJ';
    const orgName = body || '市场监督管理部门';
    const orgSeq = sequencer.getOrgSequence(PROVINCE_CODE, industryCode, levelCode, orgName);
    const itemSeq = sequencer.nextItemSequence();
    const code = generateCode(PROVINCE_CODE, industryCode, levelCode, orgSeq, itemSeq, category);

    // 承办机构存到 remarks
    const cleanOrg = clean(orgRaw);
    const remarks = [cleanOrg ? `承办机构：${cleanOrg}` : '', remark].filter(Boolean).join('；');

    if (!DRY_RUN) {
      await prisma.enforcementItem.create({
        data: {
          sequenceNumber: globalSeq,
          name,
          category,
          enforcementBody: body || null,
          legalBasisText: basisText.replace(/\n/g, '\n') || null,
          remarks: remarks || null,
          province: PROVINCE_CODE,
          industryId: null,
          code,
          enforcementLevel: levels || null,
          checkTarget: null,
          checkContent: null,
          checkMethod: null,
          enforcementDomain: domain || null,
          itemStatus: '生效',
          lawId,
        },
      });
    }

    imported++;
  }

  // 输出结果
  console.log('=== 导入完成 ===\n');
  console.log(`导入: ${imported} 条`);
  console.log(`跳过: ${skipped} 条`);
  console.log(`法规匹配: ${lawMatched} 条（${Math.round(lawMatched / imported * 100)}%）`);
  console.log(`法规未匹配: ${lawUnmatched} 条`);
  console.log(`模式: ${DRY_RUN ? '试运行（未入库）' : '已入库'}`);
  console.log('\n--- 类别分布 ---');
  for (const [k, v] of Object.entries(categoryStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log('\n--- 领域分布 ---');
  for (const [k, v] of Object.entries(domainStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
}

main()
  .catch(err => {
    console.error('致命错误:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
