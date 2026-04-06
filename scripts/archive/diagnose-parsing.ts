import { prisma } from '@/src/lib/db';

async function diagnoseParsing() {
  console.log('🔍 诊断法规解析问题...\n');

  // 1. 查找"直播电商"相关法规
  const laws = await prisma.law.findMany({
    where: {
      title: {
        contains: '直播电商'
      }
    },
    select: {
      id: true,
      title: true,
      _count: {
        select: { articles: true }
      }
    }
  });

  console.log(`📊 找到 ${laws.length} 个相关法规:\n`);

  for (const law of laws) {
    console.log(`法规ID: ${law.id}`);
    console.log(`标题: ${law.title}`);
    console.log(`条款数: ${law._count.articles}`);

    // 检查条款结构
    const articles = await prisma.article.findMany({
      where: { lawId: law.id },
      select: {
        id: true,
        title: true,
        _count: {
          select: { paragraphs: true }
        }
      },
      orderBy: { order: 'asc' },
      take: 5  // 只看前5条
    });

    console.log('\n前5条条款结构:');
    for (const art of articles) {
      const hasParagraphs = art._count.paragraphs > 0;

      console.log(`  条${art.title}:`);
      console.log(`    - paragraphs数量: ${art._count.paragraphs}`);

      if (hasParagraphs) {
        const paragraphs = await prisma.paragraph.findMany({
          where: { articleId: art.id },
          select: {
            number: true,
            content: true,
            _count: {
              select: { items: true }
            }
          },
          orderBy: { order: 'asc' }
        });

        paragraphs.forEach(p => {
          const preview = p.content ? p.content.substring(0, 50).replace(/\n/g, '\\n') : '(空)';
          console.log(`      款${p.number}: ${preview}... (${p._count.items}个项)`);
        });
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

diagnoseParsing()
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
