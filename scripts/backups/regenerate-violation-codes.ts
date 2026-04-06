import { prisma } from '@/src/lib/db';
import { getCodeForCategory } from '../../app/admin/utils/categoryCode';

async function regenerateViolationCodes() {
  console.log('🔄 开始重新生成违法行为编码...');

  // 1. 读取所有现有Violation记录
  const violations = await prisma.violation.findMany({
    include: {
      violationBasisLaw: {
        select: {
          id: true,
          title: true,
          category: true,
        }
      }
    },
    orderBy: {
      createdAt: 'asc' // 按创建时间排序，确保早期记录优先获得小编号
    }
  });

  console.log(`✅ 找到 ${violations.length} 条 Violation 记录`);

  if (violations.length === 0) {
    console.log('⚠️ 没有需要更新的记录');
    return;
  }

  // 2. 按category分组
  const violationsByCategory: Record<string, typeof violations> = {};

  for (const v of violations) {
    if (!v.violationBasisLaw?.category) {
      console.log(`⚠️ 跳过 Violation #${v.id}：没有关联的法规或category`);
      continue;
    }

    const category = v.violationBasisLaw.category;
    if (!violationsByCategory[category]) {
      violationsByCategory[category] = [];
    }
    violationsByCategory[category].push(v);
  }

  console.log(`📊 找到 ${Object.keys(violationsByCategory).length} 个不同的category`);

  // 3. 为每个category的违法行为重新生成编码
  let totalUpdated = 0;

  for (const [category, categoryViolations] of Object.entries(violationsByCategory)) {
    console.log(`\n📂 处理 category: ${category} (${categoryViolations.length} 条记录)`);

    // 获取该category的编码字母
    const codeLetter = await getCodeForCategory(category);
    console.log(`   编码字母: ${codeLetter}`);

    // 为该category下的每条记录生成新编码
    for (let i = 0; i < categoryViolations.length; i++) {
      const v = categoryViolations[i];
      const newNum = i + 1;
      const newCode = `${codeLetter}${String(newNum).padStart(3, '0')}`;

      console.log(`   ${v.code || '(无编码)'} → ${newCode} (${v.violationBasisLaw?.title})`);

      // 更新数据库
      await prisma.violation.update({
        where: { id: v.id },
        data: {
          code: newCode,
          categoryCode: codeLetter
        }
      });

      totalUpdated++;
    }
  }

  console.log(`\n✅ 完成！共更新 ${totalUpdated} 条记录`);
}

regenerateViolationCodes()
  .catch((error) => {
    console.error('❌ 错误:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
