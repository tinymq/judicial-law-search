/**
 * 重新关联未匹配的执法事项与法规
 *
 * 对 lawId 为 null 但有 legalBasisText 的记录，用更宽松的策略匹配法规。
 *
 * 用法：
 *   npx tsx scripts/governance/relink-enforcement-items.ts          # 试运行
 *   npx tsx scripts/governance/relink-enforcement-items.ts --apply   # 正式更新
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// 从执法依据文本中提取《》内的法规名称
function extractLawNames(text: string): string[] {
  const cleaned = text.replace(/\n/g, '');
  const matches = cleaned.match(/《([^》]+)》/g);
  if (!matches) return [];
  const names = new Set<string>();
  for (const m of matches) {
    const name = m.slice(1, -1).replace(/\s+/g, '').trim();
    if (name.length > 3) names.add(name);
  }
  return Array.from(names);
}

// 规范化法规名称：去前缀、去年份修订后缀
function normalize(name: string): string {
  return name
    .replace(/^中华人民共和国/, '')
    .replace(/\(\d{4}年?[^)]*\)/, '')
    .replace(/（\d{4}年?[^）]*）/, '')
    .replace(/\s+/g, '')
    .trim();
}

async function main() {
  console.log(`=== 执法事项法规重新关联 ===`);
  console.log(`模式: ${APPLY ? '正式更新' : '试运行（仅报告）'}\n`);

  // 加载数据库所有法规
  const dbLaws = await prisma.law.findMany({ select: { id: true, title: true } });
  console.log(`数据库法规数: ${dbLaws.length}`);

  // 构建匹配索引
  const exactMap = new Map<string, number>();
  const normalizedMap = new Map<string, { id: number; title: string }[]>();
  for (const law of dbLaws) {
    exactMap.set(law.title, law.id);
    const norm = normalize(law.title);
    if (!normalizedMap.has(norm)) normalizedMap.set(norm, []);
    normalizedMap.get(norm)!.push(law);
  }

  // 查找未关联的执法事项
  const unlinked = await prisma.enforcementItem.findMany({
    where: { lawId: null, legalBasisText: { not: null } },
    select: { id: true, name: true, legalBasisText: true },
  });

  console.log(`未关联事项（有执法依据）: ${unlinked.length}\n`);

  let matched = 0;
  let unmatched = 0;
  const unmatchedItems: { id: number; name: string; citedLaws: string[] }[] = [];

  for (const item of unlinked) {
    const citedLaws = extractLawNames(item.legalBasisText!);
    if (citedLaws.length === 0) {
      unmatchedItems.push({ id: item.id, name: item.name, citedLaws: [] });
      unmatched++;
      continue;
    }

    let foundLawId: number | null = null;
    let matchMethod = '';
    let matchedCitation = '';

    for (const cited of citedLaws) {
      // 策略1：精确匹配
      const exact = exactMap.get(cited);
      if (exact) {
        foundLawId = exact;
        matchMethod = '精确';
        matchedCitation = cited;
        break;
      }

      // 策略2：规范化匹配（去"中华人民共和国"前缀 + 去年份后缀）
      const normCited = normalize(cited);
      const normMatches = normalizedMap.get(normCited);
      if (normMatches && normMatches.length > 0) {
        foundLawId = normMatches[0].id;
        matchMethod = `规范化 → ${normMatches[0].title}`;
        matchedCitation = cited;
        break;
      }

      // 策略3：包含匹配（数据库标题包含引用名，或引用名包含数据库标题）
      for (const law of dbLaws) {
        const normTitle = normalize(law.title);
        if (normTitle.includes(normCited) || normCited.includes(normTitle)) {
          foundLawId = law.id;
          matchMethod = `包含 → ${law.title}`;
          matchedCitation = cited;
          break;
        }
      }
      if (foundLawId) break;

      // 策略4：关键词重叠（去掉常见词后，核心词汇重叠度≥80%）
      const STOP_WORDS = new Set(['的', '和', '与', '及', '关于', '办法', '规定', '条例', '实施', '细则', '管理', '监督']);
      const citedTokens = normCited.split('').filter(c => !STOP_WORDS.has(c));
      if (citedTokens.length >= 4) {
        let bestScore = 0;
        let bestLaw: typeof dbLaws[0] | null = null;
        for (const law of dbLaws) {
          const titleTokens = normalize(law.title).split('').filter(c => !STOP_WORDS.has(c));
          if (titleTokens.length === 0) continue;
          const overlap = citedTokens.filter(t => titleTokens.includes(t)).length;
          const score = overlap / Math.max(citedTokens.length, titleTokens.length);
          if (score > bestScore) {
            bestScore = score;
            bestLaw = law;
          }
        }
        if (bestScore >= 0.8 && bestLaw) {
          foundLawId = bestLaw.id;
          matchMethod = `关键词(${(bestScore * 100).toFixed(0)}%) → ${bestLaw.title}`;
          matchedCitation = cited;
          break;
        }
      }
    }

    if (foundLawId) {
      matched++;
      console.log(`[${matched}] ✅ #${item.id} ${item.name.substring(0, 30)}`);
      console.log(`    引用: ${matchedCitation}`);
      console.log(`    匹配: ${matchMethod} (lawId=${foundLawId})`);

      if (APPLY) {
        await prisma.enforcementItem.update({
          where: { id: item.id },
          data: { lawId: foundLawId },
        });
      }
    } else {
      unmatched++;
      unmatchedItems.push({ id: item.id, name: item.name, citedLaws });
    }
  }

  console.log(`\n=== 结果 ===`);
  console.log(`新匹配: ${matched}`);
  console.log(`仍未匹配: ${unmatched}`);

  if (unmatchedItems.length > 0) {
    console.log(`\n--- 仍未匹配的事项 ---`);
    for (const item of unmatchedItems) {
      console.log(`  #${item.id} ${item.name.substring(0, 40)}`);
      if (item.citedLaws.length > 0) {
        console.log(`    引用法规: ${item.citedLaws.join('、')}`);
      } else {
        console.log(`    （无法提取法规名称）`);
      }
    }
  }

  if (!APPLY && matched > 0) {
    console.log(`\n提示: 添加 --apply 参数执行实际更新`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
