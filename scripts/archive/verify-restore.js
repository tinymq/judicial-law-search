const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('验证数据库恢复结果...\n');

  // 检查各表的数量
  const lawCount = await prisma.law.count();
  const articleCount = await prisma.article.count();
  const paragraphCount = await prisma.paragraph.count();
  const itemCount = await prisma.item.count();
  const violationCount = await prisma.violation.count();

  console.log('═══════════════════════════════════════');
  console.log('数据库统计：');
  console.log('═══════════════════════════════════════');
  console.log(`法规 (Law):        ${lawCount} 条`);
  console.log(`条款 (Article):    ${articleCount} 条`);
  console.log(`段落 (Paragraph):  ${paragraphCount} 条`);
  console.log(`项目 (Item):       ${itemCount} 条`);
  console.log(`违法行为 (Violation): ${violationCount} 条`);
  console.log('═══════════════════════════════════════\n');

  // 显示前3条法规
  const laws = await prisma.law.findMany({
    take: 3,
    select: {
      id: true,
      title: true,
      level: true,
      category: true,
    }
  });

  console.log('前3条法规：');
  laws.forEach((law, index) => {
    console.log(`  ${index + 1}. [${law.level}] ${law.title}`);
    console.log(`     类别：${law.category}\n`);
  });

  // 验证Violation表是否存在且为空
  if (violationCount === 0) {
    console.log('✅ Violation 表已创建，当前为空（符合预期）');
  } else {
    console.log(`⚠️  Violation 表有 ${violationCount} 条数据（可能来自旧数据）`);
  }
}

main()
  .catch((e) => {
    console.error('❌ 验证失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
