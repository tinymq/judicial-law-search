/**
 * 浙江执法事项法规重关联脚本（Phase 1）
 *
 * 对 239 部未匹配法规标题进行清洗后重新匹配数据库：
 *   - 去除年份后缀：(2016)、(2020第二次修订)、（2021）
 *   - 去除附加机构名：国务院2010-10-19、全国人民代表大会常务委员会2021-04-29
 *   - 去除附加日期：浙江省人大及其常委会2022-09-29
 *
 * 用法：
 *   DRY_RUN=true npx tsx scripts/governance/relink-zhejiang-laws.ts
 *   npx tsx scripts/governance/relink-zhejiang-laws.ts
 */

import { PrismaClient } from '@prisma/client';
import { Workbook } from 'exceljs';
import path from 'path';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === 'true';

const EXCEL_PATH = path.join(
  'C:', 'Users', '26371', 'Documents', 'Mo Obsidian', 'Mo CCLearning',
  '2026CoAwareProjects', '00-项目综合', '执法事项研究',
  '江苏执法事项数据准备_v1.2.xlsx'
);

function clean(val: any): string {
  if (val == null) return '';
  return String(val).replace(/\s+/g, ' ').trim();
}

/**
 * 清洗法规标题：去除年份后缀和附加机构名/日期
 * 返回多个候选标题（原始 + 各种清洗变体）
 */
function cleanLawTitle(raw: string): string[] {
  const candidates = new Set<string>();
  candidates.add(raw);

  function add(s: string) {
    const t = s.trim();
    if (t.length >= 4 && t !== raw) candidates.add(t);
  }

  // 去除尾部括号年份：(2016)、（2021）、(2020第二次修订)、(待定)
  add(raw.replace(/[（(][^）)]*[）)]\s*$/, ''));

  // 通过已知机构名前缀截断：适用于 "法规名+制定机关+日期" 格式
  const institutionPrefixes = [
    '国务院', '全国人民代表大会', '全国人大', '中央机构编制',
    '国家市场监督管理总局', '国家广播电视总局', '国家广播电影电视总局',
    '国家新闻出版', '国家质检总局',
    '农业农村部', '工业和信息化部', '劳动部',
    '浙江省人民代表大会', '浙江省人大', '浙江省人民政府',
    '浙江省发改委', '浙江省市场监管局', '浙江省民政厅',
    '省市场监管局', '省人民政府',
    '中华人民共和国国务院',
  ];
  for (const prefix of institutionPrefixes) {
    const idx = raw.lastIndexOf(prefix);
    if (idx > 3) {
      add(raw.substring(0, idx));
    }
  }

  // 兜底：如果含日期 YYYY-MM-DD，截掉日期及其前面的机构名
  const dateMatch = raw.match(/^(.+?)([一-鿿]{2,}\d{4}-\d{2}-\d{2})\s*$/);
  if (dateMatch) {
    add(dateMatch[1]);
  }

  // 特殊：以"（修正文本）"结尾
  add(raw.replace(/[（(]修正文本[）)]\s*$/, ''));

  // 去掉"中华人民共和国"前缀的变体
  for (const c of [...candidates]) {
    if (c.startsWith('中华人民共和国')) {
      add(c.replace('中华人民共和国', ''));
    }
  }

  return [...candidates].filter(c => c.length >= 4);
}

/**
 * 在 DB 法规中查找最佳匹配
 * 优先精确匹配，次选最短长度差的包含匹配，排除跨地域误关联
 */
function findBestMatch(
  searchTitle: string,
  dbLaws: { id: number; title: string }[],
): { id: number; title: string } | null {
  // 1. 精确匹配
  for (const law of dbLaws) {
    if (law.title === searchTitle) return law;
  }

  // 2. DB标题去掉括号年份后精确匹配：如搜 "广播电视管理条例" = DB "广播电视管理条例(2000年公布)"
  for (const law of dbLaws) {
    const dbBase = law.title.replace(/[（(][^）)]*[）)]\s*$/, '').trim();
    if (dbBase === searchTitle) return law;
  }

  // 3. 包含匹配，但排除跨地域
  const localPrefixes = /^(.*?省|.*?市|.*?自治区)/;
  const searchRegion = searchTitle.match(localPrefixes)?.[1] || '';
  const candidates: { law: { id: number; title: string }; diff: number }[] = [];

  for (const law of dbLaws) {
    const dbBase = law.title.replace(/[（(][^）)]*[）)]\s*$/, '').trim();
    if (dbBase.includes(searchTitle) || searchTitle.includes(dbBase)) {
      const dbRegion = law.title.match(localPrefixes)?.[1] || '';
      // 排除跨地域：搜全国法规(无地域前缀)不能匹配到地方法规
      if (!searchRegion && dbRegion && !dbRegion.includes('浙江')) continue;
      // 搜浙江法规不能匹配到其他省市
      if (searchRegion && dbRegion && searchRegion !== dbRegion) continue;

      candidates.push({ law, diff: Math.abs(law.title.length - searchTitle.length) });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.diff - b.diff);
  return candidates[0].law;
}

