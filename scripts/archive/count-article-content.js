const { PrismaClient } = require('@prisma/client');
const path = require('path');

// 强制使用根目录的 dev.db
const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient();

async function main() {
  // 统计使用 article.content 的条款数量
  const countWithContent = await prisma.article.count({
    where: { content: { not: null } }
  });

  // 统计使用 paragraphs 的条款数量
  const countWithParagraphs = await prisma.article.count({
    where: { paragraphs: { some: {} } }
  });

  // 统计总条款数
  const totalArticles = await prisma.article.count();

  console.log('=== 条款统计 ===');
  console.log(`总条款数: ${totalArticles}`);
  console.log(`使用 article.content 的条款: ${countWithContent}`);
  console.log(`使用 paragraphs 的条款: ${countWithParagraphs}`);
  console.log(`两者都使用的条款: ${countWithContent + countWithParagraphs - totalArticles}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
