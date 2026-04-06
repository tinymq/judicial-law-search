import { prisma } from '@/src/lib/db';
import { writeFile } from 'fs/promises';
import { join } from 'path';

async function backupViolations() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

  console.log('📦 开始备份 Violation 表数据...');

  // 读取所有Violation记录（包含关联数据）
  const violations = await prisma.violation.findMany({
    include: {
      violationBasisLaw: {
        select: {
          id: true,
          title: true,
          level: true,
          category: true,
        }
      },
      violationBasisArticle: {
        select: {
          id: true,
          title: true,
        }
      },
      violationBasisParagraph: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
      violationBasisItem: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
      punishmentBasisLaw: {
        select: {
          id: true,
          title: true,
          level: true,
          category: true,
        }
      },
      punishmentBasisArticle: {
        select: {
          id: true,
          title: true,
        }
      },
      punishmentBasisParagraph: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
      punishmentBasisItem: {
        select: {
          id: true,
          number: true,
          content: true,
        }
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`✅ 找到 ${violations.length} 条 Violation 记录`);

  // 转换为JSON格式
  const backupData = {
    backupDate: new Date().toISOString(),
    totalRecords: violations.length,
    records: violations,
  };

  // 保存到文件
  const backupDir = join(process.cwd(), 'backups');
  const backupFile = join(backupDir, `violations-${timestamp}.json`);

  await writeFile(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`✅ 备份完成！`);
  console.log(`📁 备份文件: ${backupFile}`);
  console.log(`📊 记录数量: ${violations.length}`);
  console.log(`💾 文件大小: ${(JSON.stringify(backupData).length / 1024).toFixed(2)} KB`);
}

backupViolations()
  .catch((error) => {
    console.error('❌ 备份失败:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
