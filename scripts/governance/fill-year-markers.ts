/**
 * 法规标题年份标记规范化 + 补齐
 *
 * 规则（与 Mo 2026-04-24 对齐）：
 *   标准格式：(YYYY年修订|修正|公布|修改|发布)
 *   状态格式：(YYYY年废止|失效)  ← 保留，不动
 *
 * 规范化（把不规范的改成标准格式）：
 *   (YYYY修订|修正|公布|修改|发布)           → 补"年"字
 *   (YYYY年第X次修订|修正|修改)              → 去"第X次"
 *   (YYYY年修正文本)                         → 去"文本"两字
 *   (YYYY)                                    → (YYYY年公布)
 *   (YYYY年)                                  → (YYYY年公布)
 *
 * 补齐（标题完全无标准标记 + 无状态标记 + 有公布日期）：
 *   → 追加 (YYYY年公布)，YYYY 优先来自 promulgationDate，兜底 effectiveDate
 *
 * 保留原样（不处理）：
 *   - 括号里的非年份内容，如 (FBM-CLI.4.5136363)（产品编号）
 *   - 已有任何标准格式年份标记的标题
 *   - 仅有状态标记（废止/失效）的标题
 *
 * 用法：
 *   npx tsx scripts/governance/fill-year-markers.ts           # 分析模式
 *   npx tsx scripts/governance/fill-year-markers.ts --apply   # 执行
 */

import path from 'path';
import { PrismaClient } from '@prisma/client';

const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;
const prisma = new PrismaClient();

const applyMode = process.argv.includes('--apply');

type NormalizeResult = {
  newTitle: string;
  reasons: string[];
};

function normalizeTitle(title: string, fallbackYear: number | null): NormalizeResult {
  const reasons: string[] = [];
  let result = title.trim();

  // 规则 D（优先）：去"第X次 + 修订/修正/修改 + (文本)?"
  result = result.replace(
    /([(（])([12]\d{3}年)第[一二三四五六七八九十\d]+次(修订|修正|修改)(?:文本)?([)）])/g,
    (m, l, yp, verb, r) => {
      const newMarker = `${l}${yp}${verb}${r}`;
      reasons.push(`去"第X次/文本": ${m} → ${newMarker}`);
      return newMarker;
    }
  );

  // 规则 F：(YYYY年修正文本) → (YYYY年修正)
  result = result.replace(
    /([(（])([12]\d{3}年)修正文本([)）])/g,
    (m, l, yp, r) => {
      const newMarker = `${l}${yp}修正${r}`;
      reasons.push(`去"文本": ${m} → ${newMarker}`);
      return newMarker;
    }
  );

  // 规则 C：(YYYY修订|修正|公布|修改|发布) → (YYYY年修订|...)  补"年"
  result = result.replace(
    /([(（])([12]\d{3})(修订|修正|公布|修改|发布)([)）])/g,
    (m, l, y, verb, r) => {
      const newMarker = `${l}${y}年${verb}${r}`;
      reasons.push(`补"年"字: ${m} → ${newMarker}`);
      return newMarker;
    }
  );

  // 规则 E2：(YYYY年) → (YYYY年公布)
  result = result.replace(
    /([(（])([12]\d{3})年([)）])/g,
    (m, l, y, r) => {
      const newMarker = `${l}${y}年公布${r}`;
      reasons.push(`"YYYY年"补"公布": ${m} → ${newMarker}`);
      return newMarker;
    }
  );

  // 规则 E1：(YYYY) 纯年份 → (YYYY年公布)
  // 注意：必须在 E2 之后，避免先把 (2018年) 的"年"误为 E1 的年份
  result = result.replace(
    /([(（])([12]\d{3})([)）])/g,
    (m, l, y, r) => {
      const newMarker = `${l}${y}年公布${r}`;
      reasons.push(`纯年份补"年公布": ${m} → ${newMarker}`);
      return newMarker;
    }
  );

  // 检测规范化后是否有任何公布/修订类标准标记
  const hasStandardMarker = /[(（][12]\d{3}年(修订|修正|公布|修改|发布)[)）]/.test(result);
  // 检测是否有废止/失效状态标记
  const hasStatusMarker = /[(（][12]\d{3}年(废止|失效)[)）]/.test(result);

  if (!hasStandardMarker && !hasStatusMarker && fallbackYear) {
    result = `${result}(${fallbackYear}年公布)`;
    reasons.push(`追加: +(${fallbackYear}年公布)`);
  }

  return { newTitle: result, reasons };
}

