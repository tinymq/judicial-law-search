// ============================================
// 行业分类配置文件（司法部标准）
// 数据来源：司法部行政执法事项目录行业分类
// ============================================

/**
 * 行业分类列表（司法部标准 71 个一级行业）
 * code: 行业编码
 * name: 行业名称
 */
export const INDUSTRIES = [
  { code: "00", name: "人民政府" },
  { code: "01", name: "外交" },
  { code: "02", name: "国防" },
  { code: "03", name: "发展和改革" },
  { code: "04", name: "教育" },
  { code: "05", name: "科学技术" },
  { code: "06", name: "工业和信息化" },
  { code: "07", name: "民族事务" },
  { code: "08", name: "公安" },
  { code: "09", name: "国家安全" },
  { code: "10", name: "民政" },
  { code: "11", name: "司法" },
  { code: "12", name: "财政" },
  { code: "13", name: "人力资源和社会保障" },
  { code: "14", name: "自然资源" },
  { code: "15", name: "生态环境" },
  { code: "16", name: "住房和城乡建设" },
  { code: "17", name: "交通运输" },
  { code: "18", name: "水利" },
  { code: "19", name: "农业农村" },
  { code: "20", name: "商务" },
  { code: "21", name: "文化和旅游" },
  { code: "22", name: "卫生健康" },
  { code: "23", name: "退役军人事务" },
  { code: "24", name: "应急管理" },
  { code: "25", name: "审计" },
  { code: "26", name: "海关" },
  { code: "27", name: "税务" },
  { code: "28", name: "统计" },
  { code: "29", name: "体育" },
  { code: "30", name: "市场监督管理" },
  { code: "31", name: "粮食和物资储备" },
  { code: "32", name: "能源" },
  { code: "33", name: "烟草" },
  { code: "34", name: "林业和草原" },
  { code: "35", name: "铁路" },
  { code: "36", name: "民用航空" },
  { code: "37", name: "邮政" },
  { code: "38", name: "文物" },
  { code: "39", name: "药品监督管理" },
  { code: "40", name: "知识产权" },
  { code: "41", name: "密码管理" },
  { code: "42", name: "档案" },
  { code: "43", name: "金融" },
  { code: "44", name: "医疗保障" },
  { code: "45", name: "信访" },
  { code: "46", name: "广播电视" },
  { code: "47", name: "新闻出版" },
  { code: "48", name: "电影" },
  { code: "49", name: "城市管理" },
  { code: "50", name: "气象" },
  { code: "51", name: "地震" },
  { code: "52", name: "人民防空" },
  { code: "53", name: "消防救援" },
  { code: "54", name: "矿山安全" },
  { code: "55", name: "海事" },
  { code: "56", name: "移民管理" },
  { code: "57", name: "海警" },
  { code: "58", name: "国有资产监管" },
  { code: "59", name: "供销合作" },
  { code: "60", name: "机关事务管理" },
  { code: "61", name: "国家安全生产" },
  { code: "62", name: "国际发展合作" },
  { code: "63", name: "乡村振兴" },
  { code: "64", name: "疾病预防控制" },
  { code: "65", name: "数据管理" },
  { code: "99", name: "其他" },
] as const;

/**
 * 执法类别
 */
export const ENFORCEMENT_CATEGORIES = [
  "行政许可",
  "行政处罚",
  "行政强制",
  "行政检查",
  "行政裁决",
  "行政确认",
  "行政征收",
  "行政给付",
  "行政奖励",
  "行政调解",
  "其他执法事项",
] as const;

/**
 * 省份列表（含行政区划代码）
 */
export const PROVINCES = [
  { code: "110000", name: "北京市" },
  { code: "120000", name: "天津市" },
  { code: "130000", name: "河北省" },
  { code: "140000", name: "山西省" },
  { code: "150000", name: "内蒙古自治区" },
  { code: "210000", name: "辽宁省" },
  { code: "220000", name: "吉林省" },
  { code: "230000", name: "黑龙江省" },
  { code: "310000", name: "上海市" },
  { code: "320000", name: "江苏省" },
  { code: "330000", name: "浙江省" },
  { code: "340000", name: "安徽省" },
  { code: "350000", name: "福建省" },
  { code: "360000", name: "江西省" },
  { code: "370000", name: "山东省" },
  { code: "410000", name: "河南省" },
  { code: "420000", name: "湖北省" },
  { code: "430000", name: "湖南省" },
  { code: "440000", name: "广东省" },
  { code: "450000", name: "广西壮族自治区" },
  { code: "460000", name: "海南省" },
  { code: "500000", name: "重庆市" },
  { code: "510000", name: "四川省" },
  { code: "520000", name: "贵州省" },
  { code: "530000", name: "云南省" },
  { code: "540000", name: "西藏自治区" },
  { code: "610000", name: "陕西省" },
  { code: "620000", name: "甘肃省" },
  { code: "630000", name: "青海省" },
  { code: "640000", name: "宁夏回族自治区" },
  { code: "650000", name: "新疆维吾尔自治区" },
] as const;

// 导出类型
export type IndustryCode = typeof INDUSTRIES[number]["code"];
export type IndustryName = typeof INDUSTRIES[number]["name"];
export type EnforcementCategory = typeof ENFORCEMENT_CATEGORIES[number];
export type ProvinceCode = typeof PROVINCES[number]["code"];
export type ProvinceName = typeof PROVINCES[number]["name"];
