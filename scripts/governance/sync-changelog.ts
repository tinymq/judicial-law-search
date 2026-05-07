/**
 * 权责清单变更日志同步脚本 - 方案C：定期增量同步
 *
 * 策略：由于浙江政务服务网的"权责清单调整情况"API (getTJItemAreaInfo) 需要认证参数，
 * 无法直接调用。本脚本采用 **差量检测法**：定期与 full-diff-sync 的快照对比，
 * 检测新增/删除/变更的事项，并生成变更日志。
 *
 * 工作流程：
 *   1. 调用 getDepartmentMatterPageList API 获取当前在线事项清单的摘要
 *   2. 与上次快照（JSON 文件）对比，生成变更日志
 *   3. 新变更项与数据库交叉比对，识别需同步的事项
 *   4. --apply 模式下执行同步（新增事项入库、获取检查标准等）
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
 *   npx tsx scripts/governance/sync-changelog.ts                    # 检测变更（干运行）
 *   npx tsx scripts/governance/sync-changelog.ts --apply            # 检测并同步变更
 *   npx tsx scripts/governance/sync-changelog.ts --snapshot-only    # 仅生成当前快照
 *   npx tsx scripts/governance/sync-changelog.ts --since 2026-04-01 # 自定义基准日期
 *
 * 环境变量：
 *   DELAY_MS=1500        请求间隔（毫秒，默认1500）
 *   MAX_PAGES=0          最大页数（0=不限，默认0）
 *   SNAPSHOT_DIR=path    快照存放目录
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// === 配置 ===
const APPLY = process.argv.includes('--apply');
const SNAPSHOT_ONLY = process.argv.includes('--snapshot-only');
const DELAY_MS = parseInt(process.env.DELAY_MS || '1500');
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '0');
const PAGE_SIZE = 50; // API 最大限制
const PROVINCE_CODE = '330000';
const BASE_URL = 'https://www.zjzwfw.gov.cn/jpaas-zjservice-server/open-api/department';
const LIST_API = `${BASE_URL}/getDepartmentMatterPageList`;
const DETAIL_API = `${BASE_URL}/getMatterDetail`;
const CHECK_API = `${BASE_URL}/getCheckContent`;

const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR
  || path.join(__dirname, 'reports', 'snapshots');

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
  qlKind: string;    // 类别代码
  qlCode: string;    // 权力代码
  isLeaf: string;
  isOnline: string;
}

interface Snapshot {
  timestamp: string;
  total: number;
  items: OnlineItem[];
}

interface ChangeEntry {
  type: 'added' | 'removed' | 'modified';
  sourceId: string;
  name: string;
  category: string;
  detail?: string;
}

interface ChangeReport {
  generatedAt: string;
  baseSnapshot: string;
  currentSnapshot: string;
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
  changes: ChangeEntry[];
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
        console.log('  频率限制，等待 10s...');
        await sleep(10000);
        continue;
      }

      if (!res.ok) {
        console.log(`  HTTP ${res.status}`);
        if (attempt < retries - 1) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        return null;
      }

      const json = await res.json();
      return json;
    } catch (e: any) {
      if (attempt < retries - 1) {
        console.log(`  网络错误 (attempt ${attempt + 1}): ${e.message}`);
        await sleep(2000 * (attempt + 1));
        continue;
      }
      console.log(`  网络错误: ${e.message}`);
      return null;
    }
  }
  return null;
}

// === 核心功能 ===

/**
 * 从 API 获取全部在线事项列表
 */
async function fetchAllOnlineItems(): Promise<OnlineItem[]> {
  const items: OnlineItem[] = [];
  let currentPage = 1;
  let totalPages = Infinity;

  console.log('正在获取在线事项清单...');

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
      console.error(`  第 ${currentPage} 页获取失败:`, json?.data?.data?.errorMsg || '未知错误');
      break;
    }

    const pageData = json.data.data.data;
    totalPages = pageData.totalPages;
    const list: OnlineItem[] = pageData.list || [];
    items.push(...list);

    if (currentPage % 20 === 0 || currentPage === 1) {
      console.log(`  进度: ${currentPage}/${totalPages} 页，已获取 ${items.length} 条`);
    }

    currentPage++;

    if (currentPage <= totalPages) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`  完成，共获取 ${items.length} 条事项`);
  return items;
}

/**
 * 保存快照
 */
