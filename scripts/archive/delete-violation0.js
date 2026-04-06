const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 删除违法行为0（只有Article无款无项的测试数据）
  const result = await prisma.violation.deleteMany({
    where: {
      description: { contains: '只有Article' }
    }
  });

  // 删除第十五条（只用于违法行为0）
  const article = await prisma.article.findFirst({
    where: { title: '第十五条' }
  });

  if (article) {
    // 先删除关联的paragraph（如果有）
    await prisma.paragraph.deleteMany({
      where: { articleId: article.id }
    });
    // 删除article
    await prisma.article.delete({
      where: { id: article.id }
    });
  }

  console.log('✅ 已删除违法行为0及其关联数据');
  console.log('\n现在只保留有意义的测试数据：');
  console.log('- 违法行为1：单款无项 → 第五条 + 内容');
  console.log('- 违法行为2：多款无项 → 第八条第一款 + 内容');
  console.log('- 违法行为3：多款有项 → 第十二条第一款第（一）项 + 内容');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
