/**
 * 检查数据库中的药品管理法
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDrugLaw() {
  try {
    console.log('🔍 搜索数据库中的药品管理法...\n');

    // 搜索包含"药品管理法"的法规
    const laws = await prisma.law.findMany({
      where: {
        title: {
          contains: '药品管理法'
        }
      },
      include: {
        articles: {
          orderBy: {
            order: 'asc'
          },
          take: 15,  // 只看前15条
          include: {
            paragraphs: {
              orderBy: {
                order: 'asc'
              },
              include: {
                items: {
                  orderBy: {
                    order: 'asc'
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`找到 ${laws.length} 个包含"药品管理法"的法规\n`);

    for (const law of laws) {
      console.log('='.repeat(60));
      console.log(`标题: ${law.title}`);
      console.log(`ID: ${law.id}`);
      console.log(`条款总数: ${law.articleCount}`);
      console.log(`序言: ${law.preamble ? law.preamble.substring(0, 50) + '...' : '(无)'}`);
      console.log('\n前15条的章节分布：');

      law.articles.forEach((art, index) => {
        const artNum = index + 1;
        const chapter = art.chapter || '(无章节)';
        const title = art.title;
        const hasContent = art.content || art.paragraphs?.length > 0;

        console.log(`  ${artNum}. 第${title}条 [${chapter}] ${hasContent ? '✓' : '✗'}`);

        // 如果是前10条中任意一条没有章节，标记为异常
        if (artNum <= 10 && !art.chapter) {
          console.log(`      ⚠️  警告：第${artNum}条没有关联章节！`);
        }
      });

      // 检查是否有问题：前10条中是否有无章节的
      const firstTenWithoutChapter = law.articles
        .slice(0, 10)
        .filter(art => !art.chapter);

      if (firstTenWithoutChapter.length > 0) {
        console.log(`\n❌ 发现问题：前10条中有 ${firstTenWithoutChapter.length} 条没有关联章节！`);
        console.log('   这条法规需要重新解析和保存。\n');
      } else {
        console.log('\n✅ 前10条都有关联章节，解析正常。\n');
      }
    }

    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDrugLaw();