function saveSnapshot(items: OnlineItem[]): string {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const filename = `snapshot-${dateStr}.json`;
  const filepath = path.join(SNAPSHOT_DIR, filename);

  const snapshot: Snapshot = {
    timestamp: now.toISOString(),
    total: items.length,
    items,
  };

  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`快照已保存: ${filepath}`);
  return filepath;
}

/**
 * 加载最新快照（排除当前正在生成的）
 */
function loadLatestSnapshot(excludeFile?: string): Snapshot | null {
  if (!fs.existsSync(SNAPSHOT_DIR)) return null;

  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
    .sort()
    .reverse();

  for (const file of files) {
    const filepath = path.join(SNAPSHOT_DIR, file);
    if (excludeFile && filepath === excludeFile) continue;
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(content) as Snapshot;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 对比两个快照，生成变更记录
 */
function diffSnapshots(
  base: Snapshot,
  current: Snapshot,
): ChangeReport {
  const baseMap = new Map(base.items.map(i => [i.id, i]));
  const currentMap = new Map(current.items.map(i => [i.id, i]));

  const changes: ChangeEntry[] = [];
  let unchanged = 0;

  // 检测新增项
  for (const [id, item] of Array.from(currentMap.entries())) {
    if (!baseMap.has(id)) {
      changes.push({
        type: 'added',
        sourceId: id,
        name: item.name,
        category: QL_KIND_MAP[item.qlKind] || `未知(${item.qlKind})`,
      });
    }
  }

  // 检测删除项
  for (const [id, item] of Array.from(baseMap.entries())) {
    if (!currentMap.has(id)) {
      changes.push({
        type: 'removed',
        sourceId: id,
        name: item.name,
        category: QL_KIND_MAP[item.qlKind] || `未知(${item.qlKind})`,
      });
    }
  }

  // 检测修改项（名称或类别变化）
  for (const [id, currentItem] of Array.from(currentMap.entries())) {
    const baseItem = baseMap.get(id);
    if (!baseItem) continue;

    const diffs: string[] = [];
    if (baseItem.name !== currentItem.name) {
      diffs.push(`名称: "${baseItem.name}" → "${currentItem.name}"`);
    }
    if (baseItem.qlKind !== currentItem.qlKind) {
      diffs.push(`类别: ${baseItem.qlKind} → ${currentItem.qlKind}`);
    }
    if (baseItem.qlCode !== currentItem.qlCode) {
      diffs.push(`权力代码: ${baseItem.qlCode} → ${currentItem.qlCode}`);
    }
    if (baseItem.isOnline !== currentItem.isOnline) {
      diffs.push(`上线状态: ${baseItem.isOnline} → ${currentItem.isOnline}`);
    }

    if (diffs.length > 0) {
      changes.push({
        type: 'modified',
        sourceId: id,
        name: currentItem.name,
        category: QL_KIND_MAP[currentItem.qlKind] || `未知(${currentItem.qlKind})`,
        detail: diffs.join('; '),
      });
    } else {
      unchanged++;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    baseSnapshot: base.timestamp,
    currentSnapshot: current.timestamp,
    summary: {
      added: changes.filter(c => c.type === 'added').length,
      removed: changes.filter(c => c.type === 'removed').length,
      modified: changes.filter(c => c.type === 'modified').length,
      unchanged,
    },
    changes,
  };
}

/**
 * 与数据库交叉比对，识别需要同步的变更
 */
async function crossReferenceWithDB(
  report: ChangeReport,
): Promise<{
  newToDb: ChangeEntry[];
  alreadyInDb: ChangeEntry[];
  removedFromDb: ChangeEntry[];
  modifiedInDb: ChangeEntry[];
}> {
  const addedIds = report.changes
    .filter(c => c.type === 'added')
    .map(c => c.sourceId);
  const removedIds = report.changes
    .filter(c => c.type === 'removed')
    .map(c => c.sourceId);

  // 检查新增项哪些已在数据库中
  const existingAdded = addedIds.length > 0
    ? await prisma.enforcementItem.findMany({
        where: { sourceId: { in: addedIds }, province: PROVINCE_CODE },
        select: { sourceId: true },
      })
    : [];
  const existingAddedSet = new Set(existingAdded.map(i => i.sourceId));

  // 检查删除项哪些在数据库中
  const existingRemoved = removedIds.length > 0
    ? await prisma.enforcementItem.findMany({
        where: { sourceId: { in: removedIds }, province: PROVINCE_CODE },
        select: { sourceId: true, itemStatus: true },
      })
    : [];
  const existingRemovedSet = new Set(existingRemoved.map(i => i.sourceId));

  const newToDb = report.changes.filter(
    c => c.type === 'added' && !existingAddedSet.has(c.sourceId),
  );
  const alreadyInDb = report.changes.filter(
    c => c.type === 'added' && existingAddedSet.has(c.sourceId),
  );
  const removedFromDb = report.changes.filter(
    c => c.type === 'removed' && existingRemovedSet.has(c.sourceId),
  );
  const modifiedInDb = report.changes.filter(c => c.type === 'modified');

  return { newToDb, alreadyInDb, removedFromDb, modifiedInDb };
}

/**
 * 获取事项详情
 */
async function fetchMatterDetail(sourceId: string): Promise<any> {
  const body = new URLSearchParams({ qlInnerCode: sourceId }).toString();
  const json = await fetchWithRetry(DETAIL_API, body);

  if (!json?.data?.data?.success) {
    return null;
  }
  return json.data.data.data;
}

/**
 * 获取检查标准
 */
async function fetchCheckContent(sourceId: string): Promise<any[]> {
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
async function syncNewItems(items: ChangeEntry[]): Promise<number> {
  let synced = 0;

  for (const item of items) {
    console.log(`  同步新增: ${item.name} (${item.sourceId})`);

    // 获取详情
    const detail = await fetchMatterDetail(item.sourceId);
    await sleep(DELAY_MS);

    if (!detail) {
      console.log(`    详情获取失败，跳过`);
      continue;
    }

    // 获取最大 sequenceNumber
    const maxSeq = await prisma.enforcementItem.aggregate({
      _max: { sequenceNumber: true },
    });
    const nextSeq = (maxSeq._max.sequenceNumber || 0) + 1;

    // 创建事项（item.category 已经是解析后的名称，如"行政检查"）
    const category = item.category;
    const created = await prisma.enforcementItem.create({
      data: {
        sequenceNumber: nextSeq,
        name: item.name,
        category,
        enforcementBody: detail.qlDep || null,
        legalBasisText: detail.law || null,
        province: PROVINCE_CODE,
        sourceId: item.sourceId,
        itemStatus: '生效',
      },
    });

    // 如果是行政检查，获取检查标准
    if (category === '行政检查') {
      const standards = await fetchCheckContent(item.sourceId);
      await sleep(DELAY_MS);

      if (standards.length > 0) {
        await prisma.inspectionStandard.createMany({
          data: standards.map((s: any, idx: number) => ({
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
        console.log(`    已获取 ${standards.length} 条检查标准`);
      }
    }

    synced++;
  }

  return synced;
}

/**
 * 标记已停用事项
 */
async function markRemovedItems(items: ChangeEntry[]): Promise<number> {
  let marked = 0;

  for (const item of items) {
    const result = await prisma.enforcementItem.updateMany({
      where: {
        sourceId: item.sourceId,
        province: PROVINCE_CODE,
        itemStatus: { not: '已停用' },
      },
      data: { itemStatus: '已停用' },
    });

    if (result.count > 0) {
      console.log(`  已停用: ${item.name} (${item.sourceId})`);
      marked += result.count;
    }
  }

  return marked;
}

// === 主流程 ===

async function main() {
  console.log('=== 权责清单变更日志同步 ===\n');
  console.log(`模式: ${APPLY ? '同步写库' : SNAPSHOT_ONLY ? '仅生成快照' : '干运行（检测变更）'}`);
  console.log(`延迟: ${DELAY_MS}ms`);
  if (MAX_PAGES > 0) console.log(`最大页数: ${MAX_PAGES}`);
  console.log();

  // Step 1: 获取在线事项清单
  const onlineItems = await fetchAllOnlineItems();

  if (onlineItems.length === 0) {
    console.error('未获取到任何在线事项，退出');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Step 2: 保存当前快照
  const snapshotPath = saveSnapshot(onlineItems);
  console.log();

  if (SNAPSHOT_ONLY) {
    console.log('仅生成快照模式，完成。');
    await prisma.$disconnect();
    return;
  }

  // Step 3: 加载上次快照
  const baseSnapshot = loadLatestSnapshot(snapshotPath);

  if (!baseSnapshot) {
    console.log('未找到历史快照，这是首次运行。');
    console.log('已生成当前快照，下次运行将进行差量对比。');
    console.log();

    // 首次运行时直接与数据库对比
    console.log('--- 与数据库对比 ---');
    const dbItems = await prisma.enforcementItem.findMany({
      where: { province: PROVINCE_CODE, sourceId: { not: null } },
      select: { sourceId: true },
    });
    const dbSourceIds = new Set(dbItems.map(i => i.sourceId));
    const onlineIds = new Set(onlineItems.map(i => i.id));

    const notInDb = onlineItems.filter(i => !dbSourceIds.has(i.id));
    const notOnline = dbItems.filter(i => !onlineIds.has(i.sourceId!));

    console.log(`在线事项: ${onlineItems.length}`);
    console.log(`数据库事项（有sourceId）: ${dbItems.length}`);
    console.log(`在线但不在数据库: ${notInDb.length}`);
    console.log(`在数据库但不在线: ${notOnline.length}`);

    if (notInDb.length > 0) {
      console.log('\n新增事项示例（前10条）:');
      for (const item of notInDb.slice(0, 10)) {
        const cat = QL_KIND_MAP[item.qlKind] || item.qlKind;
        console.log(`  [${cat}] ${item.name} (${item.id})`);
      }
    }

    await prisma.$disconnect();
    return;
  }

  // Step 4: 差量对比
  console.log(`基准快照: ${baseSnapshot.timestamp} (${baseSnapshot.total} 条)`);
  console.log();

  const currentSnapshot: Snapshot = {
    timestamp: new Date().toISOString(),
    total: onlineItems.length,
    items: onlineItems,
  };

  const report = diffSnapshots(baseSnapshot, currentSnapshot);

  // Step 5: 输出变更报告
  console.log('=== 变更摘要 ===');
  console.log(`  新增: ${report.summary.added}`);
  console.log(`  删除: ${report.summary.removed}`);
  console.log(`  修改: ${report.summary.modified}`);
  console.log(`  无变化: ${report.summary.unchanged}`);
  console.log();

  if (report.changes.length === 0) {
    console.log('无变更，退出。');
    await prisma.$disconnect();
    return;
  }

  // 输出详细变更
  if (report.summary.added > 0) {
    console.log('--- 新增事项 ---');
    for (const c of report.changes.filter(c => c.type === 'added').slice(0, 20)) {
      console.log(`  [${c.category}] ${c.name}`);
    }
    if (report.summary.added > 20) {
      console.log(`  ... 等 ${report.summary.added - 20} 条`);
    }
    console.log();
  }

  if (report.summary.removed > 0) {
    console.log('--- 删除事项 ---');
    for (const c of report.changes.filter(c => c.type === 'removed').slice(0, 20)) {
      console.log(`  [${c.category}] ${c.name}`);
    }
    if (report.summary.removed > 20) {
      console.log(`  ... 等 ${report.summary.removed - 20} 条`);
    }
    console.log();
  }

  if (report.summary.modified > 0) {
    console.log('--- 修改事项 ---');
    for (const c of report.changes.filter(c => c.type === 'modified').slice(0, 20)) {
      console.log(`  ${c.name}: ${c.detail}`);
    }
    if (report.summary.modified > 20) {
      console.log(`  ... 等 ${report.summary.modified - 20} 条`);
    }
    console.log();
  }

  // Step 6: 与数据库交叉比对
  console.log('--- 数据库交叉比对 ---');
  const dbComparison = await crossReferenceWithDB(report);
  console.log(`  需新增入库: ${dbComparison.newToDb.length}`);
  console.log(`  已在数据库: ${dbComparison.alreadyInDb.length}`);
  console.log(`  需标记停用: ${dbComparison.removedFromDb.length}`);
  console.log(`  需更新: ${dbComparison.modifiedInDb.length}`);
  console.log();

  // 保存变更报告
  const reportPath = path.join(
    SNAPSHOT_DIR,
    `changelog-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`变更报告已保存: ${reportPath}`);

  // Step 7: 同步（--apply 模式）
  if (!APPLY) {
    console.log('\n干运行完成。加 --apply 参数执行同步。');
    await prisma.$disconnect();
    return;
  }

  console.log('\n=== 执行同步 ===');

  if (dbComparison.newToDb.length > 0) {
    console.log(`\n--- 新增 ${dbComparison.newToDb.length} 条事项 ---`);
    const synced = await syncNewItems(dbComparison.newToDb);
    console.log(`  已同步: ${synced} 条`);
  }

  if (dbComparison.removedFromDb.length > 0) {
    console.log(`\n--- 标记停用 ${dbComparison.removedFromDb.length} 条事项 ---`);
    const marked = await markRemovedItems(dbComparison.removedFromDb);
    console.log(`  已标记: ${marked} 条`);
  }

  console.log('\n同步完成！');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('致命错误:', e);
  process.exit(1);
});
