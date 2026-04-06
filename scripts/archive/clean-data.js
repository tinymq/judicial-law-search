const { PrismaClient } = require('@prisma/client');
const path = require('path');

// 强制使用根目录的 dev.db
const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient();

// 保留的测试法规ID
const KEEP_LAW_IDS = [230, 162, 262, 241];

async function main() {
  console.log('=== 开始清理数据 ===\n');

  // 1. 查询当前法规总数
  const totalLaws = await prisma.law.count();
  console.log(`当前法规总数: ${totalLaws}`);

  // 2. 查询要保留的法规
  const keepLaws = await prisma.law.findMany({
    where: { id: { in: KEEP_LAW_IDS } },
    select: { id: true, title: true }
  });

  console.log(`\n保留的法规 (${keepLaws.length}条):`);
  keepLaws.forEach(law => {
    console.log(`  ID: ${law.id} - ${law.title}`);
  });

  // 3. 删除其他法规
  console.log('\n开始删除其他法规...');
  const deleteResult = await prisma.law.deleteMany({
    where: { id: { notIn: KEEP_LAW_IDS } }
  });

  console.log(`已删除 ${deleteResult.count} 条法规`);

  // 4. 验证结果
  const remainingLaws = await prisma.law.count();
  const remainingArticles = await prisma.article.count();

  console.log('\n=== 清理完成 ===');
  console.log(`剩余法规数: ${remainingLaws}`);
  console.log(`剩余条款数: ${remainingArticles}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
