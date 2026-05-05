/**
 * 修复浙江执法事项误关联到外省地方法规的问题
 *
 * 问题：relink 脚本的包含/关键词匹配策略过于宽松，
 * 将浙江事项关联到了其他省份的同名地方法规。
 *
 * 修复逻辑：
 *   1. 找出浙江事项关联到非浙江地方法规的记录
 *   2. 从 legalBasisText 重新提取法规名
 *   3. 按优先级重新匹配：浙江本省法规 > 国家法规 > 置空
 *
 * 用法：
 *   npx tsx scripts/governance/fix-cross-province-links.ts          # 试运行
 *   npx tsx scripts/governance/fix-cross-province-links.ts --apply   # 正式修复
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const ZJ_PREFIXES = ['浙江', '杭州', '宁波', '温州', '绍兴', '湖州', '嘉兴', '金华', '衢州', '台州', '丽水', '舟山'];

function isZhejiangLaw(title: string): boolean {
  return ZJ_PREFIXES.some(p => title.includes(p));
}

function normalize(name: string): string {
  return name
    .replace(/^中华人民共和国/, '')
    .replace(/[\(（]\d{4}年?[^)）]*[\)）]/g, '')
    .replace(/[\(（][^)）]*修[正订改][^)）]*[\)）]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function extractLawNames(text: string): string[] {
  const names = new Set<string>();
  const cleaned = text.replace(/\n/g, '');
  const bracketMatches = cleaned.match(/《([^》]+)》/g);
  if (bracketMatches) {
    for (const m of bracketMatches) {
      const name = m.slice(1, -1).replace(/\s+/g, '').trim();
      if (name.length > 3) names.add(name);
    }
  }
  const firstLine = text.split(/\n/)[0].replace(/_x000d_/g, '').replace(/\r/g, '').replace(/第[一二三四五六七八九十百千\d]+条.*/, '').trim();
  const coreName = firstLine.replace(/[\(（]\d{4}年?[^)）]*[\)）]/g, '').replace(/[\(（][^)）]*修[正订改][^)）]*[\)）]/g, '').trim();
  if (coreName.length > 3 && coreName.length < 80) names.add(coreName);
  if (firstLine !== coreName && firstLine.length > 3 && firstLine.length < 80) names.add(firstLine);
  return Array.from(names);
}

async function main() {
  console.log(`=== 修复浙江事项跨省误关联 ===`);
  console.log(`模式: ${APPLY ? '正式修复' : '试运行'}\n`);

  const allLaws = await prisma.law.findMany({ select: { id: true, title: true, level: true } });
  console.log(`数据库法规数: ${allLaws.length}`);

  // 构建匹配索引
  const exactMap = new Map<string, typeof allLaws[0]>();
  const normalizedMap = new Map<string, typeof allLaws[0][]>();
  for (const law of allLaws) {
    exactMap.set(law.title, law);
    const norm = normalize(law.title);
    if (!normalizedMap.has(norm)) normalizedMap.set(norm, []);
    normalizedMap.get(norm)!.push(law);
  }

  // 找出误关联记录
  const items = await prisma.enforcementItem.findMany({
    where: { province: '330000', lawId: { not: null } },
    select: { id: true, name: true, lawId: true, legalBasisText: true },
  });

  const lawMap = new Map(allLaws.map(l => [l.id, l]));
  const localLevels = new Set(['地方性法规', '地方政府规章']);

  const wrongItems: typeof items = [];
  for (const item of items) {
    const law = lawMap.get(item.lawId!);
    if (!law || !localLevels.has(law.level!)) continue;
    if (!isZhejiangLaw(law.title)) {
      wrongItems.push(item);
    }
  }

  console.log(`误关联事项数: ${wrongItems.length}\n`);

  let fixed = 0;
  let cleared = 0;
  let unchanged = 0;

  for (const item of wrongItems) {
    const citedLaws = item.legalBasisText ? extractLawNames(item.legalBasisText) : [];
    let newLawId: number | null = null;
    let matchInfo = '';

    for (const cited of citedLaws) {
      // 优先1：精确匹配浙江法规
      const exact = exactMap.get(cited);
      if (exact && (isZhejiangLaw(exact.title) || !localLevels.has(exact.level!))) {
        newLawId = exact.id;
        matchInfo = `精确 → ${exact.title}`;
        break;
      }

      // 优先2：规范化匹配，优先浙江本省 > 国家级
      const normCited = normalize(cited);
      const normMatches = normalizedMap.get(normCited);
      if (normMatches) {
        // 先找浙江本省
        const zjMatch = normMatches.find(l => isZhejiangLaw(l.title));
        if (zjMatch) {
          newLawId = zjMatch.id;
          matchInfo = `规范化(浙江) → ${zjMatch.title}`;
          break;
        }
        // 再找国家级（法律/行政法规/部门规章）
        const nationalMatch = normMatches.find(l => !localLevels.has(l.level!));
        if (nationalMatch) {
          newLawId = nationalMatch.id;
          matchInfo = `规范化(国家) → ${nationalMatch.title}`;
          break;
        }
      }

      // 优先3：精确匹配国家级法规（包含"中华人民共和国"前缀的版本）
      const withPrefix = `中华人民共和国${normCited}`;
      const prefixMatches = normalizedMap.get(normalize(withPrefix));
      if (prefixMatches) {
        const natMatch = prefixMatches.find(l => !localLevels.has(l.level!));
        if (natMatch) {
          newLawId = natMatch.id;
          matchInfo = `加前缀(国家) → ${natMatch.title}`;
          break;
        }
      }
    }

    if (newLawId && newLawId !== item.lawId) {
      fixed++;
      if (fixed <= 20) {
        console.log(`[${fixed}] ✅ #${item.id} ${item.name.substring(0, 35)}`);
        console.log(`    旧: ${lawMap.get(item.lawId!)?.title}`);
        console.log(`    新: ${matchInfo}`);
      }
      if (APPLY) {
        await prisma.enforcementItem.update({ where: { id: item.id }, data: { lawId: newLawId } });
      }
    } else if (!newLawId) {
      cleared++;
      if (cleared <= 5) {
        console.log(`[清空] #${item.id} ${item.name.substring(0, 35)}`);
        console.log(`    旧: ${lawMap.get(item.lawId!)?.title}`);
        console.log(`    引用: ${citedLaws.slice(0, 3).join('、') || '(无)'}`);
      }
      if (APPLY) {
        await prisma.enforcementItem.update({ where: { id: item.id }, data: { lawId: null } });
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\n=== 结果 ===`);
  console.log(`已修正(重新关联): ${fixed}`);
  console.log(`已清空(无正确匹配): ${cleared}`);
  console.log(`未变(已是正确关联): ${unchanged}`);

  if (!APPLY && (fixed + cleared) > 0) {
    console.log(`\n提示: 添加 --apply 参数执行实际修复`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
