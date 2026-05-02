import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const UNMATCHED_FILE = path.join(__dirname, 'data', 'unmatched-laws.json');

function normalize(t: string): string {
  return t
    .replace(/[《》''「」【】\s]/g, '')
    .replace(/["""""]/g, '"')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .replace(/\(试行\)/g, '').replace(/（试行）/g, '')
    .trim();
}

async function main() {
  const unmatched: string[] = JSON.parse(fs.readFileSync(UNMATCHED_FILE, 'utf-8'));

  // Pre-existing laws only (before the 403 stub import, lawId <= 7769)
  const preLaws = await prisma.law.findMany({
    where: { id: { lte: 7769 } },
    select: { id: true, title: true, level: true, status: true },
  });
  console.log(`Pre-existing laws (id <= 7769): ${preLaws.length}\n`);

  const xzLaws = preLaws.filter(l => l.level === '行政法规');
  console.log(`其中行政法规: ${xzLaws.length}\n`);

  let matched = 0;
  let notFound = 0;

  for (const title of unmatched) {
    const norm = normalize(title);

    // Check exact match against all pre-existing laws
    let found = false;
    for (const l of preLaws) {
      const ln = normalize(l.title);
      if (ln === norm) {
        console.log(`EXACT: ${title}`);
        console.log(`   → ${l.title} [${l.level}] (lawId=${l.id}, ${l.status})`);
        found = true;
        matched++;
        break;
      }
    }
    if (found) continue;

    // Check contains match against 行政法规
    for (const l of xzLaws) {
      const ln = normalize(l.title);
      const lnBase = ln.replace(/条例$/, '');
      const normBase = norm.replace(/办法$|规定$|规则$|细则$|标准$/, '');

      if (ln.includes(norm) || norm.includes(ln) || lnBase === normBase) {
        console.log(`SIMILAR: ${title}`);
        console.log(`   → 可能对应行政法规: ${l.title} [${l.level}] (lawId=${l.id}, ${l.status})`);
        found = true;
        matched++;
        break;
      }
    }

    if (!found) {
      console.log(`NO_MATCH: ${title}`);
      notFound++;
    }
  }

  console.log(`\n=== 结果 ===`);
  console.log(`匹配到已有法规: ${matched}`);
  console.log(`无匹配: ${notFound}`);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
