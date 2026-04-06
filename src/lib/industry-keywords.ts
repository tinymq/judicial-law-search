/**
 * 行业分类关键词映射
 * 用于自动将法规分配到司法部71个行业分类
 *
 * 匹配优先级：
 * 1. 制定机关名称直接映射（最高置信度）
 * 2. 标题关键词匹配
 * 3. 序言/正文关键词匹配（较低置信度）
 */

type IndustryKeywords = {
  code: string;
  name: string;
  /** 制定机关名称关键词（精确匹配） */
  authorities: string[];
  /** 标题关键词（匹配法规标题） */
  titleKeywords: string[];
};

/**
 * 行业分类关键词配置
 * code 对应 industry-config.ts 中的行业编码
 */
export const INDUSTRY_KEYWORDS: IndustryKeywords[] = [
  {
    code: "00", name: "人民政府",
    authorities: ["国务院", "人民政府"],
    titleKeywords: ["人民政府", "国务院", "行政区划", "地方组织"],
  },
  {
    code: "01", name: "外交",
    authorities: ["外交部"],
    titleKeywords: ["外交", "领事", "使馆", "条约", "缔约"],
  },
  {
    code: "02", name: "国防",
    authorities: ["国防部", "中央军委"],
    titleKeywords: ["国防", "军事", "兵役", "民兵", "军人", "军队", "武装"],
  },
  {
    code: "03", name: "发展和改革",
    authorities: ["发展和改革委员会", "发改委"],
    titleKeywords: ["发展规划", "价格", "收费", "物价", "招标投标", "节能", "循环经济", "清洁生产", "能源"],
  },
  {
    code: "04", name: "教育",
    authorities: ["教育部", "教育厅", "教育局"],
    titleKeywords: ["教育", "学校", "教师", "义务教育", "高等教育", "职业教育", "学位", "学前教育", "民办教育"],
  },
  {
    code: "05", name: "科学技术",
    authorities: ["科学技术部", "科技厅"],
    titleKeywords: ["科学技术", "科技进步", "科技成果", "科普"],
  },
  {
    code: "06", name: "工业和信息化",
    authorities: ["工业和信息化部", "工信部", "工信厅"],
    titleKeywords: ["工业", "信息化", "电信", "通信", "无线电", "电磁", "互联网", "网络安全", "数据安全", "电子签名", "无障碍"],
  },
  {
    code: "07", name: "民族事务",
    authorities: ["民族事务委员会"],
    titleKeywords: ["民族", "少数民族", "民族区域自治"],
  },
  {
    code: "08", name: "公安",
    authorities: ["公安部", "公安厅", "公安局"],
    titleKeywords: ["公安", "治安", "出入境", "户籍", "身份证", "居住证", "枪支", "爆炸物", "危险化学品", "消防", "道路交通", "交通安全", "机动车", "驾驶"],
  },
  {
    code: "09", name: "国家安全",
    authorities: ["国家安全部"],
    titleKeywords: ["国家安全", "反间谍", "反恐", "保密"],
  },
  {
    code: "10", name: "民政",
    authorities: ["民政部", "民政厅", "民政局"],
    titleKeywords: ["民政", "社会团体", "基金会", "社会组织", "社会救助", "殡葬", "婚姻", "收养", "地名", "行政区域", "社区", "村民", "居民", "社会福利", "慈善", "养老", "未成年人保护", "老年人"],
  },
  {
    code: "11", name: "司法",
    authorities: ["司法部", "司法厅", "司法局"],
    titleKeywords: ["司法", "律师", "公证", "仲裁", "调解", "法律援助", "法律服务", "司法鉴定", "监狱", "社区矫正", "法治", "行政复议", "行政诉讼", "法规规章备案", "行政执法"],
  },
  {
    code: "12", name: "财政",
    authorities: ["财政部", "财政厅"],
    titleKeywords: ["财政", "预算", "政府采购", "国有资产", "会计", "审计", "税收", "国库"],
  },
  {
    code: "13", name: "人力资源和社会保障",
    authorities: ["人力资源和社会保障部", "人社厅", "人社局"],
    titleKeywords: ["劳动", "就业", "人力资源", "社会保险", "工伤", "劳动合同", "工资", "社会保障", "职业技能", "职业资格"],
  },
  {
    code: "14", name: "自然资源",
    authorities: ["自然资源部", "自然资源厅", "国土资源"],
    titleKeywords: ["自然资源", "土地", "矿产", "国土", "测绘", "地质", "不动产", "海域", "海岛"],
  },
  {
    code: "15", name: "生态环境",
    authorities: ["生态环境部", "环境保护", "生态环境厅"],
    titleKeywords: ["环境保护", "生态环境", "污染", "环境影响", "排污", "环保", "噪声", "水污染", "大气污染", "土壤污染", "固体废物", "危险废物", "放射性", "核"],
  },
  {
    code: "16", name: "住房和城乡建设",
    authorities: ["住房和城乡建设部", "住建厅", "住建局", "建设厅"],
    titleKeywords: ["建筑", "建设工程", "城乡规划", "城市规划", "住房", "房地产", "物业", "城市管理", "城镇", "市容", "环境卫生", "园林", "绿化", "城市道路", "城市供水", "燃气", "供热", "排水", "污水", "垃圾"],
  },
  {
    code: "17", name: "交通运输",
    authorities: ["交通运输部", "交通厅", "交通局"],
    titleKeywords: ["交通运输", "公路", "道路运输", "水路", "港口", "航道", "船舶", "海上交通", "出租汽车", "公共汽车", "城市公共交通", "客运", "货运"],
  },
  {
    code: "18", name: "水利",
    authorities: ["水利部", "水利厅", "水务局"],
    titleKeywords: ["水利", "水法", "防洪", "水土保持", "河道", "水库", "灌区", "引水", "水资源", "节约用水", "抗旱"],
  },
  {
    code: "19", name: "农业农村",
    authorities: ["农业农村部", "农业厅", "农业局", "畜牧"],
    titleKeywords: ["农业", "农村", "农民", "种子", "农药", "化肥", "农产品", "畜牧", "兽医", "动物防疫", "渔业", "农机", "农田", "耕地", "粮食", "蔬菜", "植物", "乡村振兴"],
  },
  {
    code: "20", name: "商务",
    authorities: ["商务部", "商务厅"],
    titleKeywords: ["商务", "外贸", "进出口", "对外贸易", "外商投资", "自由贸易", "电子商务", "拍卖", "典当", "报废汽车"],
  },
  {
    code: "21", name: "文化和旅游",
    authorities: ["文化和旅游部", "文化厅", "旅游局"],
    titleKeywords: ["文化", "旅游", "文物", "非物质文化遗产", "文化遗产", "古建筑", "图书馆", "博物馆", "文化市场", "娱乐", "演出", "导游", "景区"],
  },
  {
    code: "22", name: "卫生健康",
    authorities: ["卫生健康委", "卫计委", "卫生厅"],
    titleKeywords: ["卫生", "医疗", "医院", "医师", "护士", "传染病", "疫苗", "药品", "献血", "母婴", "计划生育", "精神卫生", "职业病", "食品安全"],
  },
  {
    code: "23", name: "退役军人事务",
    authorities: ["退役军人事务部"],
    titleKeywords: ["退役军人", "退伍", "复员"],
  },
  {
    code: "24", name: "应急管理",
    authorities: ["应急管理部", "应急管理厅"],
    titleKeywords: ["应急", "安全生产", "危险化学品", "烟花爆竹", "矿山", "消防", "防灾", "减灾", "救灾", "地震"],
  },
  {
    code: "25", name: "审计",
    authorities: ["审计署", "审计厅"],
    titleKeywords: ["审计"],
  },
  {
    code: "26", name: "海关",
    authorities: ["海关总署", "海关"],
    titleKeywords: ["海关", "进出境", "检验检疫", "关税"],
  },
  {
    code: "27", name: "税务",
    authorities: ["税务总局", "税务局"],
    titleKeywords: ["税务", "税收", "增值税", "所得税", "个人所得税", "企业所得税", "印花税", "契税", "发票"],
  },
  {
    code: "28", name: "统计",
    authorities: ["统计局"],
    titleKeywords: ["统计"],
  },
  {
    code: "29", name: "体育",
    authorities: ["体育总局"],
    titleKeywords: ["体育", "全民健身", "奥林匹克"],
  },
  {
    code: "30", name: "市场监督管理",
    authorities: ["市场监督管理", "市场监管", "工商行政"],
    titleKeywords: ["市场监管", "市场监督", "工商", "营业执照", "市场主体", "登记注册", "特种设备", "电梯", "锅炉", "计量", "标准化", "认证", "检验", "检测", "质量", "产品质量", "反垄断", "竞争", "商标", "专利", "知识产权", "消费者", "广告", "直销", "传销", "食品", "网络交易"],
  },
  {
    code: "31", name: "粮食和物资储备",
    authorities: ["粮食和物资储备局"],
    titleKeywords: ["粮食", "储备"],
  },
  {
    code: "32", name: "能源",
    authorities: ["能源局"],
    titleKeywords: ["能源", "电力", "煤炭", "石油", "天然气", "可再生能源"],
  },
  {
    code: "33", name: "烟草",
    authorities: ["烟草局"],
    titleKeywords: ["烟草", "卷烟"],
  },
  {
    code: "34", name: "林业和草原",
    authorities: ["林业和草原局", "林业厅"],
    titleKeywords: ["森林", "林业", "草原", "湿地", "野生动物", "自然保护区", "国家公园", "陆生野生"],
  },
  {
    code: "35", name: "铁路",
    authorities: ["铁路局"],
    titleKeywords: ["铁路"],
  },
  {
    code: "36", name: "民用航空",
    authorities: ["民用航空局", "民航局"],
    titleKeywords: ["民用航空", "航空", "机场", "飞行"],
  },
  {
    code: "37", name: "邮政",
    authorities: ["邮政局"],
    titleKeywords: ["邮政", "快递"],
  },
  {
    code: "38", name: "文物",
    authorities: ["文物局"],
    titleKeywords: ["文物", "考古", "古建筑"],
  },
  {
    code: "39", name: "药品监督管理",
    authorities: ["药品监督管理局", "药监局"],
    titleKeywords: ["药品", "医疗器械", "化妆品"],
  },
  {
    code: "40", name: "知识产权",
    authorities: ["知识产权局"],
    titleKeywords: ["知识产权", "专利", "商标", "著作权", "版权"],
  },
  {
    code: "41", name: "密码管理",
    authorities: ["密码管理局"],
    titleKeywords: ["密码"],
  },
  {
    code: "42", name: "档案",
    authorities: ["档案局"],
    titleKeywords: ["档案"],
  },
  {
    code: "43", name: "金融",
    authorities: ["金融监管", "银保监", "证监"],
    titleKeywords: ["金融", "银行", "保险", "证券", "基金", "信托", "期货"],
  },
  {
    code: "44", name: "医疗保障",
    authorities: ["医疗保障局"],
    titleKeywords: ["医疗保障", "医保", "医疗保险"],
  },
  {
    code: "45", name: "信访",
    authorities: ["信访局"],
    titleKeywords: ["信访"],
  },
  {
    code: "46", name: "广播电视",
    authorities: ["广播电视"],
    titleKeywords: ["广播", "电视"],
  },
  {
    code: "47", name: "新闻出版",
    authorities: ["新闻出版"],
    titleKeywords: ["新闻出版", "出版"],
  },
  {
    code: "48", name: "电影",
    authorities: ["电影局"],
    titleKeywords: ["电影"],
  },
  {
    code: "49", name: "城市管理",
    authorities: ["城市管理", "城管"],
    titleKeywords: ["城市管理", "城管", "市容", "环境卫生"],
  },
  {
    code: "50", name: "气象",
    authorities: ["气象局"],
    titleKeywords: ["气象"],
  },
  {
    code: "51", name: "地震",
    authorities: ["地震局"],
    titleKeywords: ["地震", "防震减灾"],
  },
  {
    code: "52", name: "人民防空",
    authorities: ["人民防空"],
    titleKeywords: ["人民防空", "防空", "人防"],
  },
  {
    code: "53", name: "消防救援",
    authorities: ["消防救援"],
    titleKeywords: ["消防"],
  },
  {
    code: "54", name: "矿山安全",
    authorities: ["矿山安全"],
    titleKeywords: ["矿山", "煤矿", "矿产"],
  },
  {
    code: "55", name: "海事",
    authorities: ["海事局"],
    titleKeywords: ["海事", "海上交通", "船舶"],
  },
  {
    code: "56", name: "移民管理",
    authorities: ["移民管理局"],
    titleKeywords: ["出入境", "外国人", "移民"],
  },
  {
    code: "57", name: "海警",
    authorities: ["海警"],
    titleKeywords: ["海警"],
  },
  {
    code: "58", name: "国有资产监管",
    authorities: ["国有资产监督"],
    titleKeywords: ["国有资产", "国企"],
  },
  {
    code: "59", name: "供销合作",
    authorities: ["供销合作"],
    titleKeywords: ["供销"],
  },
  {
    code: "60", name: "机关事务管理",
    authorities: ["机关事务"],
    titleKeywords: ["机关事务", "公务"],
  },
  {
    code: "61", name: "国家安全生产",
    authorities: [],
    titleKeywords: ["安全生产"],
  },
  {
    code: "63", name: "乡村振兴",
    authorities: ["乡村振兴"],
    titleKeywords: ["乡村振兴", "扶贫"],
  },
  {
    code: "64", name: "疾病预防控制",
    authorities: ["疾控"],
    titleKeywords: ["疾病预防", "传染病", "疫情"],
  },
  {
    code: "65", name: "数据管理",
    authorities: ["数据局"],
    titleKeywords: ["数据", "大数据", "数字经济"],
  },
];

