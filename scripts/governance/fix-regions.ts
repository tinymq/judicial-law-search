/**
 * Phase 3: 区域分类规范化脚本
 *
 * 修复区域解析错误（如"湘潭市城"→"湘潭"），匹配到标准行政区划
 *
 * 用法：
 *   npx tsx scripts/governance/fix-regions.ts          # 分析模式
 *   npx tsx scripts/governance/fix-regions.ts --apply   # 执行修复
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';

// 内联 normalizeRegion 逻辑（避免 ESM/CJS 问题）
// 省份列表
const PROVINCES = [
  { code: "110000", shortName: "北京" }, { code: "120000", shortName: "天津" },
  { code: "130000", shortName: "河北" }, { code: "140000", shortName: "山西" },
  { code: "150000", shortName: "内蒙古" }, { code: "210000", shortName: "辽宁" },
  { code: "220000", shortName: "吉林" }, { code: "230000", shortName: "黑龙江" },
  { code: "310000", shortName: "上海" }, { code: "320000", shortName: "江苏" },
  { code: "330000", shortName: "浙江" }, { code: "340000", shortName: "安徽" },
  { code: "350000", shortName: "福建" }, { code: "360000", shortName: "江西" },
  { code: "370000", shortName: "山东" }, { code: "410000", shortName: "河南" },
  { code: "420000", shortName: "湖北" }, { code: "430000", shortName: "湖南" },
  { code: "440000", shortName: "广东" }, { code: "450000", shortName: "广西" },
  { code: "460000", shortName: "海南" }, { code: "500000", shortName: "重庆" },
  { code: "510000", shortName: "四川" }, { code: "520000", shortName: "贵州" },
  { code: "530000", shortName: "云南" }, { code: "540000", shortName: "西藏" },
  { code: "610000", shortName: "陕西" }, { code: "620000", shortName: "甘肃" },
  { code: "630000", shortName: "青海" }, { code: "640000", shortName: "宁夏" },
  { code: "650000", shortName: "新疆" },
];

// 城市→省份映射（完整版在 src/lib/region-config.ts）
const CITY_TO_PROVINCE: Record<string, string> = {
  石家庄: "130000", 唐山: "130000", 秦皇岛: "130000", 邯郸: "130000",
  邢台: "130000", 保定: "130000", 张家口: "130000", 承德: "130000",
  沧州: "130000", 廊坊: "130000", 衡水: "130000",
  太原: "140000", 大同: "140000", 阳泉: "140000", 长治: "140000",
  晋城: "140000", 朔州: "140000", 晋中: "140000", 运城: "140000",
  忻州: "140000", 临汾: "140000", 吕梁: "140000",
  呼和浩特: "150000", 包头: "150000", 乌海: "150000", 赤峰: "150000",
  通辽: "150000", 鄂尔多斯: "150000", 呼伦贝尔: "150000", 巴彦淖尔: "150000",
  乌兰察布: "150000",
  沈阳: "210000", 大连: "210000", 鞍山: "210000", 抚顺: "210000",
  本溪: "210000", 丹东: "210000", 锦州: "210000", 营口: "210000",
  阜新: "210000", 辽阳: "210000", 盘锦: "210000", 铁岭: "210000",
  朝阳: "210000", 葫芦岛: "210000",
  长春: "220000", 四平: "220000", 辽源: "220000",
  通化: "220000", 白山: "220000", 松原: "220000", 白城: "220000",
  延边朝鲜族自治州: "220000",
  哈尔滨: "230000", 齐齐哈尔: "230000", 鸡西: "230000", 鹤岗: "230000",
  双鸭山: "230000", 大庆: "230000", 伊春: "230000", 佳木斯: "230000",
  七台河: "230000", 牡丹江: "230000", 黑河: "230000", 绥化: "230000",
  大兴安岭: "230000",
  南京: "320000", 无锡: "320000", 徐州: "320000", 常州: "320000",
  苏州: "320000", 南通: "320000", 连云港: "320000", 淮安: "320000",
  盐城: "320000", 扬州: "320000", 镇江: "320000", 泰州: "320000",
  宿迁: "320000",
  杭州: "330000", 宁波: "330000", 温州: "330000", 嘉兴: "330000",
  湖州: "330000", 绍兴: "330000", 金华: "330000", 衢州: "330000",
  舟山: "330000", 台州: "330000", 丽水: "330000", 龙港: "330000",
  合肥: "340000", 芜湖: "340000", 蚌埠: "340000", 淮南: "340000",
  马鞍山: "340000", 淮北: "340000", 铜陵: "340000", 安庆: "340000",
  黄山: "340000", 滁州: "340000", 阜阳: "340000", 宿州: "340000",
  六安: "340000", 亳州: "340000", 池州: "340000", 宣城: "340000",
  福州: "350000", 厦门: "350000", 莆田: "350000", 三明: "350000",
  泉州: "350000", 漳州: "350000", 南平: "350000", 龙岩: "350000",
  宁德: "350000",
  南昌: "360000", 景德镇: "360000", 萍乡: "360000", 九江: "360000",
  新余: "360000", 鹰潭: "360000", 赣州: "360000", 吉安: "360000",
  宜春: "360000", 抚州: "360000", 上饶: "360000",
  济南: "370000", 青岛: "370000", 淄博: "370000", 枣庄: "370000",
  东营: "370000", 烟台: "370000", 潍坊: "370000", 济宁: "370000",
  泰安: "370000", 威海: "370000", 日照: "370000", 临沂: "370000",
  德州: "370000", 聊城: "370000", 滨州: "370000", 菏泽: "370000",
  莱芜: "370000",
  郑州: "410000", 开封: "410000", 洛阳: "410000", 平顶山: "410000",
  安阳: "410000", 鹤壁: "410000", 新乡: "410000", 焦作: "410000",
  濮阳: "410000", 许昌: "410000", 漯河: "410000", 三门峡: "410000",
  南阳: "410000", 商丘: "410000", 信阳: "410000", 周口: "410000",
  驻马店: "410000",
  武汉: "420000", 黄石: "420000", 十堰: "420000", 宜昌: "420000",
  襄阳: "420000", 鄂州: "420000", 荆门: "420000", 孝感: "420000",
  荆州: "420000", 黄冈: "420000", 咸宁: "420000", 随州: "420000",
  恩施土家族苗族自治州: "420000",
  长沙: "430000", 株洲: "430000", 湘潭: "430000", 衡阳: "430000",
  邵阳: "430000", 岳阳: "430000", 常德: "430000", 张家界: "430000",
  益阳: "430000", 郴州: "430000", 永州: "430000", 怀化: "430000",
  娄底: "430000", 湘西土家族苗族自治州: "430000",
  广州: "440000", 韶关: "440000", 深圳: "440000", 珠海: "440000",
  汕头: "440000", 佛山: "440000", 江门: "440000", 湛江: "440000",
  茂名: "440000", 肇庆: "440000", 惠州: "440000", 梅州: "440000",
  汕尾: "440000", 河源: "440000", 阳江: "440000", 清远: "440000",
  东莞: "440000", 中山: "440000", 潮州: "440000", 揭阳: "440000",
  云浮: "440000",
  南宁: "450000", 柳州: "450000", 桂林: "450000", 梧州: "450000",
  北海: "450000", 防城港: "450000", 钦州: "450000", 贵港: "450000",
  玉林: "450000", 百色: "450000", 贺州: "450000", 河池: "450000",
  来宾: "450000", 崇左: "450000",
  海口: "460000", 三亚: "460000", 三沙: "460000", 儋州: "460000",
  成都: "510000", 自贡: "510000", 攀枝花: "510000", 泸州: "510000",
  德阳: "510000", 绵阳: "510000", 广元: "510000", 遂宁: "510000",
  内江: "510000", 乐山: "510000", 南充: "510000", 眉山: "510000",
  宜宾: "510000", 广安: "510000", 达州: "510000", 雅安: "510000",
  巴中: "510000", 资阳: "510000",
  甘孜藏族自治州: "510000", 阿坝藏族羌族自治州: "510000", 凉山彝族自治州: "510000",
  贵阳: "520000", 六盘水: "520000", 遵义: "520000", 安顺: "520000",
  毕节: "520000", 铜仁: "520000",
  黔西南布依族苗族自治州: "520000", 黔东南苗族侗族自治州: "520000", 黔南布依族苗族自治州: "520000",
  昆明: "530000", 曲靖: "530000", 玉溪: "530000", 保山: "530000",
  昭通: "530000", 丽江: "530000", 普洱: "530000", 临沧: "530000",
  楚雄彝族自治州: "530000", 红河哈尼族彝族自治州: "530000",
  文山壮族苗族自治州: "530000", 西双版纳傣族自治州: "530000",
  大理白族自治州: "530000", 德宏傣族景颇族自治州: "530000",
  怒江傈僳族自治州: "530000", 迪庆藏族自治州: "530000",
  拉萨: "540000", 日喀则: "540000", 昌都: "540000", 林芝: "540000",
  山南: "540000", 那曲: "540000", 阿里: "540000",
  西安: "610000", 铜川: "610000", 宝鸡: "610000", 咸阳: "610000",
  渭南: "610000", 延安: "610000", 汉中: "610000", 榆林: "610000",
  安康: "610000", 商洛: "610000",
  兰州: "620000", 嘉峪关: "620000", 金昌: "620000", 白银: "620000",
  天水: "620000", 武威: "620000", 张掖: "620000", 平凉: "620000",
  酒泉: "620000", 庆阳: "620000", 定西: "620000", 陇南: "620000",
  甘南藏族自治州: "620000", 临夏回族自治州: "620000",
  西宁: "630000", 海东: "630000",
  海北藏族自治州: "630000", 黄南藏族自治州: "630000",
  海西蒙古族藏族自治州: "630000",
  果洛藏族自治州: "630000", 玉树藏族自治州: "630000",
  银川: "640000", 石嘴山: "640000", 吴忠: "640000", 固原: "640000",
  中卫: "640000",
  乌鲁木齐: "650000", 克拉玛依: "650000", 吐鲁番: "650000", 哈密: "650000",
  昌吉回族自治州: "650000", 巴音郭楞蒙古自治州: "650000",
  阿克苏: "650000", 喀什: "650000", 和田: "650000",
  塔城: "650000", 阿勒泰: "650000",
};

// 自治县→省份映射
const COUNTY_TO_PROVINCE: Record<string, string> = {
  大厂回族自治县: "130000", 孟村回族自治县: "130000",
  青龙满族自治县: "130000", 围场满族蒙古族自治县: "130000", 宽城满族自治县: "130000",
  喀喇沁左翼蒙古族自治县: "210000", 阜新蒙古族自治县: "210000",
  新宾满族自治县: "210000", 清原满族自治县: "210000",
  本溪满族自治县: "210000", 桓仁满族自治县: "210000",
  宽甸满族自治县: "210000",
  长白朝鲜族自治县: "220000",
  景宁畲族自治县: "330000",
  城步苗族自治县: "430000", 江华瑶族自治县: "430000",
  新晃侗族自治县: "430000", 芷江侗族自治县: "430000",
  靖州苗族侗族自治县: "430000", 麻阳苗族自治县: "430000",
  长阳土家族自治县: "420000",
  连南瑶族自治县: "440000", 连山壮族瑶族自治县: "440000",
  龙胜各族自治县: "450000", 恭城瑶族自治县: "450000",
  富川瑶族自治县: "450000", 金秀瑶族自治县: "450000",
  隆林各族自治县: "450000", 融水苗族自治县: "450000",
  白沙黎族自治县: "460000", 昌江黎族自治县: "460000",
  陵水黎族自治县: "460000", 琼中黎族苗族自治县: "460000",
  峨边彝族自治县: "510000", 马边彝族自治县: "510000",
  木里藏族自治县: "510000",
  道真仡佬族苗族自治县: "520000", 沿河土家族自治县: "520000",
  松桃苗族自治县: "520000", 玉屏侗族自治县: "520000",
  镇宁布依族苗族自治县: "520000", 威宁彝族回族苗族自治县: "520000",
  大通回族土族自治县: "630000", 循化撒拉族自治县: "630000",
  民和回族土族自治县: "630000", 门源回族自治县: "630000",
  焉耆回族自治县: "650000", 和布克赛尔蒙古自治县: "650000",
  塔什库尔干塔吉克自治县: "650000", 巴里坤哈萨克自治县: "650000",
  木垒哈萨克自治县: "650000",
  石柱土家族自治县: "500000", 秀山土家族苗族自治县: "500000",
  酉阳土家族苗族自治县: "500000", 彭水苗族土家族自治县: "500000",
};

function normalizeRegion(raw: string): { normalized: string; provinceCode: string } | null {
  if (!raw) return null;
  if (raw === '全国') return { normalized: '全国', provinceCode: '000000' };
  const trimmed = raw.trim();

  // 1. 省份简称
  const prov = PROVINCES.find(p => p.shortName === trimmed);
  if (prov) return { normalized: prov.shortName, provinceCode: prov.code };

  // 2. 城市简称
  if (CITY_TO_PROVINCE[trimmed]) return { normalized: trimmed, provinceCode: CITY_TO_PROVINCE[trimmed] };

  // 3. 自治县
  if (COUNTY_TO_PROVINCE[trimmed]) return { normalized: trimmed, provinceCode: COUNTY_TO_PROVINCE[trimmed] };

  // 4. "X市城" → "X"
  if (trimmed.endsWith('市城')) {
    const city = trimmed.slice(0, -2);
    if (CITY_TO_PROVINCE[city]) return { normalized: city, provinceCode: CITY_TO_PROVINCE[city] };
  }

  // 5. "X城" → "X"
  if (trimmed.endsWith('城') && !trimmed.endsWith('市城')) {
    const city = trimmed.slice(0, -1);
    if (CITY_TO_PROVINCE[city]) return { normalized: city, provinceCode: CITY_TO_PROVINCE[city] };
  }

  // 6. "X市" → "X"
  if (trimmed.endsWith('市')) {
    const city = trimmed.slice(0, -1);
    if (CITY_TO_PROVINCE[city]) return { normalized: city, provinceCode: CITY_TO_PROVINCE[city] };
  }

  // 7. 前缀匹配城市
  for (const [city, code] of Object.entries(CITY_TO_PROVINCE)) {
    if (trimmed.startsWith(city)) return { normalized: city, provinceCode: code };
  }

  // 8. 前缀匹配省份
  const provMatch = PROVINCES.find(p => trimmed.startsWith(p.shortName));
  if (provMatch) return { normalized: provMatch.shortName, provinceCode: provMatch.code };

  return null;
}

const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;
const prisma = new PrismaClient();
const applyMode = process.argv.includes('--apply');

async function main() {
  console.log(`模式: ${applyMode ? '🔧 执行修复' : '📊 分析模式（加 --apply 执行修复）'}\n`);

  // 获取所有不同的 region 值及数量
  const regionStats = await prisma.$queryRawUnsafe<Array<{ region: string | null; cnt: bigint }>>(
    `SELECT region, COUNT(*) as cnt FROM Law GROUP BY region ORDER BY cnt DESC`
  );

  let matchedCount = 0;
  let unmatchedCount = 0;
  let alreadyCorrectCount = 0;
  const updates: Array<{ oldRegion: string; newRegion: string; count: number }> = [];
  const unmatched: Array<{ region: string; count: number }> = [];

  for (const row of regionStats) {
    if (!row.region) continue;
    const count = Number(row.cnt);
    const result = normalizeRegion(row.region);

    if (!result) {
      unmatchedCount += count;
      unmatched.push({ region: row.region, count });
    } else if (result.normalized !== row.region) {
      matchedCount += count;
      updates.push({ oldRegion: row.region, newRegion: result.normalized, count });
    } else {
      alreadyCorrectCount += count;
    }
  }

  console.log(`=== 分析结果 ===`);
  console.log(`已正确:    ${alreadyCorrectCount} 条`);
  console.log(`需修正:    ${matchedCount} 条 (${updates.length} 种不同值)`);
  console.log(`无法匹配:  ${unmatchedCount} 条 (${unmatched.length} 种不同值)`);

  // 展示需要修正的
  console.log(`\n=== 修正映射 ===`);
  for (const u of updates) {
    console.log(`  "${u.oldRegion}" → "${u.newRegion}" (${u.count} 条)`);
  }

  if (unmatched.length > 0) {
    console.log(`\n=== 无法匹配 ===`);
    for (const u of unmatched) {
      console.log(`  "${u.region}" (${u.count} 条)`);
    }
  }

  if (!applyMode) {
    console.log(`\n📊 分析完成。运行 --apply 执行修复。`);
    return;
  }

  // 执行修复 - 按旧值批量 UPDATE
  console.log(`\n🔧 开始修复 ${updates.length} 种区域值...`);
  for (const u of updates) {
    await prisma.$executeRawUnsafe(
      `UPDATE Law SET region = ? WHERE region = ?`,
      u.newRegion, u.oldRegion
    );
    console.log(`  ✓ "${u.oldRegion}" → "${u.newRegion}" (${u.count} 条)`);
  }

  // 验证
  const remaining = await prisma.$queryRawUnsafe<Array<{ region: string; cnt: bigint }>>(
    `SELECT region, COUNT(*) as cnt FROM Law GROUP BY region ORDER BY cnt DESC LIMIT 30`
  );
  console.log(`\n✅ 修复完成！当前区域分布 (Top 30):`);
  for (const r of remaining) {
    console.log(`  ${r.region}: ${Number(r.cnt)}`);
  }
}

main()
  .catch(e => { console.error('错误:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
