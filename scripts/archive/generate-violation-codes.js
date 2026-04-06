/**
 * 为现有 Violation 数据生成编码
 *
 * 编码规则：[类别字母][编号]
 * - A: 市场主体登记
 * - B: 产品质量
 * - C: 价格违法
 * - D: 不正当竞争
 * - E: 消费者权益保护
 * - F: 广告违法
 * - G: 知识产权
 * - H: 食品药品
 * - I: 特种设备
 * - J: 其他
 *
 * 示例：A001、A002、B001
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 查询现有 Violation 数据...');

  const violations = await prisma.violation.findMany({
    orderBy: { id: 'asc' }
  });

  console.log(`📊 找到 ${violations.length} 条数据`);

  if (violations.length === 0) {
    console.log('✅ 没有需要处理的数据');
    return;
  }

  console.log('\n现有数据：');
  violations.forEach((v, index) => {
    console.log(`${index + 1}. ID: ${v.id}, 描述: ${v.description.substring(0, 30)}...`);
  });

  console.log('\n📝 生成编码规则：');
  console.log('- 默认使用 A 类别（市场主体登记）');
  console.log('- 编号从 001 开始递增');
  console.log('\n开始生成编码...\n');

  // 生成编码：A001、A002、A003...
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < violations.length; i++) {
    const violation = violations[i];
    const code = `A${String(i + 1).padStart(3, '0')}`; // A001, A002, A003...

    try {
      await prisma.violation.update({
        where: { id: violation.id },
        data: { code }
      });
      console.log(`✅ ID ${violation.id} → ${code}`);
      successCount++;
    } catch (error) {
      console.error(`❌ ID ${violation.id} 更新失败:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 完成！成功 ${successCount} 条，失败 ${errorCount} 条`);

  // 验证结果
  const updated = await prisma.violation.findMany({
    select: { id: true, code: true, description: true },
    orderBy: { id: 'asc' }
  });

  console.log('\n最终结果：');
  updated.forEach((v) => {
    console.log(`  ${v.code} - ${v.description.substring(0, 30)}...`);
  });
}

main()
  .catch((e) => {
    console.error('❌ 发生错误:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
