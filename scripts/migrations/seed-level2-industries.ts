/**
 * 二级领域种子脚本
 * 向 Industry 表插入 68 个二级领域（parentCode 指向一级）
 *
 * 用法: npx tsx scripts/migrations/seed-level2-industries.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LEVEL2_INDUSTRIES = [
  // === 市场监督管理(30) — 18 个二级 ===
  { code: "30-01", name: "食品安全监管", parentCode: "30", order: 1 },
  { code: "30-02", name: "特种设备监管", parentCode: "30", order: 2 },
  { code: "30-03", name: "市场秩序监管（综合）", parentCode: "30", order: 3 },
  { code: "30-04", name: "广告监管", parentCode: "30", order: 4 },
  { code: "30-05", name: "商事登记监管", parentCode: "30", order: 5 },
  { code: "30-06", name: "计量监管", parentCode: "30", order: 6 },
  { code: "30-07", name: "产品质量与生产许可", parentCode: "30", order: 7 },
  { code: "30-08", name: "价格与反不正当竞争", parentCode: "30", order: 8 },
  { code: "30-09", name: "认证认可检验检测", parentCode: "30", order: 9 },
  { code: "30-10", name: "标准化管理", parentCode: "30", order: 10 },
  { code: "30-11", name: "消费者权益保护", parentCode: "30", order: 11 },
  { code: "30-12", name: "电子商务与网络交易", parentCode: "30", order: 12 },
  { code: "30-13", name: "信用监管", parentCode: "30", order: 13 },
  { code: "30-14", name: "反垄断执法", parentCode: "30", order: 14 },
  { code: "30-15", name: "纤维检验监管", parentCode: "30", order: 15 },
  { code: "30-16", name: "直销传销监管", parentCode: "30", order: 16 },
  { code: "30-17", name: "商标监管", parentCode: "30", order: 17 },
  { code: "30-18", name: "专利监管", parentCode: "30", order: 18 },

  // === 公安(08) — 6 个二级 ===
  { code: "08-01", name: "治安管理", parentCode: "08", order: 1 },
  { code: "08-02", name: "道路交通安全", parentCode: "08", order: 2 },
  { code: "08-03", name: "出入境管理", parentCode: "08", order: 3 },
  { code: "08-04", name: "危爆物品管理", parentCode: "08", order: 4 },
  { code: "08-05", name: "网络安全", parentCode: "08", order: 5 },
  { code: "08-06", name: "禁毒", parentCode: "08", order: 6 },

  // === 生态环境(15) — 7 个二级 ===
  { code: "15-01", name: "水污染防治", parentCode: "15", order: 1 },
  { code: "15-02", name: "大气污染防治", parentCode: "15", order: 2 },
  { code: "15-03", name: "土壤污染与固废", parentCode: "15", order: 3 },
  { code: "15-04", name: "噪声与辐射", parentCode: "15", order: 4 },
  { code: "15-05", name: "环境影响评价", parentCode: "15", order: 5 },
  { code: "15-06", name: "排污许可管理", parentCode: "15", order: 6 },
  { code: "15-07", name: "自然生态保护", parentCode: "15", order: 7 },

  // === 交通运输(17) — 6 个二级 ===
  { code: "17-01", name: "道路运输", parentCode: "17", order: 1 },
  { code: "17-02", name: "水路运输", parentCode: "17", order: 2 },
  { code: "17-03", name: "公路管理", parentCode: "17", order: 3 },
  { code: "17-04", name: "港口管理", parentCode: "17", order: 4 },
  { code: "17-05", name: "城市公共交通", parentCode: "17", order: 5 },
  { code: "17-06", name: "交通安全综合", parentCode: "17", order: 6 },

  // === 农业农村(19) — 7 个二级 ===
  { code: "19-01", name: "种植业管理", parentCode: "19", order: 1 },
  { code: "19-02", name: "畜牧兽医", parentCode: "19", order: 2 },
  { code: "19-03", name: "渔业管理", parentCode: "19", order: 3 },
  { code: "19-04", name: "农产品质量安全", parentCode: "19", order: 4 },
  { code: "19-05", name: "农药与化肥", parentCode: "19", order: 5 },
  { code: "19-06", name: "种子管理", parentCode: "19", order: 6 },
  { code: "19-07", name: "农业机械", parentCode: "19", order: 7 },

  // === 住房和城乡建设(16) — 6 个二级 ===
  { code: "16-01", name: "建筑市场与施工", parentCode: "16", order: 1 },
  { code: "16-02", name: "工程质量安全", parentCode: "16", order: 2 },
  { code: "16-03", name: "房地产市场", parentCode: "16", order: 3 },
  { code: "16-04", name: "市政公用事业", parentCode: "16", order: 4 },
  { code: "16-05", name: "住房保障", parentCode: "16", order: 5 },
  { code: "16-06", name: "物业管理", parentCode: "16", order: 6 },

  // === 应急管理(24) — 4 个二级 ===
  { code: "24-01", name: "安全生产综合", parentCode: "24", order: 1 },
  { code: "24-02", name: "危险化学品", parentCode: "24", order: 2 },
  { code: "24-03", name: "烟花爆竹与民爆", parentCode: "24", order: 3 },
  { code: "24-04", name: "防灾减灾与应急救援", parentCode: "24", order: 4 },

  // === 卫生健康(22) — 5 个二级 ===
  { code: "22-01", name: "医疗机构与执业管理", parentCode: "22", order: 1 },
  { code: "22-02", name: "公共卫生", parentCode: "22", order: 2 },
  { code: "22-03", name: "传染病防治", parentCode: "22", order: 3 },
  { code: "22-04", name: "职业卫生", parentCode: "22", order: 4 },
  { code: "22-05", name: "中医药管理", parentCode: "22", order: 5 },

  // === 文化和旅游(21) — 4 个二级 ===
  { code: "21-01", name: "文化市场", parentCode: "21", order: 1 },
  { code: "21-02", name: "旅游管理", parentCode: "21", order: 2 },
  { code: "21-03", name: "演出与娱乐", parentCode: "21", order: 3 },
  { code: "21-04", name: "网络文化", parentCode: "21", order: 4 },

  // === 自然资源(14) — 5 个二级 ===
  { code: "14-01", name: "土地管理", parentCode: "14", order: 1 },
  { code: "14-02", name: "矿产资源", parentCode: "14", order: 2 },
  { code: "14-03", name: "海洋管理", parentCode: "14", order: 3 },
  { code: "14-04", name: "测绘地理信息", parentCode: "14", order: 4 },
  { code: "14-05", name: "国土空间规划", parentCode: "14", order: 5 },
];

async function main() {
  console.log(`准备插入 ${LEVEL2_INDUSTRIES.length} 个二级领域...`);

  let created = 0;
  let skipped = 0;

  for (const item of LEVEL2_INDUSTRIES) {
    const existing = await prisma.industry.findUnique({
      where: { code: item.code },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.industry.create({
      data: {
        code: item.code,
        name: item.name,
        parentCode: item.parentCode,
        order: item.order,
      },
    });
    created++;
  }

  console.log(`完成: 新建 ${created} 条, 跳过 ${skipped} 条（已存在）`);

  const total = await prisma.industry.count();
  const level2Count = await prisma.industry.count({ where: { parentCode: { not: null } } });
  console.log(`Industry 表总计: ${total} 条（一级: ${total - level2Count}, 二级: ${level2Count}）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
