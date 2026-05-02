/**
 * 浙江"市场监督管理"执法事项 → 二级领域匹配
 * 按事项名称关键词自动匹配市场监管的 18 个二级子领域
 *
 * 用法: npx tsx scripts/migrations/match-zhejiang-market-subdomain.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 关键词 → 二级领域编码（按优先级排序，先匹配先归类）
const KEYWORD_RULES: { code: string; keywords: string[] }[] = [
  { code: '30-01', keywords: ['食品', '餐饮', '食用', '保健食品', '食品添加剂', '婴幼儿配方', '乳制品', '食品生产', '食��经营'] },
  { code: '30-02', keywords: ['特种设备', '锅炉', '压力容器', '电梯', '起重机械', '客运索道', '游乐设施', '压力管道', '气瓶'] },
  { code: '30-04', keywords: ['广告', '虚假宣传'] },
  { code: '30-05', keywords: ['登记', '注册', '营业执照', '经营范围', '市场主体', '企业名称', '商事'] },
  { code: '30-06', keywords: ['计量', '计量器具', '衡器', '定量包装', '能效标识'] },
  { code: '30-07', keywords: ['产品质量', '生产许可', '工业产品', '强制性认证', 'CCC', '3C'] },
  { code: '30-08', keywords: ['价格', '明码标价', '不正当竞争', '仿冒', '商业贿赂', '虚假交易', '商业秘密', '低于成本'] },
  { code: '30-09', keywords: ['认证', '认可', '检验检测', '检测机构', '检验机构'] },
  { code: '30-10', keywords: ['标准化', '团体标准', '企业标准', '强制性标准'] },
  { code: '30-11', keywords: ['消费者', '三包', '格式条款', '预付卡', '单用途', '消费欺诈'] },
  { code: '30-12', keywords: ['电子商务', '网络交易', '网络销售', '直播', '网购', '网络经营'] },
  { code: '30-13', keywords: ['信用', '信息公示', '年报', '经营异常', '企业信息'] },
  { code: '30-14', keywords: ['反垄断', '经营者集中', '垄断协议', '滥用市场支配', '垄断'] },
  { code: '30-15', keywords: ['纤维', '棉花', '絮用纤维', '毛绒'] },
  { code: '30-16', keywords: ['传销', '直销'] },
  { code: '30-17', keywords: ['商标', '驰名商标'] },
  { code: '30-18', keywords: ['专利', '假冒专利'] },
];

const DEFAULT_CODE = '30-03'; // 市场秩序监管（综合）

function matchSubdomain(name: string): string {
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (name.includes(kw)) return rule.code;
    }
  }
  return DEFAULT_CODE;
}

async function main() {
  const items = await prisma.enforcementItem.findMany({
    where: { province: '330000', enforcementDomain: '市场监督管理' },
    select: { id: true, name: true },
  });

  console.log(`浙江市场监督管理��项: ${items.length} 条`);

  const stats: Record<string, number> = {};
  const results: { id: number; subCode: string }[] = [];

  for (const item of items) {
    const code = matchSubdomain(item.name);
    stats[code] = (stats[code] || 0) + 1;
    results.push({ id: item.id, subCode: code });
  }

  // 输出统计
  console.log('\n匹配结果:');
  const industries = await prisma.industry.findMany({
    where: { parentCode: '30' },
    select: { code: true, name: true },
  });
  const codeToName = new Map(industries.map(i => [i.code, i.name]));

  const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  for (const [code, count] of sorted) {
    console.log(`  ${code} ${codeToName.get(code) || '?'}: ${count} 条`);
  }

  // 写入 enforcementDomain 字段（覆盖为二级领域名称以统一格式）
  // 注意: 这里我们更新 enforcementDomain 为更精确的二级领域名称
  // 但为保持数据可追溯性，保留原始值不变，仅记录匹配结果供后续使用
  console.log('\n总计:', items.length, '条（默认归入 30-03:', stats[DEFAULT_CODE] || 0, '条）');

  // 实际写入：暂不修改原始 enforcementDomain，仅报告匹配结果
  // 如需写入，取消下方注释
  console.log('\n[DRY RUN] 未修改数据。确认无误后设 DRY_RUN=false 重新运行。');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
