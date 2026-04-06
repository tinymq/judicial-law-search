const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 删除所有测试数据
  await prisma.violation.deleteMany({});

  // 查询剩余数量
  const count = await prisma.violation.count();
  console.log('已删除所有测试数据，剩余违法行为:', count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
