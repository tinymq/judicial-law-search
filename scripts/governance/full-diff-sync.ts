/**
 * 全量差异同步脚本 - 方案C：浙江省执法事项全量对比与同步
 *
 * 功能：
 *   1. 从浙江政务服务网 API 获取全部在线执法事项（8527+条）
 *   2. 与本地数据库进行全量对比，识别差异
 *   3. 生成详细的差异报告（JSON）
 *   4. --apply 模式下执行同步：新增入库、获取检查标准、标记停用
 *
 * API:
 *   POST /jpaas-zjservice-server/open-api/department/getDepartmentMatterPageList
 *   参数: regionCode=330000&current={page}&pageSize=50
 *
 *   POST /jpaas-zjservice-server/open-api/department/getMatterDetail
 *   参数: qlInnerCode={sourceId}
 *
 *   POST /jpaas-zjservice-server/open-api/department/getCheckContent
 *   参数: qlInnerCode={sourceId}&current=1&pageSize=200
 *
 * 用法：
 *   npx tsx scripts/governance/full-diff-sync.ts                # 全量对比（干运行）
 *   npx tsx scripts/governance/full-diff-sync.ts --apply        # 全量对比并同步
 *   MAX_ITEMS=10 npx tsx scripts/governance/full-diff-sync.ts --apply  # 限制同步数量
 *
 * 环境变量：
 *   DELAY_MS=1500        请求间隔（毫秒，默认1500）
 *   MAX_ITEMS=Infinity   最大同步条数（默认不限）
 *   MAX_PAGES=0          最大获取页数（0=不限，默认0，用于测试）
 *   RESUME_PAGE=1        从第几页开始获取（断点续传）
 *   REPORT_DIR=path      报告输出目录
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// === 配置 ===
const APPLY = process.argv.includes('--apply');
const DELAY_MS = parseInt(process.env.DELAY_MS || '1500');
const MAX_ITEMS = process.env.MAX_ITEMS ? parseInt(process.env.MAX_ITEMS) : Infinity;
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '0');
const RESUME_PAGE = parseInt(process.env.RESUME_PAGE || '1');
const PAGE_SIZE = 50; // API 最大限制
const PROVINCE_CODE = '330000';
const BASE_URL = 'https://www.zjzwfw.gov.cn/jpaas-zjservice-server/open-api/department';
const LIST_API = `${BASE_URL}/getDepartmentMatterPageList`;
const DETAIL_API = `${BASE_URL}/getMatterDetail`;
const CHECK_API = `${BASE_URL}/getCheckContent`;

const REPORT_DIR = process.env.REPORT_DIR
  || path.join(__dirname, 'reports');

// qlKind → category 映射
const QL_KIND_MAP: Record<string, string> = {
  '01': '行政许可',
  '02': '行政强制',
  '03': '行政处罚',
  '04': '行政征收',
  '05': '行政给付',
  '06': '行政裁决',
  '07': '行政确认',
  '08': '行政奖励',
  '09': '行政监督',
  '10': '其他行政权力',
  '11': '行政检查',
  '17': '行政命令',
};

// === 类型 ===

interface OnlineItem {
  id: string;        // UUID (sourceId)
  name: string;
  qlKind: string;
  qlCode: string;
  isLeaf: string;
  isOnline: string;
  popularName: string;
  qlIsMain: string;
  entrust: string;
  userType: string;
}

interface DbItem {
  id: number;
  name: string;
  category: string;
  sourceId: string | null;
  itemStatus: string | null;
  enforcementBody: string | null;
}

interface DiffEntry {
  type: 'new_online' | 'removed_online' | 'name_mismatch' | 'category_mismatch';
  sourceId: string;
  onlineName?: string;
  dbName?: string;
  onlineCategory?: string;
  dbCategory?: string;
  dbId?: number;
  dbStatus?: string | null;
}

interface DiffReport {
  generatedAt: string;
  onlineTotal: number;
  dbTotal: number;
  dbWithSourceId: number;
  dbWithoutSourceId: number;
  summary: {
    newOnline: number;
    removedOnline: number;
    nameMismatch: number;
    categoryMismatch: number;
    matched: number;
  };
  categoryBreakdown: {
    online: Record<string, number>;
    db: Record<string, number>;
  };
  entries: DiffEntry[];
}

interface CheckContentItem {
  checkItem: string;
  checkContent: string;
  checkOperate?: string;
  law?: string;
  contentLevel?: string;
  checkType?: string;
}

// === 工具函数 ===

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  body: string,
  retries = 3,
): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (res.status === 429) {
        const waitTime = 10000 + (attempt * 5000);
        console.log(`  频率限制，等待 ${waitTime / 1000}s...`);
        await sleep(waitTime);
        continue;
      }

      if (!res.ok) {
        console.log(`  HTTP ${res.status} (attempt ${attempt + 1}/${retries})`);
        if (attempt < retries - 1) {
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }
        return null;
      }

      const json = await res.json();
      return json;
    } catch (e: any) {
      if (attempt < retries - 1) {
        const backoff = 2000 * Math.pow(2, attempt);
        console.log(`  网络错误 (attempt ${attempt + 1}): ${e.message}，等待 ${backoff / 1000}s`);
        await sleep(backoff);
        continue;
      }
      console.log(`  网络错误: ${e.message}`);
      return null;
    }
  }
  return null;
}

function getCategoryFromQlKind(qlKind: string): string {
  return QL_KIND_MAP[qlKind] || `未知(${qlKind})`;
}

// === 进度文件（断点续传支持） ===

const PROGRESS_FILE = path.join(REPORT_DIR, '.full-diff-progress.json');

interface Progress {
  startedAt: string;
  lastPage: number;
  totalPages: number;
  itemsSoFar: OnlineItem[];
}

function saveProgress(progress: Progress): void {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress), 'utf-8');
}

function loadProgress(): Progress | null {
  if (!fs.existsSync(PROGRESS_FILE)) return null;
  try {
    const content = fs.readFileSync(PROGRESS_FILE, 'utf-8');
    return JSON.parse(content) as Progress;
  } catch {
    return null;
  }
}

function clearProgress(): void {
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}

// === 核心功能 ===

/**
 * 从 API 获取全部在线事项列表（支持断点续传）
 */
