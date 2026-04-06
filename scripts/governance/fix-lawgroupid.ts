/**
 * Phase 1: lawGroupId 修复脚本
 *
 * 为所有 lawGroupId=NULL 或不正确的法规生成正确的 lawGroupId
 * 使用 src/lib/law-grouping.ts 的 buildLawBaseTitle() + generateLawGroupId()
 *
 * 用法：
 *   npx tsx scripts/governance/fix-lawgroupid.ts          # 分析模式（不修改数据）
 *   npx tsx scripts/governance/fix-lawgroupid.ts --apply   # 执行修复
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import crypto from 'crypto';

// 复用 law-grouping.ts 的核心逻辑（避免 ESM/CJS 兼容问题，直接内联）
const VERSION_MARKER_RE = /[\(\[（【]\s*\d{4}\s*(?:年)?(?:[^)\]）】]{0,20})[\)\]）】]\s*$/g;
const TRAILING_MARKER_RE = /(修订|修正|修改|公布|发布|施行|实施|暂行|试行)\s*$/g;
const EXTRA_WHITESPACE_RE = /\s+/g;
const PUNCTUATION_RE = /[《》"'""'']/g;

function normalizeLawTitle(title: string): string {
  return title
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/【/g, '[').replace(/】/g, ']')
    .replace(/\u3000/g, ' ')
    .replace(PUNCTUATION_RE, '')
    .replace(EXTRA_WHITESPACE_RE, ' ')
    .trim();
}

function buildLawBaseTitle(title: string): string {
  const normalized = normalizeLawTitle(title);
  let current = normalized.trim();
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(VERSION_MARKER_RE, '').trim();
    current = current.replace(TRAILING_MARKER_RE, '').trim();
  }
  return current.replace(EXTRA_WHITESPACE_RE, ' ').trim();
}

function generateLawGroupId(title: string): string {
  const baseTitle = buildLawBaseTitle(title);
  const hash = crypto.createHash('md5').update(baseTitle).digest('hex');
  return `LAW_${hash.substring(0, 12).toUpperCase()}`;
}

const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;
const prisma = new PrismaClient();

const applyMode = process.argv.includes('--apply');

async function main() {
  console.log(`模式: ${applyMode ? '🔧 执行修复' : '📊 分析模式（加 --apply 执行修复）'}\n`);

  // 查询所有法规
  const laws = await prisma.law.findMany({
    select: { id: true, title: true, lawGroupId: true },
  });
  console.log(`总法规数: ${laws.length}`);

  // 分析
  let nullCount = 0;
  let mismatchCount = 0;
  let correctCount = 0;
  const updates: Array<{ id: number; title: string; oldGroupId: string | null; newGroupId: string }> = [];
  const groupMap = new Map<string, Array<{ id: number; title: string }>>();

  for (const law of laws) {
    const correctGroupId = generateLawGroupId(law.title);

    // 统计按正确 groupId 分组
    if (!groupMap.has(correctGroupId)) groupMap.set(correctGroupId, []);
    groupMap.get(correctGroupId)!.push({ id: law.id, title: law.title });

    if (law.lawGroupId === null) {
      nullCount++;
      updates.push({ id: law.id, title: law.title, oldGroupId: null, newGroupId: correctGroupId });
    } else if (law.lawGroupId !== correctGroupId) {
      mismatchCount++;
      updates.push({ id: law.id, title: law.title, oldGroupId: law.lawGroupId, newGroupId: correctGroupId });
    } else {
      correctCount++;
    }
  }

  // 找出会形成的分组（>1 部法规的组）
  const multiGroups = Array.from(groupMap.entries())
    .filter(([, members]) => members.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`\n=== 分析结果 ===`);
  console.log(`lawGroupId 为 NULL: ${nullCount}`);
  console.log(`lawGroupId 不正确: ${mismatchCount}`);
  console.log(`lawGroupId 正确:   ${correctCount}`);
  console.log(`需要更新:          ${updates.length}`);
  console.log(`\n将形成的法规组（>1部法规的组）: ${multiGroups.length} 个`);

  // 展示前 20 个多成员组
  console.log(`\n=== Top 20 法规组 ===`);
  for (const [groupId, members] of multiGroups.slice(0, 20)) {
    console.log(`\n${groupId} (${members.length} 部):`);
    for (const m of members) {
      console.log(`  - [${m.id}] ${m.title}`);
    }
  }

  if (!applyMode) {
    console.log(`\n📊 分析完成。运行 --apply 执行修复。`);
    return;
  }

  // 执行修复
  console.log(`\n🔧 开始修复 ${updates.length} 部法规...`);
  const BATCH_SIZE = 100;
  let processed = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map(u => prisma.law.update({
        where: { id: u.id },
        data: { lawGroupId: u.newGroupId },
      }))
    );
    processed += batch.length;
    if (processed % 1000 === 0 || processed === updates.length) {
      console.log(`  进度: ${processed}/${updates.length}`);
    }
  }

  // 验证
  const remainingNull = await prisma.law.count({ where: { lawGroupId: null } });
  console.log(`\n✅ 修复完成！`);
  console.log(`剩余 lawGroupId=NULL: ${remainingNull}`);
}

main()
  .catch(e => { console.error('错误:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
