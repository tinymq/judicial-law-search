import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DATA_DIR = path.join(__dirname, 'data');

interface FlkEntry {
  title: string;
  sxx: number;
  gbrq: string;
  sxrq: string;
  zdjgName: string;
}

function readJson(filePath: string): any {
  let raw = fs.readFileSync(filePath, 'utf-8').trim();
  let parsed = JSON.parse(raw);
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  return parsed;
}

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

async function main() {
  const falvData: FlkEntry[] = readJson(path.join(DATA_DIR, 'flk-falv-enrich.json'));
  const xzfgData: FlkEntry[] = readJson(path.join(DATA_DIR, 'flk-xzfg-enrich.json'));

  const flkByNorm = new Map<string, FlkEntry>();
  for (const entry of [...falvData, ...xzfgData]) {
    const norm = normalize(entry.title);
    const existing = flkByNorm.get(norm);
    if (!existing || (entry.gbrq || '') > (existing.gbrq || '')) {
      flkByNorm.set(norm, entry);
    }
  }
  console.log(`flk 数据: ${falvData.length} 法律 + ${xzfgData.length} 行政法规 = ${falvData.length + xzfgData.length} 条`);
  console.log(`去重后: ${flkByNorm.size} 条\n`);

  const laws = await prisma.law.findMany({
    where: { level: { in: ['法律', '行政法规'] } },
    select: { id: true, title: true, level: true, effectiveDate: true, issuingAuthority: true },
  });
  console.log(`本地法律+行政法规: ${laws.length} 条\n`);

  let updatedEffDate = 0, updatedAuthority = 0, noMatch = 0, alreadyFull = 0;

  for (const law of laws) {
    const norm = normalize(law.title);
    const flk = flkByNorm.get(norm);

    if (!flk) {
      noMatch++;
      continue;
    }

    const updates: Record<string, any> = {};

    if (!law.effectiveDate && flk.sxrq) {
      updates.effectiveDate = new Date(flk.sxrq);
    }

    if (!law.issuingAuthority && flk.zdjgName) {
      updates.issuingAuthority = flk.zdjgName;
    }

    if (Object.keys(updates).length === 0) {
      alreadyFull++;
      continue;
    }

    await prisma.law.update({ where: { id: law.id }, data: updates });

    if (updates.effectiveDate) updatedEffDate++;
    if (updates.issuingAuthority) updatedAuthority++;

    if (updatedEffDate + updatedAuthority <= 10) {
      const fields = Object.keys(updates).join(', ');
      console.log(`  更新 [${law.level}] ${law.title} → ${fields}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('修复结果');
  console.log('='.repeat(60));
  console.log(`匹配成功: ${laws.length - noMatch} / ${laws.length}`);
  console.log(`无匹配: ${noMatch}`);
  console.log(`已有值无需更新: ${alreadyFull}`);
  console.log(`新填施行日期: ${updatedEffDate}`);
  console.log(`新填制定机关: ${updatedAuthority}`);

  await prisma.$disconnect();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
