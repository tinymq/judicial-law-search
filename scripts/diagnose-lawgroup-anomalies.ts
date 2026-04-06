import { prisma } from '../src/lib/db';
import {
  buildLawBaseTitle,
  findRelatedLawCandidates,
  normalizeLawTitle,
} from '../src/lib/law-grouping';

type LawRow = {
  id: number;
  title: string;
  lawGroupId: string | null;
  effectiveDate: Date | null;
  promulgationDate: Date | null;
  status: string | null;
  level: string;
};

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : '—';
}

function printSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function diagnoseMismatchedGroups(laws: LawRow[]) {
  printSection('疑似同法不同组');

  const findings: Array<{
    current: LawRow;
    recommended: LawRow;
    score: number;
    reason: string;
  }> = [];

  for (const law of laws) {
    const result = findRelatedLawCandidates(law.title, laws, { excludeLawId: law.id });
    const recommended = result.recommended;

    if (!recommended || !recommended.shouldAutoSelect) {
      continue;
    }

    if (law.lawGroupId && recommended.lawGroupId && law.lawGroupId === recommended.lawGroupId) {
      continue;
    }

    findings.push({
      current: law,
      recommended,
      score: recommended.score,
      reason: recommended.matchReason,
    });
  }

  if (findings.length === 0) {
    console.log('未发现疑似同法不同组的高置信异常。');
    return;
  }

  findings
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .forEach((item, index) => {
      console.log(
        `${index + 1}. [${item.current.id}] ${item.current.title}\n` +
        `   当前组: ${item.current.lawGroupId ?? 'null'}\n` +
        `   推荐组: ${item.recommended.lawGroupId ?? 'null'} 来自 [${item.recommended.id}] ${item.recommended.title}\n` +
        `   置信度: ${Math.round(item.score * 100)}% · 原因: ${item.reason}`
      );
    });
}

async function diagnoseInconsistentGroupMembers(laws: LawRow[]) {
  printSection('同组标题异常');

  const groupMap = new Map<string, LawRow[]>();
  for (const law of laws) {
    if (!law.lawGroupId) continue;
    const list = groupMap.get(law.lawGroupId) ?? [];
    list.push(law);
    groupMap.set(law.lawGroupId, list);
  }

  const anomalies = Array.from(groupMap.entries())
    .map(([groupId, members]) => {
      const baseTitles = new Set(members.map(member => buildLawBaseTitle(member.title)));
      const normalizedTitles = new Set(members.map(member => normalizeLawTitle(member.title)));
      return {
        groupId,
        members,
        baseTitles,
        normalizedTitles,
      };
    })
    .filter(item => item.members.length > 1 && item.baseTitles.size > 1);

  if (anomalies.length === 0) {
    console.log('未发现同组核心标题明显不一致的异常。');
    return;
  }

  anomalies.slice(0, 50).forEach((item, index) => {
    console.log(`${index + 1}. 组 ${item.groupId}`);
    console.log(`   核心标题数: ${item.baseTitles.size} · 标准化标题数: ${item.normalizedTitles.size}`);
    item.members.forEach(member => {
      console.log(
        `   - [${member.id}] ${member.title} · base=${buildLawBaseTitle(member.title)} · 生效=${formatDate(member.effectiveDate)}`
      );
    });
  });
}

async function diagnoseBaseTitleClusters(laws: LawRow[]) {
  printSection('按核心标题聚类');

  const clusterMap = new Map<string, LawRow[]>();
  for (const law of laws) {
    const key = buildLawBaseTitle(law.title);
    const list = clusterMap.get(key) ?? [];
    list.push(law);
    clusterMap.set(key, list);
  }

  const fragmentedClusters = Array.from(clusterMap.entries())
    .map(([baseTitle, members]) => ({
      baseTitle,
      members,
      groupIds: new Set(members.map(member => member.lawGroupId ?? 'null')),
    }))
    .filter(item => item.members.length > 1 && item.groupIds.size > 1)
    .sort((a, b) => b.members.length - a.members.length);

  if (fragmentedClusters.length === 0) {
    console.log('未发现按核心标题聚类后存在多个 lawGroupId 的情况。');
    return;
  }

  fragmentedClusters.slice(0, 50).forEach((item, index) => {
    console.log(`${index + 1}. ${item.baseTitle}`);
    console.log(`   涉及组: ${Array.from(item.groupIds).join(', ')}`);
    item.members.forEach(member => {
      console.log(
        `   - [${member.id}] ${member.title} · group=${member.lawGroupId ?? 'null'} · 状态=${member.status ?? '—'}`
      );
    });
  });
}

async function main() {
  const laws = await prisma.law.findMany({
    select: {
      id: true,
      title: true,
      lawGroupId: true,
      effectiveDate: true,
      promulgationDate: true,
      status: true,
      level: true,
    },
    orderBy: { id: 'asc' },
  });

  console.log(`共加载 ${laws.length} 条法规`);

  await diagnoseMismatchedGroups(laws);
  await diagnoseInconsistentGroupMembers(laws);
  await diagnoseBaseTitleClusters(laws);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('❌ 巡检失败:', error);
  await prisma.$disconnect();
  process.exit(1);
});
