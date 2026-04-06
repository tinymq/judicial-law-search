const { PrismaClient } = require('@prisma/client');
const path = require('path');

// 强制使用根目录的 dev.db
const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient();

async function main() {
  // 查找法规
  const law = await prisma.law.findFirst({
    where: {
      title: {
        contains: '海南'
      }
    },
    include: {
      articles: {
        where: {
          title: '第十条'
        },
        include: {
          paragraphs: {
            orderBy: { order: 'asc' },
            include: {
              items: {
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      }
    }
  });

  if (!law) {
    console.log('未找到该法规');
    return;
  }

  console.log('=== 法规信息 ===');
  console.log('ID:', law.id);
  console.log('标题:', law.title);
  console.log('');

  if (law.articles.length === 0) {
    console.log('未找到第十条');
    return;
  }

  const article = law.articles[0];
  console.log('=== 第十条信息 ===');
  console.log('Article ID:', article.id);
  console.log('标题:', article.title);
  console.log('内容:', article.content);
  console.log('章:', article.chapter);
  console.log('节:', article.section);
  console.log('');

  console.log('=== 款（Paragraphs）===');
  if (article.paragraphs.length === 0) {
    console.log('没有款');
  } else {
    article.paragraphs.forEach((para, idx) => {
      console.log(`\n款 ${para.number}:`);
      console.log('  ID:', para.id);
      console.log('  内容:', para.content);
      console.log('  Order:', para.order);

      if (para.items.length > 0) {
        console.log('  项（Items）:');
        para.items.forEach(item => {
          console.log(`    ${item.number}: ${item.content}`);
        });
      }
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
