/**
 * Category → Industry 迁移脚本
 * 将法规的 category 字段映射到 Industry 关联（LawIndustry 多对多）
 *
 * 用法: npx tsx scripts/migrations/migrate-category-to-industry.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// category → { industryCode(一级), subCode(二级,可选) }
const CATEGORY_MAP: Record<string, { industryCode: string; subCode?: string }> = {
  // === 市场监管(30)及其二级 ===
  '综合执法': { industryCode: '30', subCode: '30-03' },
  '市场监管': { industryCode: '30', subCode: '30-03' },
  '网监与合同': { industryCode: '30', subCode: '30-12' },
  '信用监管': { industryCode: '30', subCode: '30-13' },
  '标准管理': { industryCode: '30', subCode: '30-10' },
  '食品安全': { industryCode: '30', subCode: '30-01' },
  '价格监管': { industryCode: '30', subCode: '30-08' },
  '计量监督': { industryCode: '30', subCode: '30-06' },
  '商事登记': { industryCode: '30', subCode: '30-05' },
  '广告监管': { industryCode: '30', subCode: '30-04' },
  '产品质量': { industryCode: '30', subCode: '30-07' },
  '消费维权': { industryCode: '30', subCode: '30-11' },
  '特种设备': { industryCode: '30', subCode: '30-02' },

  // === 提升为独立一级领域 ===
  '知识产权': { industryCode: '40' },
  '药品监管': { industryCode: '39' },
  '医疗器械': { industryCode: '39' },

  // === 其他一级/二级领域 ===
  '安全生产': { industryCode: '24', subCode: '24-01' },
  '危险化学品': { industryCode: '24', subCode: '24-02' },
  '民用爆炸': { industryCode: '24', subCode: '24-03' },
  '建设工程': { industryCode: '16', subCode: '16-01' },
  '住房城建': { industryCode: '16' },
  '医疗卫生': { industryCode: '22' },
  '农业农村': { industryCode: '19' },
  '广播电视': { industryCode: '46' },
  '环境保护': { industryCode: '15' },
  '道路运输': { industryCode: '17', subCode: '17-01' },
  '水运交通': { industryCode: '17', subCode: '17-02' },
  '公路管理': { industryCode: '17', subCode: '17-03' },
  '交通运输': { industryCode: '17' },
  '商务贸易': { industryCode: '20' },
  '气象服务': { industryCode: '50' },
  '司法行政': { industryCode: '11' },
  '人力资源': { industryCode: '13' },
  '网络信息': { industryCode: '65' },
  '自然资源': { industryCode: '14' },
  '教育管理': { industryCode: '04' },
  '财政税务': { industryCode: '12' },
  '公安管理': { industryCode: '08' },
  '林业草原': { industryCode: '34' },
  '民政管理': { industryCode: '10' },
  '水利管理': { industryCode: '18' },
  '消防安全': { industryCode: '53' },
  '烟草管理': { industryCode: '33' },
  '宗教事务': { industryCode: '07' },
};

// 反垄断与反不正当竞争需按法规标题拆分
const ANTITRUST_CATEGORY = '反垄断与反不正当竞争';

async function main() {
  // 预加载 Industry code → id 映射
  const industries = await prisma.industry.findMany({ select: { id: true, code: true } });
  const codeToId = new Map(industries.map(i => [i.code, i.id]));

  let created = 0;
  let skipped = 0;
  let errors: string[] = [];

  // 处理常规映射
  for (const [category, target] of Object.entries(CATEGORY_MAP)) {
    const laws = await prisma.law.findMany({
      where: { category },
      select: { id: true, title: true },
    });

    if (laws.length === 0) continue;

    const primaryIndustryId = codeToId.get(target.industryCode);
    const subIndustryId = target.subCode ? codeToId.get(target.subCode) : null;

    if (!primaryIndustryId) {
      errors.push(`找不到 Industry code=${target.industryCode}`);
      continue;
    }

    for (const law of laws) {
      // 更新 Law.industryId 指向一级领域
      await prisma.law.update({
        where: { id: law.id },
        data: { industryId: primaryIndustryId },
      });

      // 创建 LawIndustry: 一级领域（如果没有二级）或二级领域
      const targetId = subIndustryId || primaryIndustryId;
      await prisma.lawIndustry.upsert({
        where: { lawId_industryId: { lawId: law.id, industryId: targetId } },
        update: { isPrimary: true },
        create: { lawId: law.id, industryId: targetId, isPrimary: true },
      });

      // 如果有二级，也关联一级（isPrimary=false）
      if (subIndustryId) {
        await prisma.lawIndustry.upsert({
          where: { lawId_industryId: { lawId: law.id, industryId: primaryIndustryId } },
          update: {},
          create: { lawId: law.id, industryId: primaryIndustryId, isPrimary: false },
        });
      }

      created++;
    }

    console.log(`[${category}] → ${target.industryCode}${target.subCode ? '/' + target.subCode : ''}: ${laws.length} 条`);
  }

  // 处理"反垄断与反不正当竞争"拆分
  const antitrustLaws = await prisma.law.findMany({
    where: { category: ANTITRUST_CATEGORY },
    select: { id: true, title: true },
  });

  const marketId = codeToId.get('30')!;
  const anti08Id = codeToId.get('30-08')!; // 价格与反不正当竞争
  const anti14Id = codeToId.get('30-14')!; // 反垄断执法

  for (const law of antitrustLaws) {
    const isAntitrust = law.title.includes('反垄断') || law.title.includes('经营者集中');
    const subId = isAntitrust ? anti14Id : anti08Id;

    await prisma.law.update({
      where: { id: law.id },
      data: { industryId: marketId },
    });

    await prisma.lawIndustry.upsert({
      where: { lawId_industryId: { lawId: law.id, industryId: subId } },
      update: { isPrimary: true },
      create: { lawId: law.id, industryId: subId, isPrimary: true },
    });

    await prisma.lawIndustry.upsert({
      where: { lawId_industryId: { lawId: law.id, industryId: marketId } },
      update: {},
      create: { lawId: law.id, industryId: marketId, isPrimary: false },
    });

    created++;
  }

  if (antitrustLaws.length > 0) {
    console.log(`[${ANTITRUST_CATEGORY}] 拆分: ${antitrustLaws.length} 条`);
  }

  // 统计
  console.log(`\n完成: 迁移 ${created} 条, 跳过 ${skipped} 条`);
  if (errors.length > 0) {
    console.log('错误:', errors.join('; '));
  }

  const liCount = await prisma.lawIndustry.count();
  console.log(`LawIndustry 表总记录数: ${liCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
