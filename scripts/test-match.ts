/**
 * 测试具体匹配案例
 */

import { prisma } from '@/src/lib/db';
import { parseArticleLevel } from '../src/lib/import/article-parser';

async function testMatch() {
  console.log('测试匹配案例\n');
  console.log('='.repeat(80));

  // 测试案例：第五条第一项
  const articleTitle = '第五条第一项';
  console.log(`Excel中的条款标题: "${articleTitle}"`);

  // 解析条款层级
  const level = parseArticleLevel(articleTitle);
  console.log(`\n解析结果:`);
  console.log(`  article: "${level.article}"`);
  console.log(`  paragraph: "${level.paragraph || '无'}"`);
  console.log(`  item: "${level.item || '无'}"`);

  // 标准化
  const normalizedArticleTitle = level.article
    .replace(/^第/, '')
    .replace(/条$/, '');
  console.log(`\n标准化后的article: "${normalizedArticleTitle}"`);

  // 查询法规
  const law = await prisma.law.findFirst({
    where: {
      title: {
        contains: '合同行政监督管理办法'
      }
    },
    select: {
      id: true,
      title: true
    }
  });

  if (law) {
    console.log(`\n匹配到法规: ID=${law.id}, "${law.title}"`);

    // 查询条款
    const article = await prisma.article.findFirst({
      where: {
        lawId: law.id,
        title: normalizedArticleTitle
      },
      select: {
        id: true,
        title: true,
        paragraphs: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            number: true,
            items: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                number: true
              }
            }
          }
        }
      }
    });

    if (article) {
      console.log(`\n✅ 找到条款: ID=${article.id}, "${article.title}"`);
      console.log(`   款数量: ${article.paragraphs.length}`);

      if (level.paragraph && article.paragraphs.length > 0) {
        const paragraphIndex = parseInt(level.paragraph.replace(/[第款]/g, '')) - 1;
        console.log(`\n   查找第${level.paragraph}...`);
        console.log(`   paragraphIndex: ${paragraphIndex}`);

        const paragraph = article.paragraphs[paragraphIndex];
        if (paragraph) {
          console.log(`   ✅ 找到款: ID=${paragraph.id}, number=${paragraph.number}`);
          console.log(`      项数量: ${paragraph.items.length}`);

          if (level.item && paragraph.items.length > 0) {
            const itemNumber = `（${level.item}）`;
            console.log(`\n   查找项 "${itemNumber}"...`);

            const item = paragraph.items.find((i) => i.number === itemNumber);
            if (item) {
              console.log(`   ✅ 找到项: ID=${item.id}`);
            } else {
              console.log(`   ❌ 未找到项`);
              console.log(`      数据库中的项:`);
              paragraph.items.forEach(i => {
                console.log(`        ${i.number}`);
              });
            }
          }
        } else {
          console.log(`   ❌ 未找到款`);
        }
      }
    } else {
      console.log(`\n❌ 未找到条款 "${normalizedArticleTitle}"`);
    }
  }

  await prisma.$disconnect();
}

testMatch();
