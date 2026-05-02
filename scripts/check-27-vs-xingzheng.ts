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

  // Load all 行政法规 from DB
  const xzLaws = await prisma.law.findMany({
    where: { level: '行政法规' },
    select: { id: true, title: true, status: true },
  });
  console.log(`数据库中行政法规总数: ${xzLaws.length}\n`);

  const xzMap = new Map<string, typeof xzLaws[0]>();
  for (const l of xzLaws) {
    xzMap.set(normalize(l.title), l);
  }

  // Also check all laws (any level) for broader matching
  const allLaws = await prisma.law.findMany({
    select: { id: true, title: true, level: true, status: true },
  });
  const allNormMap = new Map<string, typeof allLaws[0]>();
  for (const l of allLaws) {
    allNormMap.set(normalize(l.title), l);
  }

  let matched = 0;
  let notFound = 0;

  for (const title of unmatched) {
    const norm = normalize(title);
    
    // Try exact normalized match against all laws
    const exactAll = allNormMap.get(norm);
    if (exactAll) {
      console.log(`✅ ${title}`);
      console.log(`   → 库中: ${exactAll.title} (level=${exactAll.level}, status=${exactAll.status}, lawId=${exactAll.id})`);
      matched++;
      continue;
    }

    // Try contains match against 行政法规 only
    let found = false;
    for (const xz of xzLaws) {
      const xzNorm = normalize(xz.title);
      if (xzNorm.includes(norm) || norm.includes(xzNorm)) {
        console.log(`🔍 ${title}`);
        console.log(`   → 可能匹配(包含): ${xz.title} (level=${xz.level}, status=${xz.status}, lawId=${xz.id})`);
        found = true;
        matched++;
        break;
      }
    }
    if (!found) {
      // Check if it looks like an 行政法规 by name pattern
      const looksLikeXZ = /条例/.test(title) && !/实施细则|实施办法|管理办法|管理规定/.test(title);
      console.log(`❌ ${title}${looksLikeXZ ? ' (标题含"条例"，可能是行政法规)' : ''}`);
      notFound++;
    }
  }

  console.log(`\n=== 结果 ===`);
  console.log(`匹配到: ${matched}`);
  console.log(`未找到: ${notFound}`);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
