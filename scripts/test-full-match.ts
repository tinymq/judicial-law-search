/**
 * 完整测试匹配流程
 */

import { prisma } from '../src/lib/db';
import { parseArticleLevel } from '../src/lib/import/article-parser';

async function testFullMatch() {
  console.log('完整测试匹配流程\n');
  console.log('='.repeat(80));

  // 测试案例1：第五条第一项
  const testCases = [
    '第五条第一项',
    '第四条第一项',
    '第五条第四项',
    '第四十八条第一款',
    '第十八条第一款',
  ];

  for (const articleTitle of testCases) {
    console.log(`\n测试: "${articleTitle}"`);
    console.log('-'.repeat(60));

    // 解析条款层级
    const level = parseArticleLevel(articleTitle);
    console.log(`解析结果:`);
    console.log(`  article: "${level.article}"`);
    console.log(`  paragraph: "${level.paragraph || '无'}"`);
    console.log(`  item: "${level.item || '无'}"`);

    // 标准化article标题
    const normalizedArticleTitle = level.article
      .replace(/^第/, '')
      .replace(/条$/, '');
    console.log(`标准化article: "${normalizedArticleTitle}"`);

    // 查询"合同行政监督管理办法"(2025年修正)
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
        console.log(`✅ 找到条款: ID=${article.id}`);

        // 处理款
        let paragraphId = null;
        if (level.paragraph && article.paragraphs.length > 0) {
          const paragraphIndex = parseInt(level.paragraph.replace(/[第款]/g, '')) - 1;
          const paragraph = article.paragraphs[paragraphIndex];
          if (paragraph) {
            paragraphId = paragraph.id;
            console.log(`✅ 找到款: ID=${paragraph.id}`);

            // 处理项
            if (level.item && paragraph.items.length > 0) {
              const itemNumber = `（${level.item}）`;
              const item = paragraph.items.find((i) => i.number === itemNumber);
              if (item) {
                console.log(`✅ 找到项: ID=${item.id}`);
              } else {
                console.log(`❌ 未找到项 "${itemNumber}"`);
              }
            }
          } else {
            console.log(`❌ 未找到款`);
          }
        } else if (level.item && article.paragraphs.length > 0) {
          // 没有款但有项，使用第一个款
          const paragraph = article.paragraphs[0];
          paragraphId = paragraph.id;
          console.log(`使用第一个款: ID=${paragraph.id}`);

          const itemNumber = `（${level.item}）`;
          const item = paragraph.items.find((i) => i.number === itemNumber);
          if (item) {
            console.log(`✅ 找到项: ID=${item.id}`);
          } else {
            console.log(`❌ 未找到项 "${itemNumber}"`);
            console.log(`   数据库中的项:`, paragraph.items.map(i => i.number).join(', '));
          }
        } else {
          console.log(`✅ 只匹配到条层级`);
        }
      } else {
        console.log(`❌ 未找到条款 "${normalizedArticleTitle}"`);
      }
    }
  }

  await prisma.$disconnect();
}

testFullMatch();
