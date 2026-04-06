/**
 * 给现有法规打行业标签
 * 将所有 industryId 为空的法规标记为"市场监督管理"(code=30)
 *
 * 用法: npx tsx scripts/tag-existing-laws-industry.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const industry = await prisma.industry.findUnique({ where: { code: '30' } });
  if (!industry) {
    console.log('未找到市场监督管理行业，请先运行 seed-industries.ts');
    return;
  }
  console.log(`市场监督管理行业 ID: ${industry.id}`);

  const result = await prisma.law.updateMany({
    where: { industryId: null },
    data: { industryId: industry.id },
  });
  console.log(`已更新 ${result.count} 部法规的行业标签为: 市场监督管理`);

  const total = await prisma.law.count();
  const tagged = await prisma.law.count({ where: { industryId: { not: null } } });
  console.log(`法规总数: ${total}, 已标记行业: ${tagged}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
