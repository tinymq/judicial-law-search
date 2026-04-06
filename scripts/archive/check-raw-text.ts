import { prisma } from '@/src/lib/db';

async function checkRawText() {
  // 查看直播电商法规的preamble（可能包含原始文本）
  const law = await prisma.law.findFirst({
    where: {
      title: {
        contains: '直播电商'
      }
    },
    select: {
      id: true,
      title: true,
      preamble: true  // 查看序言字段
    }
  });

  if (!law) {
    console.log('❌ 未找到法规');
    return;
  }

  console.log('📄 法规信息:');
  console.log(`标题: ${law.title}`);
  console.log(`ID: ${law.id}\n`);

  if (law.preamble) {
    console.log('📝 序言内容（前500字符）:');
    console.log(law.preamble.substring(0, 500));
    console.log('\n...');

    // 检查换行符
    const newlineCount = (law.preamble.match(/\n/g) || []).length;
    console.log(`\n换行符数量: ${newlineCount}`);

    // 检查第一条
    const firstArticleMatch = law.preamble.match(/第一条.*?(?=\n第二条|\n第三条|$)/s);
    if (firstArticleMatch) {
      console.log('\n📋 第一条内容（前200字符）:');
      console.log(firstArticleMatch[0].substring(0, 200));
      console.log('...');
    }

    // 检查第二条是否存在
    if (law.preamble.includes('第二条')) {
      console.log('\n✅ 文本中包含"第二条"');
    } else {
      console.log('\n❌ 文本中不包含"第二条"');
    }
  } else {
    console.log('⚠️ 该法规没有序言内容');
  }

  // 检查第一条Article的内容
  const firstArticle = await prisma.article.findFirst({
    where: {
      lawId: law.id,
      title: '一'
    },
    select: {
      id: true,
      paragraphs: {
        select: {
          content: true
        },
        take: 1
      }
    }
  });

  if (firstArticle) {
    const content = firstArticle.paragraphs[0]?.content || '';
    console.log('\n📊 第一条Article存储的内容（前200字符）:');
    console.log(content.substring(0, 200));
    console.log('...');
    console.log(`总长度: ${content.length} 字符`);
  }
}

checkRawText()
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
