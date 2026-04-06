'use client';

import { useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

const C = {
  primary: '#1a365d', secondary: '#2b6cb0', accent: '#3182ce',
  light: '#ebf8ff', lightBorder: '#bee3f8',
  green: '#276749', greenLight: '#f0fff4', greenBorder: '#9ae6b4',
  orange: '#c05621', orangeLight: '#fffaf0', orangeBorder: '#fbd38d',
  purple: '#553c9a', purpleLight: '#faf5ff', purpleBorder: '#d6bcfa',
  gray: '#4a5568', red: '#c53030', redLight: '#fff5f5',
};

const tabNames = ['服务全景', '流程详解', '目录结构', '编码规则', '核心要点'];

function Badge({ bg, color, children }: { bg?: string; color?: string; children: React.ReactNode }) {
  return (
    <span style={{ background: bg || '#ebf8ff', color: color || '#3182ce', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function Card({ bg, bc, title, children }: { bg?: string; bc?: string; title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: bg || '#fff', border: `1px solid ${bc || '#bee3f8'}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16, borderLeft: `4px solid ${bc || '#bee3f8'}` }}>
      {title && <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{title}</div>}
      {children}
    </div>
  );
}

function Arrow() {
  return <div style={{ textAlign: 'center', fontSize: 24, color: C.accent, margin: '4px 0' }}>{'\u25BC'}</div>;
}

function FlowStep({ num, title, desc, color, bg }: { num: string; title: string; desc: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: 16, flex: 1, minWidth: 0, border: `1px solid ${color}22` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ background: color, color: '#fff', width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{num}</div>
        <div style={{ fontWeight: 700, fontSize: 14, color }}>{title}</div>
      </div>
      <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

function Overview() {
  const stats = [
    { l: '覆盖领域', v: '数十个执法领域' }, { l: '覆盖城市', v: '13个设区市' },
    { l: '事项规模', v: '数千项' }, { l: '覆盖率', v: '80%' },
  ];
  const steps = [
    { n: '1', t: '资料归集', d: '法律法规+权力清单+三定方案', c: C.secondary, bg: C.light },
    { n: '2', t: 'AI智能梳理', d: '事项识别+要素补全+去重筛查', c: C.green, bg: C.greenLight },
    { n: '3', t: '标准化处理', d: '统一编码+命名规范+格式统一', c: C.orange, bg: C.orangeLight },
    { n: '4', t: '合规校验', d: '合法性+规范性+合理性三维校验', c: C.purple, bg: C.purpleLight },
    { n: '5', t: '数据交付', d: 'Excel/JSON格式，可直接导入系统', c: C.red, bg: C.redLight },
  ];
  return (
    <div>
      <div style={{ background: 'linear-gradient(135deg,#1a365d,#2b6cb0)', borderRadius: 16, padding: 24, color: '#fff', marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>行政检查事项AI智能梳理服务</div>
        <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.8 }}>
          以江苏省司法厅为服务对象，利用AI技术对全省数千部法律法规进行解析，自动识别并梳理行政检查事项，输出覆盖全省80%检查场景的标准化事项清单基础版。
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{s.v}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 12 }}>服务全流程一览</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <FlowStep num={s.n} title={s.t} desc={s.d} color={s.c} bg={s.bg} />
            {i < 4 && <div style={{ display: 'flex', alignItems: 'center', fontSize: 18, color: '#cbd5e0', padding: '0 2px' }}>{'\u203A'}</div>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="核心价值" bc={C.greenBorder}>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.8 }}>
            为全省行政执法标准化、规范化建设奠定核心数据基础，解决各部门事项名称不统一、依据不明确、编码不规范的问题。
          </div>
        </Card>
        <Card title="技术亮点" bc={C.orangeBorder}>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.8 }}>
            依托AI引擎+NLP技术，实现法律法规全量解析、事项智能识别、要素自动补全、重复事项语义筛查，大幅降低人工梳理成本。
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProcessDetail() {
  const phases = [
    { title: '阶段一：事项规划', color: C.secondary, bg: C.light, border: C.lightBorder, icon: '\uD83D\uDCD0',
      inputs: ['现行法律法规规章', '省/市权力清单', '三定方案及机构职责'],
      work: ['制定分类标准', '确定核心数据要素', '设计编码规则', '规划与执法系统的关联逻辑'],
      output: '事项清单分类标准与编码规则' },
    { title: '阶段二：AI智能梳理', color: C.green, bg: C.greenLight, border: C.greenBorder, icon: '\uD83E\uDD16',
      inputs: ['数千部法律法规规章', '现有权力清单'],
      work: ['全域事项智能识别：AI解析法条，自动识别行政检查条款', '核心要素智能补全：自动提取事项名称、实施主体、执法依据、检查对象等', '重复与冗余筛查：语义分析+相似度匹配，识别重复/交叉事项'],
      output: '初步事项候选清单（含标记的重复/冗余项）' },
    { title: '阶段三：数据标准化', color: C.orange, bg: C.orangeLight, border: C.orangeBorder, icon: '\uD83D\uDCCA',
      inputs: ['初步事项候选清单'],
      work: ['统一命名："检查对象+检查内容+行政检查"模式', '统一编码：18位全省唯一编码', '层级化编排：四级目录树体系', '生成清单编制说明'],
      output: '全省行政检查事项清单基础版（省级汇总版+分部门/分层级子版本）' },
    { title: '阶段四：合规校验', color: C.purple, bg: C.purpleLight, border: C.purpleBorder, icon: '\u2705',
      inputs: ['清单基础版'],
      work: ['合法性校验：依据是否现行有效、权限是否符合机构职责', '规范性校验：要素完整、编码唯一、命名规范', '合理性校验：事项是否必要、是否存在重复交叉', 'AI自动校验 + 专业团队人工复核'],
      output: '问题清单 + 优化建议 + 修订后的清单基础版' },
    { title: '阶段五：数据交付', color: C.red, bg: C.redLight, border: '#fed7d7', icon: '\uD83D\uDCE6',
      inputs: ['校验通过的清单基础版'],
      work: ['Excel格式交付', 'JSON格式交付', '确保可导入执法事项管理模块'],
      output: '可直接使用的标准化数据文件' },
  ];
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 16 }}>服务流程详解（五阶段）</div>
      {phases.map((p, i) => (
        <div key={i}>
          <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: 16, borderLeft: `5px solid ${p.color}` }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: p.color, marginBottom: 12 }}>{p.icon} {p.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 4 }}>输入</div>
                {p.inputs.map((x, j) => <div key={j} style={{ fontSize: 12, color: C.gray, padding: '2px 0' }}>{'\u2022'} {x}</div>)}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 4 }}>工作内容</div>
                {p.work.map((x, j) => <div key={j} style={{ fontSize: 12, color: C.gray, padding: '2px 0' }}>{'\u2022'} {x}</div>)}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 4 }}>输出</div>
                <div style={{ fontSize: 12, color: p.color, fontWeight: 600 }}>{p.output}</div>
              </div>
            </div>
          </div>
          {i < phases.length - 1 && <Arrow />}
        </div>
      ))}
    </div>
  );
}

function DirectoryTree() {
  const [exp, setExp] = useState<Record<string, boolean>>({ l1: true, l2_1: true, l3_1: true });
  const tog = (k: string) => setExp(prev => ({ ...prev, [k]: !prev[k] }));

  const tis = (lv: number, co: string, bg: string): React.CSSProperties => ({
    background: bg, border: `1px solid ${co}33`, borderLeft: `4px solid ${co}`,
    borderRadius: 8, padding: '10px 14px', marginLeft: lv * 24, marginBottom: 6, cursor: 'pointer',
  });

  const doms = ['市场监管', '生态环境', '交通运输', '农业农村', '文化旅游', '应急管理'];
  const orgs = ['省市场监督管理局（省级）', '南京市市场监管局（市级）', '各区市场监管局（县级）'];
  const its = ['对食品生产企业生产经营活动的行政检查', '对特种设备使用单位安全管理的行政检查', '对药品经营企业经营活动的行政检查'];
  const lvs = [
    { lv: '一级', nm: '事项类型', ds: '固定为"行政检查"', co: C.primary, bg: '#dbeafe' },
    { lv: '二级', nm: '执法领域', ds: '市场监管、生态环境、交通运输等', co: C.green, bg: '#c6f6d5' },
    { lv: '三级', nm: '实施主体+层级', ds: '明确实施机关和行使层级（省/市/县/乡）', co: C.orange, bg: '#feebc8' },
    { lv: '四级', nm: '具体检查事项', ds: '最小管理单元，含完整结构化数据要素', co: C.purple, bg: '#e9d8fd' },
  ];

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 16 }}>四级层级化目录树体系</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div style={tis(0, C.primary, C.light)} onClick={() => tog('l1')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><Badge color={C.primary} bg="#dbeafe">一级目录</Badge><span style={{ fontWeight: 700, fontSize: 14, marginLeft: 8, color: C.primary }}>行政检查</span></div>
              <span style={{ fontSize: 12, color: C.gray }}>{exp.l1 ? '\u25BC' : '\u25B6'}</span>
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>顶层分类，明确清单边界</div>
          </div>
          {exp.l1 && doms.map((d, i) => (
            <div key={i}>
              <div style={tis(1, C.green, C.greenLight)} onClick={() => { if (i === 0) tog('l2_1'); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><Badge color={C.green} bg="#c6f6d5">二级</Badge><span style={{ fontWeight: 600, fontSize: 13, marginLeft: 8, color: C.green }}>{d}</span></div>
                  {i === 0 ? <span style={{ fontSize: 12, color: C.gray }}>{exp.l2_1 ? '\u25BC' : '\u25B6'}</span> : <span style={{ fontSize: 11, color: '#a0aec0' }}>...</span>}
                </div>
              </div>
              {i === 0 && exp.l2_1 && orgs.map((o, j) => (
                <div key={j}>
                  <div style={tis(2, C.orange, C.orangeLight)} onClick={() => { if (j === 0) tog('l3_1'); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><Badge color={C.orange} bg="#feebc8">三级</Badge><span style={{ fontWeight: 600, fontSize: 12, marginLeft: 8, color: C.orange }}>{o}</span></div>
                      {j === 0 && <span style={{ fontSize: 12, color: C.gray }}>{exp.l3_1 ? '\u25BC' : '\u25B6'}</span>}
                    </div>
                  </div>
                  {j === 0 && exp.l3_1 && its.map((it, k) => (
                    <div key={k} style={tis(3, C.purple, C.purpleLight)}>
                      <Badge color={C.purple} bg="#e9d8fd">四级</Badge>
                      <span style={{ fontSize: 12, marginLeft: 8, color: C.purple }}>{it}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div>
          <Card title="目录层级说明" bc={C.lightBorder}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lvs.map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Badge color={l.co} bg={l.bg}>{l.lv}</Badge>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: l.co }}>{l.nm}</div>
                    <div style={{ fontSize: 12, color: C.gray }}>{l.ds}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="设计目标" bc={C.greenBorder}>
            <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.8 }}>
              实现"同一领域、不同主体、权责分明"的管理目标。每个四级事项均包含完整结构化数据要素，可直接应用于执法实践。
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EncodingRules() {
  const segs = [
    { label: '省级标识', width: '15%', co: C.primary, bg: C.light, ex: '32', ds: '江苏省代码' },
    { label: '领域代码', width: '20%', co: C.green, bg: C.greenLight, ex: 'SC', ds: '市场监管' },
    { label: '主体层级', width: '20%', co: C.orange, bg: C.orangeLight, ex: 'SJ01', ds: '省级第1主体' },
    { label: '事项序列码', width: '45%', co: C.purple, bg: C.purpleLight, ex: 'XZJC00001234', ds: '行政检查流水号' },
  ];
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 16 }}>18位全省唯一编码规则</div>
      <Card title="编码结构拆解" bc={C.lightBorder}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `2px solid ${C.accent}` }}>
            {segs.map((s, i) => (
              <div key={i} style={{ width: s.width, background: s.bg, padding: '12px 8px', textAlign: 'center', borderRight: i < 3 ? `2px dashed ${s.co}44` : 'none' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.co, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.co, fontFamily: 'monospace' }}>{s.ex}</div>
                <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{s.ds}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: C.accent, fontWeight: 600, fontFamily: 'monospace', letterSpacing: 1 }}>32-SC-SJ01-XZJC00001234</div>
          <div style={{ textAlign: 'center', fontSize: 11, color: C.gray }}>示意编码（非真实格式，仅用于理解结构）</div>
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
        <Card title="命名规则" bc={C.greenBorder} bg={C.greenLight}>
          <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.8 }}>
            <strong>标准模式：</strong><br />检查对象 + 检查内容 + 行政检查<br /><br />
            <strong>示例：</strong><br /><span style={{ color: C.green, fontWeight: 600 }}>"对食品生产企业生产经营活动的行政检查"</span>
          </div>
        </Card>
        <Card title="要素完备规则" bc={C.orangeBorder} bg={C.orangeLight}>
          <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.8 }}>
            每个事项必须包含：<br />{'\u2022'} 事项名称<br />{'\u2022'} 唯一编码<br />{'\u2022'} 实施主体<br />{'\u2022'} 行使层级<br />{'\u2022'} 执法依据<br />{'\u2022'} 检查对象 / 内容 / 方式
          </div>
        </Card>
        <Card title="状态标识规则" bc={C.purpleBorder} bg={C.purpleLight}>
          <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.8 }}>
            <strong>生效：</strong>正常使用<br /><strong>暂停：</strong>依据废止或职责调整<br /><br />
            记录梳理时间，为后续动态更新提供依据。依据废止事项暂不纳入基础版。
          </div>
        </Card>
      </div>
    </div>
  );
}

function KeyPoints() {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.primary, marginBottom: 16 }}>核心要点速记</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="服务定位" bc={C.lightBorder}>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.8 }}>
            以<strong>江苏省司法厅</strong>为服务对象，输出全省行政检查事项清单<strong>基础版</strong>，覆盖<strong>80%</strong>检查场景。以外省成熟事项为借鉴和对标。
          </div>
        </Card>
        <Card title="AI技术应用" bc={C.greenBorder}>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.8 }}>
            <strong>三大AI能力：</strong><br />
            1. 法律法规全量解析 → 事项智能识别<br />
            2. 条文解析+类比 → 要素自动补全<br />
            3. 语义分析+相似度 → 重复/冗余筛查
          </div>
        </Card>
        <Card title="工作量构成" bc={C.orangeBorder}>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.8 }}>
            1. <strong>资料归集</strong>：数十个部门 + 13个设区市<br />
            2. <strong>AI梳理</strong>：数十个执法领域，数千项事项<br />
            3. <strong>标准化+校验</strong>：多轮校验优化
          </div>
        </Card>
        <Card title="三维校验机制" bc={C.purpleBorder}>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.8 }}>
            <span style={{ color: C.green }}>{'\u25A0'}</span> <strong>合法性</strong>：依据有效、权限合规<br />
            <span style={{ color: C.orange }}>{'\u25A0'}</span> <strong>规范性</strong>：要素完整、编码唯一、命名规范<br />
            <span style={{ color: C.purple }}>{'\u25A0'}</span> <strong>合理性</strong>：设置必要、无重复交叉
          </div>
        </Card>
      </div>
      <div style={{ marginTop: 16 }}>
        <Card title="实施要点与注意事项" bc={C.lightBorder}>
          <div style={{ fontSize: 13, color: C.gray, lineHeight: 2 }}>
            <strong style={{ color: C.accent }}>服务定位：</strong>本方案以江苏省司法厅为服务对象，输出覆盖全省80%检查场景的标准化事项清单基础版，并可根据客户需求进行定制化扩展。<br />
            <strong style={{ color: C.green }}>质量保障：</strong>全流程采用"AI智能梳理 + 专业团队复核"的双层审校机制，确保事项内容合法、规范、合理，最终交付可直接导入执法系统的标准化数据文件。<br />
            <strong style={{ color: C.orange }}>动态维护：</strong>基础版交付后提供持续更新机制，针对法规修改、机构调整、新增领域等变化场景，实现事项清单的长期有效性。
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function PlanPage() {
  const [activeTab, setActiveTab] = useState(0);
  const content = [<Overview key={0} />, <ProcessDetail key={1} />, <DirectoryTree key={2} />, <EncodingRules key={3} />, <KeyPoints key={4} />];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <SiteHeader />
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">法规检索</Link>
            <Link href="/enforcement" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors hidden sm:inline">执法事项</Link>
            <Link href="/enforcement/plan" className="text-sm font-medium text-blue-600 hidden sm:inline">梳理方案</Link>
          </div>
        </div>
      </header>

      <section className="max-w-[920px] mx-auto px-4 py-6">
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {tabNames.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              style={{
                padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                border: activeTab === i ? `2px solid ${C.accent}` : '2px solid #e2e8f0',
                background: activeTab === i ? C.accent : '#fff',
                color: activeTab === i ? '#fff' : C.gray,
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        {content[activeTab]}
      </section>
    </div>
  );
}
