const { PrismaClient } = require('@prisma/client');
const path = require('path');

// 强制使用根目录的 dev.db
const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient();

async function main() {
  // 查找所有包含"海南"或"塑料"的法规
  const laws = await prisma.law.findMany({
    where: {
      OR: [
        { title: { contains: '海南' } },
        { title: { contains: '塑料' } },
        { title: { contains: '降解' } }
      ]
    },
    select: {
      id: true,
      title: true,
      _count: {
        select: { articles: true }
      }
    }
  });

  console.log(`找到 ${laws.length} 条相关法规：\n`);

  if (laws.length === 0) {
    console.log('数据库中没有相关法规');
    console.log('\n让我列出所有法规：\n');

    const allLaws = await prisma.law.findMany({
      select: {
        id: true,
        title: true
      },
      take: 20
    });

    allLaws.forEach(law => {
      console.log(`ID: ${law.id} - ${law.title}`);
    });
  } else {
    laws.forEach(law => {
      console.log(`ID: ${law.id}`);
      console.log(`标题: ${law.title}`);
      console.log(`条款数: ${law._count.articles}`);
      console.log('---');
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
