import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MISSING_FILE = path.join(__dirname, 'data', 'missing-laws.json');
const CACHE_FILE = path.join(__dirname, 'data', 'guizhangku-cache.json');

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
  const missingTitles: string[] = JSON.parse(fs.readFileSync(MISSING_FILE, 'utf-8').replace(/^﻿/, ''));

  // 1. 推断为行政法规的2条
  console.log('=== 推断为行政法规的法规 ===\n');
  const xingzhengLaws = await prisma.law.findMany({
    where: {
      title: { in: missingTitles },
      level: '行政法规',
    },
    select: { id: true, title: true, level: true, issuingAuthority: true },
  });
  for (const l of xingzhengLaws) {
    console.log(`  - ${l.title} (lawId=${l.id}, 制定机关=${l.issuingAuthority || '无'})`);
  }

  // 2. 27条未匹配
  console.log('\n=== 未匹配的27条 ===\n');
  const unmatchedFile = path.join(__dirname, 'data', 'unmatched-laws.json');
  const unmatched: string[] = JSON.parse(fs.readFileSync(unmatchedFile, 'utf-8'));
  for (let i = 0; i < unmatched.length; i++) {
    console.log(`  ${i+1}. ${unmatched[i]}`);
  }

  // 3. 有元数据但无全文/解析失败的4条
  console.log('\n=== 有元数据但无全文回填的法规 ===\n');

  // Load cache to check
  interface GZKRecord { f_202321360426: string; f_202321758948: string; }
  const records: GZKRecord[] = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
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

  // Find stub laws that have issuingAuthority (matched in Phase 2) but no articles (not backfilled)
  const matchedButNoArticles = await prisma.law.findMany({
    where: {
      title: { in: missingTitles },
      level: '部门规章',
      issuingAuthority: { not: null },
      articles: { none: {} },
    },
    select: { id: true, title: true, issuingAuthority: true },
  });

  for (const l of matchedButNoArticles) {
    const normalizedTitle = normalizeTitle(l.title);
    const noTrialTitle = normalizedTitle.replace(/\(试行\)$/, '').replace(/（试行）$/, '');
    const record = titleMap.get(normalizedTitle)
      || titleMap.get(noTrialTitle)
      || titleMapNoTrial.get(normalizedTitle)
      || titleMapNoTrial.get(noTrialTitle);
    
    const fullTextLen = record ? (record.f_202321758948 || '').length : 0;
    const reason = !record ? '缓存中找不到' : fullTextLen < 50 ? `全文太短(${fullTextLen}字符)` : '全文有但解析后无条文';
    console.log(`  - ${l.title} (lawId=${l.id}, 原因: ${reason})`);
  }

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
