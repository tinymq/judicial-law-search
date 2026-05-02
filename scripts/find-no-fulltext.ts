import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MISSING_FILE = path.join(__dirname, 'data', 'missing-laws.json');
const UNMATCHED_FILE = path.join(__dirname, 'data', 'unmatched-laws.json');

async function main() {
  const missingTitles: string[] = JSON.parse(fs.readFileSync(MISSING_FILE, 'utf-8').replace(/^﻿/, ''));
  const unmatchedTitles: string[] = JSON.parse(fs.readFileSync(UNMATCHED_FILE, 'utf-8'));

  // Find all 403 stub laws in DB
  const stubLaws = await prisma.law.findMany({
    where: { title: { in: missingTitles } },
    select: {
      id: true, title: true, level: true, issuingAuthority: true,
      _count: { select: { articles: true } },
    },
  });

  console.log(`403 stub laws 在数据库中: ${stubLaws.length}\n`);

  // Categorize
  const hasAuthNoArticles = stubLaws.filter(l => l.issuingAuthority !== null && l._count.articles === 0);
  const noAuth = stubLaws.filter(l => l.issuingAuthority === null);
  const hasArticles = stubLaws.filter(l => l._count.articles > 0);
  const xingzheng = stubLaws.filter(l => l.level === '行政法规');

  console.log(`有元数据+有条文: ${hasArticles.length}`);
  console.log(`有元数据+无条文: ${hasAuthNoArticles.length}`);
  console.log(`无元数据(未匹配): ${noAuth.length}`);
  console.log(`推断为行政法规: ${xingzheng.length}\n`);

  if (hasAuthNoArticles.length > 0) {
    console.log('=== 有元数据但无条文的法规 ===\n');
    for (const l of hasAuthNoArticles) {
      console.log(`  - ${l.title} (lawId=${l.id}, level=${l.level}, 机关=${l.issuingAuthority})`);
    }
  }

  // Also check: stub laws with articles but level=行政法规
  const xzWithArticles = stubLaws.filter(l => l.level === '行政法规' && l._count.articles > 0);
  if (xzWithArticles.length > 0) {
    console.log('\n=== 行政法规但有条文(说明被Phase3意外处理) ===');
    for (const l of xzWithArticles) {
      console.log(`  - ${l.title} (lawId=${l.id}, articles=${l._count.articles})`);
    }
  }

  // Summary: 378 matched - 374 backfilled = 4 gap
  // 378 matched = those with issuingAuthority
  const withAuth = stubLaws.filter(l => l.issuingAuthority !== null);
  console.log(`\n=== 数据验证 ===`);
  console.log(`有issuingAuthority: ${withAuth.length} (应为378)`);
  console.log(`有条文: ${hasArticles.length} (应为374)`);
  console.log(`差异: ${withAuth.length - hasArticles.length} 条`);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