async function main() {
  console.log('=== 浙江执法事项法规重关联（Phase 1）===\n');
  console.log(`模式: ${DRY_RUN ? '试运行' : '正式执行'}\n`);

  const dbLaws = await prisma.law.findMany({ select: { id: true, title: true } });
  console.log(`数据库法规: ${dbLaws.length} 部`);

  const wb = new Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  // Step 1: 获取原始匹配中未匹配的法规标题
  // 使用与原始导入脚本相同的简单 includes 逻辑，保持一致性
  const titleSheet = wb.getWorksheet('法规标题清单_清洗版')!;
  const unmatchedTitles: { title: string; refs: number }[] = [];
  const originalMatched = new Map<string, number>();

  titleSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const title = clean(row.values[1]);
    const refs = parseInt(String(row.values[3] || row.values[2] || '0'), 10);
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

    if (lawId) {
      originalMatched.set(title, lawId);
    } else {
      unmatchedTitles.push({ title, refs });
    }
  });

  console.log(`未匹配标题: ${unmatchedTitles.length} 部\n`);

  // Step 2: 清洗标题重新匹配
  const newMatches: { originalTitle: string; cleanedTitle: string; lawId: number; lawTitle: string }[] = [];
  const stillUnmatched: typeof unmatchedTitles = [];

  for (const { title, refs } of unmatchedTitles) {
    const candidates = cleanLawTitle(title);
    let matched = false;

    for (const candidate of candidates) {
      if (candidate === title) continue;

      const match = findBestMatch(candidate, dbLaws);
      if (match) {
        newMatches.push({
          originalTitle: title,
          cleanedTitle: candidate,
          lawId: match.id,
          lawTitle: match.title,
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      stillUnmatched.push({ title, refs });
    }
  }

  console.log(`--- 清洗匹配结果 ---`);
  console.log(`新匹配: ${newMatches.length} 部`);
  console.log(`仍未匹配: ${stillUnmatched.length} 部\n`);

  if (newMatches.length > 0) {
    console.log('新匹配详情:');
    for (const m of newMatches) {
      console.log(`  "${m.originalTitle}" → "${m.lawTitle}" (id=${m.lawId})`);
    }
    console.log('');
  }

  // Step 3: 构建清洗后的 titleToLawId 映射
  const titleToLawId = new Map<string, number>();
  for (const m of newMatches) {
    titleToLawId.set(m.originalTitle, m.lawId);
  }

  // Step 4: 重新扫描事项-法规映射表，找出可以更新的事项
  const mappingSheet = wb.getWorksheet('事项-法规映射')!;
  const uuidsToUpdate = new Map<string, number>(); // UUID → lawId

  mappingSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const itemId = clean(row.values[1]);
    const lawTitle = clean(row.values[6]);
    if (!itemId || !lawTitle) return;
    if (uuidsToUpdate.has(itemId)) return;

    const lawId = titleToLawId.get(lawTitle);
    if (lawId) {
      uuidsToUpdate.set(itemId, lawId);
    }
  });

  console.log(`可更新事项: ${uuidsToUpdate.size} 条\n`);

  // Step 5: 查找数据库中对应的 enforcementItem 并更新 lawId
  if (uuidsToUpdate.size === 0) {
    console.log('无需更新。');
    return;
  }

  // 获取当前浙江无lawId的事项（用name匹配UUID太慢，改用直接按name查）
  // 实际上UUID没有存到DB，需要通过事项名称来关联
  // 重新读取主数据表获取 UUID→名称 映射
  const mainSheet = wb.getWorksheet('事项结构化数据')!;
  const uuidToName = new Map<string, string>();
  mainSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const uuid = clean(row.values[1]);
    const name = String(row.values[2] || '').replace(/\n/g, '').replace(/\s+/g, '').trim();
    if (uuid && name) uuidToName.set(uuid, name);
  });

  // 获取浙江无lawId的事项
  const noLawItems = await prisma.enforcementItem.findMany({
    where: { province: '330000', lawId: null },
    select: { id: true, name: true },
  });
  console.log(`当前浙江无lawId事项: ${noLawItems.length} 条`);

  // 建立 name → DB id 映射
  const nameToDbId = new Map<string, number>();
  for (const item of noLawItems) {
    const cleanName = item.name.replace(/\s+/g, '');
    if (!nameToDbId.has(cleanName)) {
      nameToDbId.set(cleanName, item.id);
    }
  }

  // 匹配并更新
  let updated = 0;
  let notFound = 0;
  const updates: { id: number; lawId: number }[] = [];

  for (const [uuid, lawId] of uuidsToUpdate) {
    const name = uuidToName.get(uuid);
    if (!name) { notFound++; continue; }

    const dbId = nameToDbId.get(name);
    if (!dbId) { notFound++; continue; }

    updates.push({ id: dbId, lawId });
  }

  console.log(`准备更新: ${updates.length} 条, 未找到DB记录: ${notFound} 条\n`);

  if (!DRY_RUN && updates.length > 0) {
    // 批量更新
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      await Promise.all(
        batch.map(u => prisma.enforcementItem.update({
          where: { id: u.id },
          data: { lawId: u.lawId },
        }))
      );
      console.log(`  更新批次: ${Math.min(i + 100, updates.length)}/${updates.length}`);
    }
    updated = updates.length;
  }

  // 最终统计
  const afterCount = DRY_RUN
    ? 9237 + updates.length
    : await prisma.enforcementItem.count({ where: { province: '330000', lawId: { not: null } } });
  const total = 10352;

  console.log(`\n=== 完成 ===`);
  console.log(`新增关联: ${DRY_RUN ? updates.length + ' (预计)' : updated + ' 条'}`);
  console.log(`法规关联率: ${afterCount}/${total} = ${(afterCount / total * 100).toFixed(1)}%`);
  console.log(`模式: ${DRY_RUN ? '试运行（未更新）' : '已更新'}`);
}

main()
  .catch(err => { console.error('致命错误:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