async function fetchAllOnlineItems(): Promise<OnlineItem[]> {
  let items: OnlineItem[] = [];
  let startPage = RESUME_PAGE;

  // 尝试恢复进度
  if (RESUME_PAGE === 1) {
    const progress = loadProgress();
    if (progress) {
      console.log(`发现断点续传文件 (${progress.startedAt})`);
      console.log(`  上次进度: 第 ${progress.lastPage}/${progress.totalPages} 页，${progress.itemsSoFar.length} 条`);
      const resumeChoice = process.argv.includes('--no-resume') ? false : true;
      if (resumeChoice) {
        items = progress.itemsSoFar;
        startPage = progress.lastPage + 1;
        console.log(`  从第 ${startPage} 页继续...`);
      } else {
        console.log('  忽略断点，从头开始');
        clearProgress();
      }
    }
  }

  let currentPage = startPage;
  let totalPages = Infinity;

  console.log(`正在获取在线事项清单 (从第 ${currentPage} 页开始)...`);

  while (currentPage <= totalPages) {
    if (MAX_PAGES > 0 && currentPage > MAX_PAGES) {
      console.log(`  已达最大页数限制 (${MAX_PAGES})，停止获取`);
      break;
    }

    const body = new URLSearchParams({
      regionCode: PROVINCE_CODE,
      current: String(currentPage),
      pageSize: String(PAGE_SIZE),
    }).toString();

    const json = await fetchWithRetry(LIST_API, body);

    if (!json?.data?.data?.success) {
      const errMsg = json?.data?.data?.errorMsg || '未知错误';
      console.error(`  第 ${currentPage} 页获取失败: ${errMsg}`);

      // 保存进度以便续传
      saveProgress({
        startedAt: new Date().toISOString(),
        lastPage: currentPage - 1,
        totalPages,
        itemsSoFar: items,
      });
      console.log(`  已保存进度到 ${PROGRESS_FILE}`);
      console.log(`  下次运行将自动从第 ${currentPage} 页继续`);
      break;
    }

    const pageData = json.data.data.data;
    totalPages = pageData.totalPages;
    const list: OnlineItem[] = pageData.list || [];
    items.push(...list);

    // 每10页或首尾页输出进度
    if (currentPage % 10 === 0 || currentPage === startPage || currentPage === totalPages) {
      console.log(`  进度: ${currentPage}/${totalPages} 页，已获取 ${items.length}/${pageData.total} 条`);
    }

    // 每50页保存进度
    if (currentPage % 50 === 0) {
      saveProgress({
        startedAt: new Date().toISOString(),
        lastPage: currentPage,
        totalPages,
        itemsSoFar: items,
      });
    }

    currentPage++;

    if (currentPage <= totalPages) {
      await sleep(DELAY_MS);
    }
  }

  // 获取完成，清除进度文件
  if (currentPage > totalPages) {
    clearProgress();
  }

  console.log(`  完成，共获取 ${items.length} 条事项\n`);
  return items;
}