async function main() {
  console.log(`模式: ${applyMode ? '🔧 执行（改库）' : '📊 分析模式'}\n`);

  const laws = await prisma.law.findMany({
    select: { id: true, title: true, promulgationDate: true, effectiveDate: true, status: true },
    orderBy: { id: 'asc' },
  });

  console.log(`总法规数: ${laws.length}\n`);

  type Update = { id: number; oldTitle: string; newTitle: string; reasons: string[] };
  const updates: Update[] = [];
  const skippedNoDate: Array<{ id: number; title: string }> = [];
  const skippedOnlyStatus: Array<{ id: number; title: string }> = [];

  // 按操作类型分类统计
  const counts = {
    no_change: 0,
    normalize_only: 0,     // 规范化，不追加
    append_only: 0,        // 只追加（原无任何标记）
    normalize_and_append: 0,  // 规范化后仍需追加
    only_status_marker: 0, // 仅有废止等状态
    no_date: 0,            // 完全无年份 + 无日期
  };

  for (const law of laws) {
    const year = law.promulgationDate?.getFullYear() ?? law.effectiveDate?.getFullYear() ?? null;
    const { newTitle, reasons } = normalizeTitle(law.title, year);

    // 如果只有状态标记（废止/失效）且没其他改动
    const trimmedOriginal = law.title.trim();
    const hasStatus = /[(（][12]\d{3}年(废止|失效)[)）]/.test(trimmedOriginal);
    const hasStandard = /[(（][12]\d{3}年(修订|修正|公布|修改|发布)[)）]/.test(trimmedOriginal);

    if (newTitle === trimmedOriginal && newTitle === law.title) {
      counts.no_change++;
      if (hasStatus && !hasStandard) {
        counts.only_status_marker++;
        skippedOnlyStatus.push({ id: law.id, title: law.title });
      }
      continue;
    }

    // 有改动
    const hasAppendReason = reasons.some((r) => r.startsWith('追加:'));
    const hasNormalizeReason = reasons.some((r) => !r.startsWith('追加:'));

    if (hasAppendReason && hasNormalizeReason) counts.normalize_and_append++;
    else if (hasAppendReason) counts.append_only++;
    else if (hasNormalizeReason) counts.normalize_only++;

    updates.push({
      id: law.id,
      oldTitle: law.title,
      newTitle,
      reasons,
    });
  }

  // 找出完全无年份 + 无日期的
  for (const law of laws) {
    const year = law.promulgationDate?.getFullYear() ?? law.effectiveDate?.getFullYear() ?? null;
    if (year !== null) continue;
    const hasStandard = /[(（][12]\d{3}年(修订|修正|公布|修改|发布)[)）]/.test(law.title);
    const hasStatus = /[(（][12]\d{3}年(废止|失效)[)）]/.test(law.title);
    const hasAnyYear = /[12]\d{3}/.test(law.title);
    if (!hasStandard && !hasStatus && !hasAnyYear) {
      counts.no_date++;
      skippedNoDate.push({ id: law.id, title: law.title });
    }
  }

  console.log(`=== 统计 ===`);
  console.log(`无改动（已标准 / 仅状态 / 无日期无法补）: ${counts.no_change}`);
  console.log(`  - 已是标准格式:   ${counts.no_change - counts.only_status_marker - counts.no_date}`);
  console.log(`  - 仅有状态标记:   ${counts.only_status_marker}`);
  console.log(`  - 无日期无法补齐: ${counts.no_date}`);
  console.log(`有改动: ${updates.length}`);
  console.log(`  - 仅规范化（不追加）:     ${counts.normalize_only}`);
  console.log(`  - 仅追加（原无标记）:     ${counts.append_only}`);
  console.log(`  - 规范化 + 追加:          ${counts.normalize_and_append}`);

  console.log(`\n=== 规范化样本（前 20 条）===`);
  updates
    .filter((u) => !u.reasons.every((r) => r.startsWith('追加:')))
    .slice(0, 20)
    .forEach((u, i) => {
      console.log(`${i + 1}. [${u.id}]`);
      console.log(`   旧: ${u.oldTitle}`);
      console.log(`   新: ${u.newTitle}`);
      u.reasons.forEach((r) => console.log(`      · ${r}`));
    });

  console.log(`\n=== 追加样本（前 10 条）===`);
  updates
    .filter((u) => u.reasons.every((r) => r.startsWith('追加:')))
    .slice(0, 10)
    .forEach((u, i) => {
      console.log(`${i + 1}. [${u.id}] ${u.oldTitle}`);
      console.log(`   → ${u.newTitle}`);
    });

  if (skippedOnlyStatus.length > 0) {
    console.log(`\n=== 保留原样（仅有状态标记）===`);
    skippedOnlyStatus.forEach((l) => {
      console.log(`  [${l.id}] ${l.title}`);
    });
  }

  if (skippedNoDate.length > 0) {
    console.log(`\n=== 跳过（无任何年份信息，无法补）===`);
    skippedNoDate.slice(0, 15).forEach((l) => console.log(`  [${l.id}] ${l.title}`));
    if (skippedNoDate.length > 15) console.log(`  ... 还有 ${skippedNoDate.length - 15} 条`);
  }

  if (!applyMode) {
    console.log(`\n📊 分析完成。--apply 执行。`);
    return;
  }

  console.log(`\n🔧 开始更新 ${updates.length} 部法规标题...`);
  const BATCH = 100;
  let processed = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map((u) =>
        prisma.law.update({ where: { id: u.id }, data: { title: u.newTitle } })
      )
    );
    processed += batch.length;
    if (processed % 500 === 0 || processed === updates.length) {
      console.log(`  进度: ${processed}/${updates.length}`);
    }
  }

  console.log(`\n✅ 完成`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
