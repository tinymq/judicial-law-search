/**
 * /smart 路由静态样本数据（M0 阶段）
 *
 * 源：MoSyncEcho/judicial-law-search/src/data.jsx
 * 查询场景："超市购物买的过期食品"
 *
 * M1 阶段将替换为真实 Prisma 数据（mindmap.law → prisma.law / HOT_TAGS → prisma.industry）；
 * M3 阶段引入 ViolationTag + CaseCitation schema 后，violation/case 分支接真数据
 */

export type HotTag = { label: string; cat: string; count: number };

export type MindNode = {
  id: string;
  label: string;
  weight: number;
  cases: number;
  hot?: boolean;
};

export type MindBranchId = 'violation' | 'law' | 'case';

export type MindBranch = {
  id: MindBranchId;
  name: string;
  color: string;
  angleStart: number;
  angleEnd: number;
  nodes: MindNode[];
};

export type MindmapData = {
  center: { label: string; meta: string };
  branches: MindBranch[];
};

export type HistoryEntry = {
  q: string;
  t: string;
  hits: number;
  active?: boolean;
};

export type Severity = '高' | '中' | '低';

export type ViolationEntry = {
  id: string;
  name: string;
  laws: number;
  severity: Severity;
  industry: string;
  active?: boolean;
};

export type ArticleItem = {
  no: string;
  title: string;
  hit?: boolean;
  keyword: string[];
  items: string[];
};

export type Section = { id: string; name: string; articles: ArticleItem[] };
export type Chapter = { id: string; name: string; sections: Section[] };
export type RelatedViolation = { name: string; cases: number };
export type Citation = { name: string; note: string };

export type LawDetail = {
  id: number;
  title: string;
  level: string;
  status: string;
  authority: string;
  docNumber: string;
  promulgated: string;
  effective: string;
  revised: string;
  chapters: Chapter[];
  related: RelatedViolation[];
  cites: Citation[];
};

export const SAMPLE_QUERY = '超市购物买的过期食品';

export const HOT_TAGS: HotTag[] = [
  { label: '销售过期食品', cat: '食品安全', count: 142 },
  { label: '虚假宣传', cat: '广告监管', count: 98 },
  { label: '价格欺诈', cat: '消费者权益', count: 87 },
  { label: '三无产品', cat: '产品质量', count: 74 },
  { label: '无照经营', cat: '市场监督', count: 66 },
  { label: '未明码标价', cat: '价格监督', count: 52 },
];

export const MINDMAP: MindmapData = {
  center: { label: '过期食品 · 超市销售', meta: '3 类 · 11 节点' },
  branches: [
    {
      id: 'violation',
      name: '违法行为',
      color: '#c8302b',
      angleStart: -150,
      angleEnd: -30,
      nodes: [
        { id: 'v1', label: '销售超过保质期食品', weight: 87, cases: 142 },
        { id: 'v2', label: '经营标签不符合规定的食品', weight: 54, cases: 86 },
        { id: 'v3', label: '未尽查验义务', weight: 41, cases: 63 },
        { id: 'v4', label: '未及时下架过期食品', weight: 38, cases: 51 },
      ],
    },
    {
      id: 'law',
      name: '法律法规',
      color: '#b57d28',
      angleStart: -15,
      angleEnd: 105,
      nodes: [
        { id: 'l1', label: '食品安全法 §34', weight: 96, cases: 210, hot: true },
        { id: 'l2', label: '食品安全法 §54', weight: 78, cases: 134 },
        { id: 'l3', label: '消费者权益保护法 §55', weight: 65, cases: 98 },
        { id: 'l4', label: '产品质量法 §27', weight: 42, cases: 57 },
      ],
    },
    {
      id: 'case',
      name: '类案',
      color: '#4a7a55',
      angleStart: 120,
      angleEnd: 210,
      nodes: [
        { id: 'c1', label: '(2024) 苏 02 行终 118 号', weight: 32, cases: 1 },
        { id: 'c2', label: '(2023) 沪 0106 行初 089 号', weight: 28, cases: 1 },
        { id: 'c3', label: '市监处字〔2024〕037 号', weight: 24, cases: 1 },
      ],
    },
  ],
};

