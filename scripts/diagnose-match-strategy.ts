import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CACHE_FILE = path.join(__dirname, 'data', 'guizhangku-cache.json');
const MISSING_FILE = path.join(__dirname, 'data', 'missing-laws.json');

interface GZKRecord {
  f_202321360426: string;
  f_202344311304: string;
  f_202323394765: string;
  f_202355832506: string;
  f_202328191239: string;
  f_202321915922: string;
}

function normalizeTitle(t: string): string {
  return t
    .replace(/<[^>]+>/g, '')
    .replace(/[《》''「」【】\s]/g, '')
    .replace(/["""""]/g, '"')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .replace(/\(试行\)/g, '').replace(/（试行）/g, '')
    .trim();
}

async function main() {
  const records: GZKRecord[] = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  const missingTitles: string[] = JSON.parse(fs.readFileSync(MISSING_FILE, 'utf-8').replace(/^﻿/, ''));

  const titleMap = new Map<string, GZKRecord>();
  const titleMapNoTrial = new Map<string, GZKRecord>();
  for (const r of records) {
    const rawTitle = (r.f_202321360426 || '').replace(/<[^>]+>/g, '');
    const title = normalizeTitle(rawTitle);
    if (title) {
      titleMap.set(title, r);
      titleMapNoTrial.set(title.replace(/\(试行\)$/, '').replace(/（试行）$/, ''), r);
    }
  }

  let exactCount = 0;
  const nonExact: { lawTitle: string; strategy: string; matchedGZKTitle: string }[] = [];

  for (const lawTitle of missingTitles) {
    const normalizedTitle = normalizeTitle(lawTitle);
    const noTrialTitle = normalizedTitle.replace(/\(试行\)$/, '').replace(/（试行）$/, '');

    if (titleMap.has(normalizedTitle)) {
      exactCount++;
      continue;
    }

    let strategy = '';
    let matchedRecord: GZKRecord | undefined;

    if (titleMap.has(noTrialTitle)) {
      strategy = '去掉试行后精确匹配';
      matchedRecord = titleMap.get(noTrialTitle);
    } else if (titleMapNoTrial.has(normalizedTitle)) {
      strategy = '交叉匹配(规章库侧去试行)';
      matchedRecord = titleMapNoTrial.get(normalizedTitle);
    } else if (titleMapNoTrial.has(noTrialTitle)) {
      strategy = '双重交叉匹配(双方都去试行)';
      matchedRecord = titleMapNoTrial.get(noTrialTitle);
    } else {
      continue; // unmatched - skip
    }

    const matchedGZKTitle = matchedRecord
      ? (matchedRecord.f_202321360426 || '').replace(/<[^>]+>/g, '')
      : '(无)';

    nonExact.push({ lawTitle, strategy, matchedGZKTitle });
  }

  console.log(`403条stub法规中:`);
  console.log(`  标准化精确匹配: ${exactCount}`);
  console.log(`  非精确匹配: ${nonExact.length}`);
  console.log(`  未匹配(27条): ${missingTitles.length - exactCount - nonExact.length}\n`);

  console.log(`=== 非精确匹配清单 ===\n`);
  for (let i = 0; i < nonExact.length; i++) {
    const m = nonExact[i];
    console.log(`[${i+1}] DB法规: ${m.lawTitle}`);
    console.log(`    策略: ${m.strategy}`);
    console.log(`    实际匹配到: ${m.matchedGZKTitle}`);
    console.log('');
  }

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
