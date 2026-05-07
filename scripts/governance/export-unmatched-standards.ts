/**
 * 导出未匹配法规的检查标准清单
 *
 * 列出所有 law 字段非空但 lawId 为空的检查标准，
 * 包含对应执法事项的前端链接，方便人工审查。
 *
 * 用法：npx tsx scripts/governance/export-unmatched-standards.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  const unmatched = await prisma.inspectionStandard.findMany({
    where: {
      lawId: null,
      law: { not: null },
      NOT: { law: '' },
    },
    select: {
      id: true,
      checkItem: true,
      law: true,
      enforcementItemId: true,
      enforcementItem: {
        select: { name: true },
      },
    },
    orderBy: { enforcementItemId: 'asc' },
  });

  console.log(`未匹配检查标准总数: ${unmatched.length}`);

  const rows = unmatched.map((s, i) => ({
    '序号': i + 1,
    '检查标准ID': s.id,
    '检查项': s.checkItem,
    '法律依据原文': s.law,
    '执法事项': s.enforcementItem.name,
    '前端链接': `http://localhost:3000/enforcement/${s.enforcementItemId}`,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 },  // 序号
    { wch: 10 }, // 检查标准ID
    { wch: 30 }, // 检查项
    { wch: 60 }, // 法律依据原文
    { wch: 40 }, // 执法事项
    { wch: 45 }, // 前端链接
  ];
  XLSX.utils.book_append_sheet(wb, ws, '未匹配检查标准');

  const outPath = 'C:/Users/26371/Documents/Mo Obsidian/Mo CCLearning/2026司法执法监督/执法事项研究/未匹配检查标准清单.xlsx';
  XLSX.writeFile(wb, outPath);
  console.log(`已导出: ${outPath}`);

  // 按执法事项汇总
  const byItem = new Map<number, number>();
  for (const s of unmatched) {
    byItem.set(s.enforcementItemId, (byItem.get(s.enforcementItemId) || 0) + 1);
  }
  console.log(`涉及执法事项数: ${byItem.size}`);

  await prisma.$disconnect();
}

main().catch(console.error);