export const HISTORY: HistoryEntry[] = [
  { q: '超市购物买的过期食品', t: '2026-04-21 14:22', hits: 18, active: true },
  { q: '网络订餐食品安全责任', t: '2026-04-21 11:07', hits: 12 },
  { q: '商场电梯事故赔偿', t: '2026-04-20 17:45', hits: 9 },
  { q: '预付卡跑路怎么办', t: '2026-04-20 09:31', hits: 15 },
  { q: '广告虚假宣传处罚', t: '2026-04-19 16:12', hits: 23 },
  { q: '无照经营查处程序', t: '2026-04-19 10:48', hits: 7 },
  { q: '电商平台价格欺诈', t: '2026-04-18 15:02', hits: 11 },
  { q: '进口食品中文标签要求', t: '2026-04-17 14:20', hits: 8 },
];

export const VIOLATIONS: ViolationEntry[] = [
  { id: 'v1', name: '销售超过保质期食品', laws: 7, severity: '高', industry: '食品安全', active: true },
  { id: 'v2', name: '经营标签不符合规定的食品', laws: 5, severity: '中', industry: '食品安全' },
  { id: 'v3', name: '未履行进货查验义务', laws: 4, severity: '中', industry: '食品安全' },
  { id: 'v4', name: '未及时下架超过保质期食品', laws: 3, severity: '中', industry: '食品安全' },
  { id: 'v5', name: '销售无标签预包装食品', laws: 4, severity: '高', industry: '食品安全' },
  { id: 'v6', name: '经营腐败变质食品', laws: 6, severity: '高', industry: '食品安全' },
  { id: 'v7', name: '使用过期原料加工食品', laws: 5, severity: '高', industry: '食品生产' },
  { id: 'v8', name: '销售病死动物制品', laws: 6, severity: '高', industry: '食品安全' },
];

export const LAW_DETAIL: LawDetail = {
  id: 1284,
  title: '中华人民共和国食品安全法',
  level: '法律',
  status: '现行有效',
  authority: '全国人民代表大会常务委员会',
  docNumber: '主席令第二十一号',
  promulgated: '2015/04/24',
  effective: '2015/10/01',
  revised: '2021/04/29 第二次修正',
  chapters: [
    {
      id: 'ch4',
      name: '第四章 食品生产经营',
      sections: [
        {
          id: 's1',
          name: '第一节 一般规定',
          articles: [
            {
              no: '第三十四条',
              title: '禁止生产经营的食品',
              hit: true,
              keyword: ['过期', '超过保质期', '腐败变质'],
              items: [
                '（一）用非食品原料生产的食品或者添加食品添加剂以外的化学物质和其他可能危害人体健康物质的食品，以及用回收食品作为原料生产的食品；',
                '（二）致病性微生物，农药残留、兽药残留、生物毒素、重金属等污染物质以及其他危害人体健康的物质含量超过食品安全标准限量的食品、食品添加剂、食品相关产品；',
                '（十）标注虚假生产日期、保质期或者超过保质期的食品、食品添加剂；',
              ],
            },
            {
              no: '第五十四条',
              title: '贮存、运输食品的要求',
              hit: true,
              keyword: ['保质期', '过期'],
              items: [
                '食品经营者应当按照保证食品安全的要求贮存食品，定期检查库存食品，及时清理变质或者超过保质期的食品。',
                '食品经营者贮存散装食品，应当在贮存位置标明食品的名称、生产日期或者生产批号、保质期、生产者名称及联系方式等内容。',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'ch9',
      name: '第九章 法律责任',
      sections: [
        {
          id: 's2',
          name: '',
          articles: [
            {
              no: '第一百二十四条',
              title: '生产经营禁止食品的处罚',
              hit: true,
              keyword: ['过期', '超过保质期'],
              items: [
                '违反本法规定，有下列情形之一的，由县级以上人民政府食品安全监督管理部门没收违法所得和违法生产经营的食品、食品添加剂，并可以没收用于违法生产经营的工具、设备、原料等物品；',
                '违法生产经营的食品、食品添加剂货值金额不足一万元的，并处十万元以上十五万元以下罚款；货值金额一万元以上的，并处货值金额十五倍以上三十倍以下罚款；情节严重的，吊销许可证：',
                '（五）生产经营超过保质期的食品、食品添加剂；',
              ],
            },
          ],
        },
      ],
    },
  ],
  related: [
    { name: '销售超过保质期食品', cases: 142 },
    { name: '未及时下架超过保质期食品', cases: 51 },
    { name: '经营标签不符合规定的食品', cases: 86 },
    { name: '未履行进货查验义务', cases: 63 },
  ],
  cites: [
    { name: '消费者权益保护法 §55', note: '十倍赔偿条款' },
    { name: '产品质量法 §27', note: '标签标识' },
    { name: '行政处罚法 §28', note: '处罚种类与幅度' },
  ],
};
