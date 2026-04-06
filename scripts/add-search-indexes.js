/**
 * 添加搜索索引的数据库迁移脚本
 * 执行时机：重启服务器后
 * 
 * 功能：
 * 1. 为 Law 表的搜索字段添加索引
 * 2. 为 Article、Paragraph、Item 表添加索引
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addSearchIndexes() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 添加搜索索引');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 使用 $executeRaw 执行 SQL
    // 注意：SQLite 的索引创建语法

    console.log('1️⃣ 为 Law 表添加索引...\n');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_law_title ON Law(title)
    `);
    console.log('  ✅ Law.title 索引已创建');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_law_category ON Law(category)
    `);
    console.log('  ✅ Law.category 索引已创建');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_law_region ON Law(region)
    `);
    console.log('  ✅ Law.region 索引已创建');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_law_status ON Law(status)
    `);
    console.log('  ✅ Law.status 索引已创建');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_law_lawGroupId ON Law(lawGroupId)
    `);
    console.log('  ✅ Law.lawGroupId 索引已创建');

    console.log('\n2️⃣ 为 Article 表添加索引...\n');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_article_lawId ON Article(lawId)
    `);
    console.log('  ✅ Article.lawId 索引已创建');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_article_title ON Article(title)
    `);
    console.log('  ✅ Article.title 索引已创建');

    console.log('\n3️⃣ 为 Paragraph 表添加索引...\n');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_paragraph_articleId ON Paragraph(articleId)
    `);
    console.log('  ✅ Paragraph.articleId 索引已创建');

    // 注意：SQLite 对 TEXT 类型的 LIKE 查询不使用索引
    // 但对于前缀匹配（LIKE 'keyword%'）可以使用索引
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_paragraph_content ON Paragraph(content)
    `);
    console.log('  ✅ Paragraph.content 索引已创建');

    console.log('\n4️⃣ 为 Item 表添加索引...\n');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_item_paragraphId ON Item(paragraphId)
    `);
    console.log('  ✅ Item.paragraphId 索引已创建');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_item_content ON Item(content)
    `);
    console.log('  ✅ Item.content 索引已创建');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 所有索引创建完成！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 验证索引
    console.log('🔍 验证索引创建...\n');

    const lawIndexes = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='Law'
      ORDER BY name
    `;
    console.log('  Law 表索引:', lawIndexes.map(i => i.name).join(', '));

    const articleIndexes = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='Article'
      ORDER BY name
    `;
    console.log('  Article 表索引:', articleIndexes.map(i => i.name).join(', '));

    const paragraphIndexes = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='Paragraph'
      ORDER BY name
    `;
    console.log('  Paragraph 表索引:', paragraphIndexes.map(i => i.name).join(', '));

    const itemIndexes = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='Item'
      ORDER BY name
    `;
    console.log('  Item 表索引:', itemIndexes.map(i => i.name).join(', '));

  } catch (error) {
    console.error('❌ 错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行
addSearchIndexes()
  .catch(err => {
    console.error('执行失败:', err);
    process.exit(1);
  });
