import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, 'data');

function normalize(t: string): string {
  return t
    .replace(/<[^>]+>/g, '')
    .replace(/[《》''「」【】\s]/g, '')
    .replace(/[""„‟"]/g, '"')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .replace(/\(试行\)/g, '')
    .trim();
}

interface FlkEntry { title: string; sxx: number; gbrq: string }

const sxxLabels: Record<number, string> = {
  1: '有效', 2: '已废止', 3: '已修改', 4: '尚未生效',
};

function latestVersion(entries: FlkEntry[]): FlkEntry {
  return entries.sort((a, b) => (b.gbrq || '').localeCompare(a.gbrq || ''))[0];
}

function readJson(filePath: string): any {
  let raw = fs.readFileSync(filePath, 'utf-8').trim();
  let parsed = JSON.parse(raw);
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  return parsed;
}

function compare(category: string, flkFile: string, localFile: string) {
  const flkRaw: FlkEntry[] = readJson(path.join(DATA_DIR, flkFile));
  const localTitles: string[] = readJson(path.join(DATA_DIR, localFile));

  const localNormSet = new Set(localTitles.map(normalize));

  const flkByNorm = new Map<string, FlkEntry[]>();
  for (const entry of flkRaw) {
    const norm = normalize(entry.title);
    if (!flkByNorm.has(norm)) flkByNorm.set(norm, []);
    flkByNorm.get(norm)!.push(entry);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${category}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`国家法律法规数据库: ${flkRaw.length} 条 (去重后 ${flkByNorm.size} 部)`);
  console.log(`本地数据库: ${localTitles.length} 条`);

  const missing: { title: string; sxx: string; gbrq: string }[] = [];
  const matched: string[] = [];

  for (const [norm, entries] of flkByNorm) {
    if (localNormSet.has(norm)) {
      matched.push(norm);
    } else {
      const latest = latestVersion(entries);
      missing.push({
        title: latest.title,
        sxx: sxxLabels[latest.sxx] || `未知(${latest.sxx})`,
        gbrq: latest.gbrq,
      });
    }
  }

  const localNorms = new Set([...localNormSet]);
  for (const m of matched) localNorms.delete(m);
  const localOnly = localTitles.filter(t => {
    const n = normalize(t);
    return !flkByNorm.has(n);
  });

  console.log(`\n匹配: ${matched.length} 部`);
  console.log(`国家库有、本地缺: ${missing.length} 部`);
  console.log(`本地有、国家库无: ${localOnly.length} 部`);

  if (missing.length > 0) {
    missing.sort((a, b) => (b.gbrq || '').localeCompare(a.gbrq || ''));
    console.log(`\n--- 本地缺少的${category} ---`);
    for (const m of missing) {
      console.log(`  ${m.title} [${m.sxx}] (${m.gbrq})`);
    }
  }

  if (localOnly.length > 0) {
    console.log(`\n--- 仅本地有的${category}（国家库无对应） ---`);
    for (const t of localOnly) {
      console.log(`  ${t}`);
    }
  }

  return { category, missing, localOnly, matched: matched.length, flkTotal: flkByNorm.size, localTotal: localTitles.length };
}

const falvResult = compare('法律', 'flk-falv-full.json', 'local-falv.json');
const xzfgResult = compare('行政法规', 'flk-xzfg-full.json', 'local-xzfg.json');

const outputPath = path.join(
  'C:\\Users\\26371\\Documents\\Mo Obsidian\\Mo CCLearning\\2026CoAwareProjects\\00-项目综合\\执法事项研究',
  '26050201-法规缺口清单.md',
);

const lines: string[] = [];
lines.push('# 法规缺口清单');
lines.push('');
lines.push(`> 生成时间: ${new Date().toISOString().split('T')[0]}`);
lines.push(`> 数据来源: 国家法律法规数据库 (flk.npc.gov.cn) vs 本地数据库`);
lines.push('');
lines.push('## 概览');
lines.push('');
lines.push('| 类别 | 国家库(去重) | 本地 | 匹配 | 本地缺 | 本地多 |');
lines.push('| --- | --- | --- | --- | --- | --- |');
lines.push(`| 法律 | ${falvResult.flkTotal} | ${falvResult.localTotal} | ${falvResult.matched} | ${falvResult.missing.length} | ${falvResult.localOnly.length} |`);
lines.push(`| 行政法规 | ${xzfgResult.flkTotal} | ${xzfgResult.localTotal} | ${xzfgResult.matched} | ${xzfgResult.missing.length} | ${xzfgResult.localOnly.length} |`);
lines.push('');

for (const result of [falvResult, xzfgResult]) {
  if (result.missing.length > 0) {
    lines.push(`## 本地缺少的${result.category}`);
    lines.push('');
    lines.push('| 序号 | 名称 | 时效性 | 公布日期 |');
    lines.push('| --- | --- | --- | --- |');
    for (let i = 0; i < result.missing.length; i++) {
      const m = result.missing[i];
      lines.push(`| ${i + 1} | ${m.title} | ${m.sxx} | ${m.gbrq} |`);
    }
    lines.push('');
  }

  if (result.localOnly.length > 0) {
    lines.push(`## 仅本地有的${result.category}（国家库无对应）`);
    lines.push('');
    lines.push('| 序号 | 名称 |');
    lines.push('| --- | --- |');
    for (let i = 0; i < result.localOnly.length; i++) {
      lines.push(`| ${i + 1} | ${result.localOnly[i]} |`);
    }
    lines.push('');
  }
}

fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
console.log(`\n缺口清单已保存到: ${outputPath}`);
