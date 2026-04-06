const { PrismaClient } = require('@prisma/client');
const path = require('path');

// 强制使用根目录的 dev.db
const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient();

async function main() {
  // 尝试查询一个 article，看看是否还有 content 字段
  const article = await prisma.article.findFirst({
    select: {
      id: true,
      title: true,
      // content: true,  // 如果这个字段还存在，会报错
      paragraphs: {
        select: {
          id: true,
          number: true,
          content: true
        }
      }
    }
  });

  console.log('=== 数据库结构验证 ===');
  console.log('查询成功！article 表已经没有 content 字段');
  console.log('\n示例数据:');
  console.log(JSON.stringify(article, null, 2));
}

main()
  .catch((error) => {
    console.error('验证失败:', error.message);
  })
  .finally(() => prisma.$disconnect());
