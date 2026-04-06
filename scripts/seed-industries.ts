/**
 * 行业分类种子脚本
 * 将 industry-config.ts 中的行业数据写入 Industry 表
 *
 * 用法: npx tsx scripts/seed-industries.ts
 */
import { PrismaClient } from '@prisma/client';
import { INDUSTRIES } from '../src/lib/industry-config';

const prisma = new PrismaClient();

async function main() {
  console.log(`准备写入 ${INDUSTRIES.length} 个行业分类...`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < INDUSTRIES.length; i++) {
    const industry = INDUSTRIES[i];

    // upsert: 已存在则跳过，不存在则创建
    const existing = await prisma.industry.findUnique({
      where: { code: industry.code },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.industry.create({
      data: {
        code: industry.code,
        name: industry.name,
        parentCode: null, // 全部为一级行业
        order: i,
      },
    });
    created++;
  }

  console.log(`完成: 新增 ${created} 个, 跳过 ${skipped} 个（已存在）`);

  // 验证
  const count = await prisma.industry.count();
  console.log(`Industry 表当前共 ${count} 条记录`);
}

main()
  .catch((e) => {
    console.error('种子脚本执行失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
