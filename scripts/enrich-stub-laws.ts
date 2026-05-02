import path from 'path';
import fs from 'fs';
import https from 'https';

const dbPath = path.join(__dirname, '..', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CACHE_FILE = path.join(__dirname, 'data', 'guizhangku-cache.json');
const ATHENA_URL = 'https://sousuoht.www.gov.cn/athena/forward/BD8730CDDA12515E2D9E1B21AA11C0D6';
const ATHENA_APP_KEY = decodeURIComponent('YMLOfDq5psgC%2Bz5HlWUd6RC75WYJ02Ia1eTitC8Pro4bHvRcUNQ4fGiecrxY7OJJ9xgA0E%2B8tn1cHbTtyuAtcCpYRXpKfIb4pDI4wdR45xu5V1GC5D4p96sGxcidhdxF8v9%2F86OMoKtpoZWY%2BuUFu9MKtPF8j7c8ZJ0lGfla53Q%3D');

interface GZKRecord {
  f_202321360426: string;   // title
  f_202344311304: string;   // publication info (contains doc number, dates)
  f_202323394765: string;   // publishing authority
  f_202355832506: string;   // authority variant 1
  f_202328191239: string;   // authority variant 2
  f_202321915922: string;   // publication date
  f_202321758948: string;   // full text
  doc_pub_url: string;       // detail URL
  f_20232124962: string;     // detail URL variant
}

function makeRequestBody(pageNo: number, pageSize: number): string {
  return JSON.stringify({
    code: '18258ab0ac9',
    preference: null,
    searchFields: [
      { fieldName: 'f_202321807875', searchWord: '部门规章', searchType: 'TERM', withHighLight: true },
      { fieldName: 'f_202321360426', searchWord: '', withHighLight: true },
      { fieldName: 'f_202321758948', searchWord: '', withHighLight: true },
      { fieldName: 'f_202321423473', withHighLight: true, searchType: 'TERM' },
      { fieldName: 'f_202321159816', searchWord: '', searchType: 'TERM' },
      { fieldName: 'f_20232380533', withHighLight: true, searchType: 'TERM' },
      { fieldName: 'f_202328191239', withHighLight: true, searchType: 'TERM' },
    ],
    sorts: [{}, { sortField: 'f_202321915922', sortOrder: 'DESC' }],
    resultFields: [
      'f_202321360426', 'f_202344311304', 'f_202323394765', 'f_202355832506',
      'f_202328191239', 'f_202321915922', 'f_202321758948', 'doc_pub_url', 'f_20232124962',
    ],
    trackTotalHits: 'true',
    granularity: 'ALL',
    tableName: 't_1860c735d31',
    pageSize,
    pageNo,
  });
}

function fetchPage(pageNo: number, pageSize: number): Promise<{ total: number; list: GZKRecord[] }> {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(makeRequestBody(pageNo, pageSize), 'utf-8');
    const url = new URL(ATHENA_URL);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        'Content-Length': body.length,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://www.gov.cn',
        'Referer': 'https://www.gov.cn/zhengce/xxgk/gjgzk/index.htm',
        'athenaAppKey': ATHENA_APP_KEY,
        'athenaAppName': '%E8%A7%84%E7%AB%A0%E5%BA%93',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.resultCode?.code !== 200) {
            reject(new Error(`API error: ${JSON.stringify(json.resultCode)}`));
            return;
          }
          resolve({
            total: json.result.data.pager.total,
            list: json.result.data.list,
          });
        } catch (e) {
          reject(new Error(`Parse error: ${e}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function downloadAllRecords(): Promise<GZKRecord[]> {
  if (fs.existsSync(CACHE_FILE)) {
    console.log('Loading from cache...');
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  }

  const PAGE_SIZE = 100;
  const firstPage = await fetchPage(1, PAGE_SIZE);
  const total = firstPage.total;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  console.log(`Total 部门规章: ${total}, pages: ${pageCount}`);

  const allRecords: GZKRecord[] = [...firstPage.list];
  console.log(`  Page 1/${pageCount}: ${firstPage.list.length} records`);

  for (let p = 2; p <= pageCount; p++) {
    await new Promise((r) => setTimeout(r, 500));
    const page = await fetchPage(p, PAGE_SIZE);
    allRecords.push(...page.list);
    console.log(`  Page ${p}/${pageCount}: ${page.list.length} records (total: ${allRecords.length})`);
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(allRecords, null, 2), 'utf-8');
  console.log(`Cached ${allRecords.length} records to ${CACHE_FILE}`);
  return allRecords;
}

function normalizeTitle(t: string): string {
  return t
    .replace(/<[^>]+>/g, '')
    .replace(/[《》''「」【】\s]/g, '')
    .replace(/[“””“”]/g, '”')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/\([^)]*\d{4}[^)]*(?:公布|修正|修订|修改|施行)[^)]*\)/g, '')
    .replace(/\(试行\)/g, '').replace(/（试行）/g, '')
    .trim();
}

function parsePublicationInfo(info: string): { documentNumber: string | null; effectiveDate: string | null } {
  if (!info) return { documentNumber: null, effectiveDate: null };

  let documentNumber: string | null = null;
  const docNumMatch = info.match(/(?:令|发|函|办)[\s]*(?:第?\s*)?(\d{4})\s*年?\s*第?\s*(\d+)\s*号/);
  if (docNumMatch) {
    const fullMatch = info.match(/[^\s（(]+(?:令|发|函|办)[^\s]*(?:第?\s*)?(?:\d{4}\s*年?\s*)?第?\s*\d+\s*号/);
    if (fullMatch) documentNumber = fullMatch[0].replace(/[（(）)]/g, '').trim();
  }
  if (!documentNumber) {
    const altMatch = info.match(/([^\s（(]+(?:令|发|函|办|规)[^\s]*第?\d+号)/);
    if (altMatch) documentNumber = altMatch[1];
  }

  let effectiveDate: string | null = null;
  const dateMatch = info.match(/自(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (dateMatch) {
    effectiveDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
  }

  return { documentNumber, effectiveDate };
}

function parsePromulgationDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Phase 2: Enrich Stub Laws from 国家规章库');
  console.log('='.repeat(60));

  const records = await downloadAllRecords();
  console.log(`\nLoaded ${records.length} 部门规章 from 国家规章库`);

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
  console.log(`Built title index: ${titleMap.size} unique titles`);

  const stubLaws = await prisma.law.findMany({
    where: {
      issuingAuthority: null,
      level: '部门规章',
    },
    select: { id: true, title: true },
  });
  console.log(`Found ${stubLaws.length} stub laws to enrich\n`);

  let matched = 0, unmatched = 0, updated = 0, errors = 0;
  const unmatchedTitles: string[] = [];

  for (const law of stubLaws) {
    const normalizedTitle = normalizeTitle(law.title);
    const noTrialTitle = normalizedTitle.replace(/\(试行\)$/, '').replace(/（试行）$/, '');
    const record = titleMap.get(normalizedTitle)
      || titleMap.get(noTrialTitle)
      || titleMapNoTrial.get(normalizedTitle)
      || titleMapNoTrial.get(noTrialTitle);

    if (!record) {
      unmatched++;
      unmatchedTitles.push(law.title);
      continue;
    }

    matched++;
    const authority = record.f_202323394765 || record.f_202355832506 || record.f_202328191239 || null;
    const pubInfo = parsePublicationInfo(record.f_202344311304 || '');
    const promulgationDate = parsePromulgationDate(record.f_202321915922);

    try {
      await prisma.law.update({
        where: { id: law.id },
        data: {
          issuingAuthority: authority ? authority.replace(/<[^>]+>/g, '') : undefined,
          documentNumber: pubInfo.documentNumber || undefined,
          promulgationDate: promulgationDate ? new Date(promulgationDate) : undefined,
          effectiveDate: pubInfo.effectiveDate ? new Date(pubInfo.effectiveDate) : undefined,
        },
      });
      updated++;
      if (updated % 50 === 0) console.log(`  Progress: ${updated} updated`);
    } catch (err) {
      errors++;
      console.error(`  ERROR updating [${law.title}]: ${err}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Matched: ${matched} / ${stubLaws.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unmatched: ${unmatched}`);
  console.log(`Errors: ${errors}`);

  if (unmatchedTitles.length > 0) {
    console.log(`\nUnmatched titles (${unmatchedTitles.length}):`);
    for (const t of unmatchedTitles.slice(0, 30)) {
      console.log(`  - ${t}`);
    }
    if (unmatchedTitles.length > 30) console.log(`  ... and ${unmatchedTitles.length - 30} more`);

    fs.writeFileSync(
      path.join(__dirname, 'data', 'unmatched-laws.json'),
      JSON.stringify(unmatchedTitles, null, 2),
      'utf-8'
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
