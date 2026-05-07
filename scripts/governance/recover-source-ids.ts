/**
 * UUID 回填脚本 - 从源 Excel 恢复 sourceId (localInnerCode)
 *
 * 导入脚本读取了 Excel 列[1] 的 UUID，但未存入数据库。
 * 本脚本通过事项名称匹配，将 UUID 回填到 EnforcementItem.sourceId 字段。
 *
 * 用法：
 *   npx tsx scripts/governance/recover-source-ids.ts          # 分析模式
 *   npx tsx scripts/governance/recover-source-ids.ts --apply  # 写库
 */

import { PrismaClient } from '@prisma/client';
import { Workbook } from 'exceljs';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const EXCEL_PATH = process.env.EXCEL_PATH
  || 'C:\\Users\\26371\\Documents\\Mo Obsidian\\Mo CCLearning\\2026司法执法监督\\执法事项研究\\江苏执法事项数据准备_v1.3.xlsx';
const PROVINCE_CODE = '330000';

function cleanName(val: any): string {
  if (val == null) return '';
  return String(val).replace(/\n/g, '').replace(/\s+/g, '').trim();
}

async function main() {
  console.log(`模式: ${APPLY ? '写库' : '分析（加 --apply 写库）'}`);
  console.log(`Excel: ${EXCEL_PATH}\n`);

  // Step 1: 读取 Excel UUID → 名称映射
  const workbook = new Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const sheet = workbook.getWorksheet('事项结构化数据');
  if (!sheet) {
    console.error('找不到 sheet "事项结构化数据"');
    process.exit(1);
  }

  const excelRows: { uuid: string; name: string; category: string; body: string }[] = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const uuid = String(row.values[1] || '').trim();
    const name = cleanName(row.values[2]);
    const category = String(row.values[3] || '').trim();
    const body = String(row.values[7] || '').trim();
    if (uuid && name) {
      excelRows.push({ uuid, name, category, body });
    }
  });
  console.log(`Excel 行数: ${excelRows.length}`);

  // Step 2: 加载所有浙江事项
  const dbItems = await prisma.enforcementItem.findMany({
    where: { province: PROVINCE_CODE },
    select: { id: true, name: true, category: true, enforcementBody: true, sourceId: true },
  });
  console.log(`DB 浙江事项: ${dbItems.length}`);
  const alreadyHasSourceId = dbItems.filter(i => i.sourceId).length;
  console.log(`已有 sourceId: ${alreadyHasSourceId}\n`);

  // Step 3: 按名称建索引（处理同名情况）
  const nameMap = new Map<string, typeof dbItems>();
  for (const item of dbItems) {
    const key = cleanName(item.name);
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key)!.push(item);
  }

  // Step 4: 匹配
  let matched = 0;
  let ambiguous = 0;
  let notFound = 0;
  const updates: { id: number; sourceId: string }[] = [];

  for (const row of excelRows) {
    const key = cleanName(row.name);
    const candidates = nameMap.get(key);

    if (!candidates || candidates.length === 0) {
      notFound++;
      continue;
    }

    if (candidates.length === 1) {
      updates.push({ id: candidates[0].id, sourceId: row.uuid });
      matched++;
      continue;
    }

    // 同名多条：用 category + enforcementBody 消歧
    const exact = candidates.find(
      c => c.category === row.category && c.enforcementBody === row.body
    );
    if (exact) {
      updates.push({ id: exact.id, sourceId: row.uuid });
      matched++;
    } else {
      // 退而求其次：只按 category 匹配
      const byCat = candidates.find(c => c.category === row.category);
      if (byCat) {
        updates.push({ id: byCat.id, sourceId: row.uuid });
        matched++;
      } else {
        ambiguous++;
      }
    }
  }

  console.log(`匹配结果:`);
  console.log(`  精确匹配: ${matched}`);
  console.log(`  未找到: ${notFound}`);
  console.log(`  歧义未匹配: ${ambiguous}`);
  console.log(`  待更新: ${updates.length}\n`);

  if (!APPLY) {
    console.log('分析完成。加 --apply 参数执行写库。');
    await prisma.$disconnect();
    return;
  }

  // Step 5: 批量写库
  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map(u => prisma.enforcementItem.update({
        where: { id: u.id },
        data: { sourceId: u.sourceId },
      }))
    );
    console.log(`已更新 ${Math.min(i + BATCH, updates.length)} / ${updates.length}`);
  }

  console.log('\n写库完成！');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
