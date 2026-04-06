import { prisma } from '@/src/lib/db';

async function diagnose() {
  console.log('=== 诊断法规组ID和历史法规状态 ===\n');

  // 1. 查找"禁止垄断协议规定"相关法规
  console.log('1️⃣ 查找"禁止垄断协议规定":\n');
  const monopolyLaws = await prisma.law.findMany({
    where: {
      title: {
        contains: '禁止垄断协议规定'
      }
    },
    select: {
      id: true,
      title: true,
      lawGroupId: true,
      status: true,
      effectiveDate: true,
    },
    orderBy: {
      effectiveDate: 'desc'
    }
  });

  monopolyLaws.forEach(law => {
    console.log(`  ID: ${law.id}`);
    console.log(`  标题: ${law.title}`);
    console.log(`  lawGroupId: ${law.lawGroupId}`);
    console.log(`  时效性: ${law.status}`);
    console.log(`  施行日期: ${law.effectiveDate}`);
    console.log('');
  });

  // 2. 查找"制止滥用行政权力排除、限制竞争行为规定"相关法规
  console.log('2️⃣ 查找"制止滥用行政权力排除、限制竞争行为规定":\n');
  const abuseLaws = await prisma.law.findMany({
    where: {
      title: {
        contains: '制止滥用行政权力排除、限制竞争行为规定'
      }
    },
    select: {
      id: true,
      title: true,
      lawGroupId: true,
      status: true,
      effectiveDate: true,
    },
    orderBy: {
      effectiveDate: 'desc'
    }
  });

  abuseLaws.forEach(law => {
    console.log(`  ID: ${law.id}`);
    console.log(`  标题: ${law.title}`);
    console.log(`  lawGroupId: ${law.lawGroupId}`);
    console.log(`  时效性: ${law.status}`);
    console.log(`  施行日期: ${law.effectiveDate}`);
    console.log('');
  });

  // 3. 检查是否有其他法规也使用相同的 lawGroupId
  if (monopolyLaws.length > 0) {
    const groupId = monopolyLaws[0].lawGroupId;
    console.log(`3️⃣ 检查 lawGroupId = ${groupId} 的所有法规:\n`);
    const sameGroupLaws = await prisma.law.findMany({
      where: {
        lawGroupId: groupId
      },
      select: {
        id: true,
        title: true,
        status: true,
        effectiveDate: true,
      },
      orderBy: {
        effectiveDate: 'desc'
      }
    });

    sameGroupLaws.forEach(law => {
      console.log(`  ID: ${law.id}`);
      console.log(`  标题: ${law.title}`);
      console.log(`  时效性: ${law.status}`);
      console.log(`  施行日期: ${law.effectiveDate}`);
      console.log('');
    });
  }

  // 4. 测试 cleanTitleForGroupId 函数
  console.log('4️⃣ 测试 cleanTitleForGroupId 函数:\n');
  const testTitles = [
    '禁止垄断协议规定(2025修正)',
    '禁止垄断协议规定(2024年修订)',
    '制止滥用行政权力排除、限制竞争行为规定(2025)',
  ];

  const crypto = require('crypto');
  const cleanTitleForGroupId = (title: string) => {
    return title
      .replace(/\(\d{4}[^)]*\)/g, '')  // 去掉 (2018年修订)、(2019年公布) 等
      .replace(/暂行|试行|修改|修订/g, '')  // 去掉修饰词
      .trim();
  };

  const generateLawGroupId = (title: string) => {
    const clean = cleanTitleForGroupId(title);
    const hash = crypto.createHash('md5').update(clean).digest('hex');
    return `LAW_${hash.substring(0, 12).toUpperCase()}`;
  };

  testTitles.forEach(title => {
    const cleaned = cleanTitleForGroupId(title);
    const groupId = generateLawGroupId(title);
    console.log(`  原标题: ${title}`);
    console.log(`  清理后: ${cleaned}`);
    console.log(`  lawGroupId: ${groupId}`);
    console.log('');
  });
}

diagnose()
  .then(() => {
    console.log('✅ 诊断完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 诊断失败:', err);
    process.exit(1);
  });