/**
 * 从数据库加载浙江省所有事项
 */
async function loadDbItems(): Promise<DbItem[]> {
  const items = await prisma.enforcementItem.findMany({
    where: { province: PROVINCE_CODE },
    select: {
      id: true,
      name: true,
      category: true,
      sourceId: true,
      itemStatus: true,
      enforcementBody: true,
    },
  });
  return items;
}

/**
 * 全量差异对比
 */
function computeDiff(
  onlineItems: OnlineItem[],
  dbItems: DbItem[],
): DiffReport {
  // 建立索引
  const onlineMap = new Map<string, OnlineItem>();
  for (const item of onlineItems) {
    onlineMap.set(item.id, item);
  }

  const dbBySourceId = new Map<string, DbItem>();
  const dbWithoutSourceId: DbItem[] = [];
  for (const item of dbItems) {
    if (item.sourceId) {
      dbBySourceId.set(item.sourceId, item);
    } else {
      dbWithoutSourceId.push(item);
    }
  }

  const entries: DiffEntry[] = [];
  let matched = 0;

  // 1. 在线有，数据库没有 → 新增
  for (const [sourceId, onlineItem] of Array.from(onlineMap.entries())) {
    if (!dbBySourceId.has(sourceId)) {
      entries.push({
        type: 'new_online',
        sourceId,
        onlineName: onlineItem.name,
        onlineCategory: getCategoryFromQlKind(onlineItem.qlKind),
      });
    }
  }

  // 2. 数据库有，在线没有 → 可能已删除
  for (const [sourceId, dbItem] of Array.from(dbBySourceId.entries())) {
    if (!onlineMap.has(sourceId)) {
      entries.push({
        type: 'removed_online',
        sourceId,
        dbName: dbItem.name,
        dbCategory: dbItem.category,
        dbId: dbItem.id,
        dbStatus: dbItem.itemStatus,
      });
    }
  }

  // 3. 两边都有 → 比较名称和类别
  for (const [sourceId, onlineItem] of Array.from(onlineMap.entries())) {
    const dbItem = dbBySourceId.get(sourceId);
    if (!dbItem) continue;

    const onlineCat = getCategoryFromQlKind(onlineItem.qlKind);

    if (dbItem.name !== onlineItem.name) {
      entries.push({
        type: 'name_mismatch',
        sourceId,
        onlineName: onlineItem.name,
        dbName: dbItem.name,
        dbId: dbItem.id,
      });
    }

    if (dbItem.category !== onlineCat) {
      entries.push({
        type: 'category_mismatch',
        sourceId,
        onlineName: onlineItem.name,
        onlineCategory: onlineCat,
        dbCategory: dbItem.category,
        dbId: dbItem.id,
      });
    }

    if (dbItem.name === onlineItem.name && dbItem.category === onlineCat) {
      matched++;
    }
  }

  // 类别分布统计
  const onlineCatStats: Record<string, number> = {};
  for (const item of onlineItems) {
    const cat = getCategoryFromQlKind(item.qlKind);
    onlineCatStats[cat] = (onlineCatStats[cat] || 0) + 1;
  }

  const dbCatStats: Record<string, number> = {};
  for (const item of dbItems) {
    dbCatStats[item.category] = (dbCatStats[item.category] || 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    onlineTotal: onlineItems.length,
    dbTotal: dbItems.length,
    dbWithSourceId: dbBySourceId.size,
    dbWithoutSourceId: dbWithoutSourceId.length,
    summary: {
      newOnline: entries.filter(e => e.type === 'new_online').length,
      removedOnline: entries.filter(e => e.type === 'removed_online').length,
      nameMismatch: entries.filter(e => e.type === 'name_mismatch').length,
      categoryMismatch: entries.filter(e => e.type === 'category_mismatch').length,
      matched,
    },
    categoryBreakdown: {
      online: onlineCatStats,
      db: dbCatStats,
    },
    entries,
  };
}

/**
 * 获取事项详情
 */
async function fetchMatterDetail(sourceId: string): Promise<any> {
  const body = new URLSearchParams({ qlInnerCode: sourceId }).toString();
  const json = await fetchWithRetry(DETAIL_API, body);
  if (!json?.data?.data?.success) return null;
  return json.data.data.data;
}

/**
 * 获取检查标准
 */
async function fetchCheckContent(sourceId: string): Promise<CheckContentItem[]> {
  const body = new URLSearchParams({
    qlInnerCode: sourceId,
    current: '1',
    pageSize: '200',
  }).toString();

  const json = await fetchWithRetry(CHECK_API, body);
  if (!json?.data?.data?.success) return [];
  return json.data.data.data?.dataList || [];
}

/**
 * 同步新增事项到数据库
 */
async function syncNewItems(
  entries: DiffEntry[],
  limit: number,
): Promise<{ synced: number; withStandards: number; totalStandards: number }> {
  let synced = 0;
  let withStandards = 0;
  let totalStandards = 0;

  const toSync = entries.slice(0, limit);
  console.log(`  计划同步 ${toSync.length} 条${limit < entries.length ? ` (限制为 ${limit})` : ''}`);

  for (let i = 0; i < toSync.length; i++) {
    const entry = toSync[i];
    const category = entry.onlineCategory || '未知';

    // 获取详情
    const detail = await fetchMatterDetail(entry.sourceId);
    await sleep(DELAY_MS);

    if (!detail) {
      console.log(`  [${i + 1}/${toSync.length}] 跳过 (详情获取失败): ${entry.onlineName}`);
      continue;
    }

    // 获取最大 sequenceNumber
    const maxSeq = await prisma.enforcementItem.aggregate({
      _max: { sequenceNumber: true },
    });
    const nextSeq = (maxSeq._max.sequenceNumber || 0) + 1;

    // 解析法律依据 HTML
    const lawText = detail.law
      ? detail.law
          .replace(/<[^>]+>/g, '\n')
          .replace(/\n{2,}/g, '\n')
          .replace(/<!--[^>]+-->/g, '')
          .trim()
      : null;

    // 创建事项
    const created = await prisma.enforcementItem.create({
      data: {
        sequenceNumber: nextSeq,
        name: entry.onlineName || detail.qlName || '',
        category,
        enforcementBody: detail.qlDep || null,
        legalBasisText: lawText,
        province: PROVINCE_CODE,
        sourceId: entry.sourceId,
        itemStatus: '生效',
      },
    });

    synced++;

    // 如果是行政检查，获取检查标准
    if (category === '行政检查') {
      const standards = await fetchCheckContent(entry.sourceId);
      await sleep(DELAY_MS);

      if (standards.length > 0) {
        await prisma.inspectionStandard.createMany({
          data: standards.map((s, idx) => ({
            enforcementItemId: created.id,
            sequenceNumber: idx + 1,
            checkItem: s.checkItem || '',
            checkContent: s.checkContent || '',
            checkOperate: s.checkOperate || null,
            law: s.law || null,
            contentLevel: s.contentLevel || null,
            checkType: s.checkType || null,
          })),
        });
        withStandards++;
        totalStandards += standards.length;
        console.log(`  [${i + 1}/${toSync.length}] 新增 [${category}] ${entry.onlineName} (+${standards.length} 检查标准)`);
      } else {
        console.log(`  [${i + 1}/${toSync.length}] 新增 [${category}] ${entry.onlineName} (无检查标准)`);
      }
    } else {
      console.log(`  [${i + 1}/${toSync.length}] 新增 [${category}] ${entry.onlineName}`);
    }
  }

  return { synced, withStandards, totalStandards };
}

/**
 * 标记停用事项
 */
async function markRemovedItems(entries: DiffEntry[]): Promise<number> {
  let marked = 0;

  for (const entry of entries) {
    // 跳过已标记停用的
    if (entry.dbStatus === '已停用') continue;

    const result = await prisma.enforcementItem.updateMany({
      where: {
        sourceId: entry.sourceId,
        province: PROVINCE_CODE,
        itemStatus: { not: '已停用' },
      },
      data: { itemStatus: '已停用' },
    });

    if (result.count > 0) {
      console.log(`  已停用: ${entry.dbName} (ID:${entry.dbId})`);
      marked += result.count;
    }
  }

  return marked;
}

/**
 * 更新名称不匹配的事项
 */
async function fixNameMismatches(entries: DiffEntry[]): Promise<number> {
  let fixed = 0;

  for (const entry of entries) {
    if (!entry.dbId || !entry.onlineName) continue;

    await prisma.enforcementItem.update({
      where: { id: entry.dbId },
      data: { name: entry.onlineName },
    });

    console.log(`  名称更新 (ID:${entry.dbId}): "${entry.dbName}" → "${entry.onlineName}"`);
    fixed++;
  }

  return fixed;
}

// === 主流程 ===

async function main() {
  console.log('=== 浙江省执法事项全量差异同步 ===\n');
  console.log(`模式: ${APPLY ? '全量对比并同步' : '全量对比（干运行）'}`);
  console.log(`延迟: ${DELAY_MS}ms`);
  if (MAX_ITEMS < Infinity) console.log(`最大同步条数: ${MAX_ITEMS}`);
  if (MAX_PAGES > 0) console.log(`最大获取页数: ${MAX_PAGES}`);
  if (RESUME_PAGE > 1) console.log(`从第 ${RESUME_PAGE} 页开始`);
  console.log();

  // Step 1: 获取在线事项清单
  const onlineItems = await fetchAllOnlineItems();

  if (onlineItems.length === 0) {
    console.error('未获取到任何在线事项，退出');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Step 2: 加载数据库事项
  console.log('加载数据库事项...');
  const dbItems = await loadDbItems();
  console.log(`  数据库浙江事项: ${dbItems.length}`);
  console.log(`  有 sourceId: ${dbItems.filter(i => i.sourceId).length}`);
  console.log(`  无 sourceId: ${dbItems.filter(i => !i.sourceId).length}`);
  console.log();

  // Step 3: 全量对比
  console.log('执行全量对比...');
  const diff = computeDiff(onlineItems, dbItems);

  // Step 4: 输出报告
  console.log('\n=== 对比结果 ===');
  console.log(`在线事项总数: ${diff.onlineTotal}`);
  console.log(`数据库事项总数: ${diff.dbTotal}`);
  console.log(`数据库有 sourceId: ${diff.dbWithSourceId}`);
  console.log(`数据库无 sourceId: ${diff.dbWithoutSourceId}`);
  console.log();

  console.log('--- 差异摘要 ---');
  console.log(`  在线新增（不在数据库）: ${diff.summary.newOnline}`);
  console.log(`  在线删除（不在网站）: ${diff.summary.removedOnline}`);
  console.log(`  名称不一致: ${diff.summary.nameMismatch}`);
  console.log(`  类别不一致: ${diff.summary.categoryMismatch}`);
  console.log(`  完全匹配: ${diff.summary.matched}`);
  console.log();

  // 类别分布对比
  console.log('--- 类别分布对比 ---');
  const allCategories = Array.from(new Set([
    ...Object.keys(diff.categoryBreakdown.online),
    ...Object.keys(diff.categoryBreakdown.db),
  ]));
  console.log(`  ${'类别'.padEnd(16)}  在线    数据库    差异`);
  console.log(`  ${'─'.repeat(16)}  ${'─'.repeat(6)}  ${'─'.repeat(6)}  ${'─'.repeat(6)}`);
  for (const cat of allCategories.sort()) {
    const online = diff.categoryBreakdown.online[cat] || 0;
    const db = diff.categoryBreakdown.db[cat] || 0;
    const delta = online - db;
    const deltaStr = delta > 0 ? `+${delta}` : delta === 0 ? '=' : String(delta);
    console.log(
      `  ${cat.padEnd(16)}  ${String(online).padStart(6)}  ${String(db).padStart(6)}  ${deltaStr.padStart(6)}`,
    );
  }
  console.log();

  // 详细差异列表
  if (diff.summary.newOnline > 0) {
    console.log('--- 在线新增事项 ---');
    const newEntries = diff.entries.filter(e => e.type === 'new_online');

    // 按类别分组
    const byCategory = new Map<string, DiffEntry[]>();
    for (const entry of newEntries) {
      const cat = entry.onlineCategory || '未知';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(entry);
    }

    for (const [cat, entries] of Array.from(byCategory.entries()).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  [${cat}] (${entries.length} 条):`);
      for (const entry of entries.slice(0, 5)) {
        console.log(`    - ${entry.onlineName}`);
      }
      if (entries.length > 5) {
        console.log(`    ... 等 ${entries.length - 5} 条`);
      }
    }
    console.log();
  }

  if (diff.summary.removedOnline > 0) {
    console.log('--- 在线已删除事项 ---');
    const removedEntries = diff.entries.filter(e => e.type === 'removed_online');
    for (const entry of removedEntries.slice(0, 10)) {
      const statusTag = entry.dbStatus === '已停用' ? ' [已标记停用]' : '';
      console.log(`  [${entry.dbCategory}] ${entry.dbName}${statusTag} (ID:${entry.dbId})`);
    }
    if (removedEntries.length > 10) {
      console.log(`  ... 等 ${removedEntries.length - 10} 条`);
    }
    console.log();
  }

  if (diff.summary.nameMismatch > 0) {
    console.log('--- 名称不一致 ---');
    const nameEntries = diff.entries.filter(e => e.type === 'name_mismatch');
    for (const entry of nameEntries.slice(0, 10)) {
      console.log(`  ID:${entry.dbId}:`);
      console.log(`    DB: "${entry.dbName}"`);
      console.log(`    在线: "${entry.onlineName}"`);
    }
    if (nameEntries.length > 10) {
      console.log(`  ... 等 ${nameEntries.length - 10} 条`);
    }
    console.log();
  }

  // 保存报告
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const reportPath = path.join(REPORT_DIR, `full-diff-${dateStr}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(diff, null, 2), 'utf-8');
  console.log(`差异报告已保存: ${reportPath}`);

  // Step 5: 同步（--apply 模式）
  if (!APPLY) {
    console.log('\n干运行完成。加 --apply 参数执行同步。');
    await prisma.$disconnect();
    return;
  }

  console.log('\n=== 执行同步 ===\n');

  // 5a: 同步新增事项
  const newEntries = diff.entries.filter(e => e.type === 'new_online');
  if (newEntries.length > 0) {
    console.log(`--- 新增 ${newEntries.length} 条事项 ---`);
    const result = await syncNewItems(newEntries, Math.min(MAX_ITEMS, newEntries.length));
    console.log(`  同步完成: ${result.synced} 条事项`);
    if (result.withStandards > 0) {
      console.log(`  含检查标准: ${result.withStandards} 条事项, ${result.totalStandards} 条标准`);
    }
    console.log();
  }

  // 5b: 标记停用事项
  const removedEntries = diff.entries.filter(
    e => e.type === 'removed_online' && e.dbStatus !== '已停用',
  );
  if (removedEntries.length > 0) {
    console.log(`--- 标记停用 ${removedEntries.length} 条事项 ---`);
    const marked = await markRemovedItems(removedEntries);
    console.log(`  已标记: ${marked} 条\n`);
  }

  // 5c: 修复名称不一致
  const nameEntries = diff.entries.filter(e => e.type === 'name_mismatch');
  if (nameEntries.length > 0) {
    console.log(`--- 修复名称不一致 ${nameEntries.length} 条 ---`);
    const fixed = await fixNameMismatches(nameEntries);
    console.log(`  已修复: ${fixed} 条\n`);
  }

  console.log('=== 同步完成 ===');

  // 最终统计
  const finalCount = await prisma.enforcementItem.count({
    where: { province: PROVINCE_CODE },
  });
  const finalActive = await prisma.enforcementItem.count({
    where: { province: PROVINCE_CODE, itemStatus: '生效' },
  });
  console.log(`\n最终统计:`);
  console.log(`  数据库浙江事项总数: ${finalCount}`);
  console.log(`  生效事项: ${finalActive}`);
  console.log(`  在线事项: ${diff.onlineTotal}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('致命错误:', e);
  process.exit(1);
});
