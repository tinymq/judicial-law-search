import { prisma } from '@/src/lib/db';

async function checkLevels() {
  const levels = await prisma.law.groupBy({
    by: ['level'],
    _count: { id: true },
  });

  console.log('=== 当前数据库中的效力位阶统计 ===\n');
  levels.forEach(item => {
    console.log(`${item.level}: ${item._count.id}条`);
  });

  // 检查需要整合的位阶
  const targetLevels = ['经济特区法规', '海南自由贸易港法规'];
  console.log('\n=== 需要整合到"地方性法规"的位阶 ===\n');
  for (const level of targetLevels) {
    const count = await prisma.law.count({
      where: { level }
    });
    console.log(`${level}: ${count}条`);
  }
}

checkLevels()
  .then(() => {
    console.log('\n✅ 检查完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 错误:', err);
    process.exit(1);
  });