/**
 * 根据法规标题和制定机关匹配行业
 * @returns 匹配到的行业 code 列表（按置信度排序，最多3个）
 */
export function matchIndustries(
  title: string,
  issuingAuthority?: string | null
): Array<{ code: string; name: string; isPrimary: boolean }> {
  const matches: Array<{ code: string; name: string; score: number }> = [];

  for (const ind of INDUSTRY_KEYWORDS) {
    let score = 0;

    // 1. 制定机关匹配（高置信度）
    if (issuingAuthority) {
      for (const auth of ind.authorities) {
        if (issuingAuthority.includes(auth)) {
          score += 10;
          break;
        }
      }
    }

    // 2. 标题关键词匹配
    for (const kw of ind.titleKeywords) {
      if (title.includes(kw)) {
        score += 3;
      }
    }

    if (score > 0) {
      matches.push({ code: ind.code, name: ind.name, score });
    }
  }

  // 按分数降序
  matches.sort((a, b) => b.score - a.score);

  // 取前3个，标记主分类
  const result = matches.slice(0, 3).map((m, i) => ({
    code: m.code,
    name: m.name,
    isPrimary: i === 0,
  }));

  // 如果没有匹配到任何行业，归入"其他"
  if (result.length === 0) {
    result.push({ code: "99", name: "其他", isPrimary: true });
  }

  return result;
}
