/**
 * Admin Laws page restructuring verification script
 * Tests all critical features after the refactor
 */

const BASE = 'http://localhost:3000/admin/laws';

type TestResult = { name: string; pass: boolean; detail: string };
const results: TestResult[] = [];

async function fetchPage(url: string): Promise<string> {
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.text();
}

function check(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${name} — ${detail}`);
}

async function testBasicLoad() {
  const html = await fetchPage(BASE);
  check('Basic page load', html.includes('法规管理'), 'Title in HTML');
  check('No LawSidebar', !html.includes('law-sidebar') && !html.includes('LawSidebar'), 'Sidebar removed');
  check('No MobileFilterPanel trigger', !html.includes('mobile-filter-panel'), 'Mobile filter panel removed');
  check('LawStatsCards present', html.includes('现行有效') && html.includes('已被修改'), 'Status cards rendered');
  check('LawFilterBar present', html.includes('搜索法规名称、制定机关、文号'), 'Filter bar search placeholder');
  check('Max width 1400px', html.includes('max-w-[1400px]'), 'Container width updated');
  check('bg-slate-50', html.includes('bg-slate-50'), 'Background color correct');
  check('No header search form', !html.includes('hidden sm:block flex-1 max-w-lg mx-6'), 'Header search removed');
  check('Pagination component', html.includes('上一页') || html.includes('下一页'), 'Pagination present');
  check('Footer toolbar', html.includes('拖拽列边框可调整宽度'), 'Footer toolbar preserved');
  check('Export button', html.includes('ExportButton') || html.includes('导出'), 'Export button in header');
  check('New law button', html.includes('录入新法规'), 'New law button in header');
  check('Feedback link', html.includes('反馈管理'), 'Feedback link in header');
}

async function testStatusFilter() {
  const html = await fetchPage(`${BASE}?status=现行有效`);
  check('Status filter applied', html.includes('已选'), 'Filter status bar shown');
  check('Status pill in bar', html.includes('现行有效'), 'Status name in filter');
  check('Reset link', html.includes('重置所有'), 'Reset all link present');
}

async function testLevelFilter() {
  const html = await fetchPage(`${BASE}?level=法律`);
  check('Level filter applied', html.includes('已选'), 'Filter status bar shown');
  check('Level pill', html.includes('法律'), 'Level name in filter');
}

async function testRegionFilter() {
  const html = await fetchPage(`${BASE}?region=全国`);
  check('Region filter applied', html.includes('已选') || html.includes('全国'), 'Region filter works');
}

async function testYearFilter() {
  const html = await fetchPage(`${BASE}?year=2024`);
  check('Year filter applied', html.includes('2024年'), 'Year pill in filter bar');
}

async function testIndustryFilter() {
  const html1 = await fetchPage(BASE);
  // Find an industry ID from the page
  const indMatch = html1.match(/industry=(\d+)/);
  if (indMatch) {
    const indId = indMatch[1];
    const html2 = await fetchPage(`${BASE}?industry=${indId}`);
    check('Industry filter applied', html2.includes('已选'), 'Industry filter status bar shown');
    check('Industry pill', html2.includes('行业') || html2.includes('bg-indigo-50'), 'Industry pill rendered');
  } else {
    check('Industry filter', false, 'No industry links found on page');
  }
}

async function testSearch() {
  const html = await fetchPage(`${BASE}?q=行政`);
  check('Search results', html.includes('条结果'), 'Result count displayed');
  check('Search query preserved', html.includes('搜: 行政'), 'Query shown in filter bar');
}

async function testSorting() {
  const html = await fetchPage(`${BASE}?sort=level&order=asc`);
  check('Sort param works', html.includes('条结果'), 'Page loads with sort param');
}

async function testPagination() {
  const html = await fetchPage(`${BASE}?page=2`);
  check('Page 2 loads', html.includes('条结果'), 'Page 2 returns results');
}

async function testPageSize() {
  const html = await fetchPage(`${BASE}?pageSize=100`);
  check('PageSize 100', html.includes('条结果'), 'PageSize param works');
}

async function testCombinedFilters() {
  const html = await fetchPage(`${BASE}?level=法律&status=现行有效&sort=level&order=asc`);
  check('Combined filters', html.includes('已选'), 'Multiple filters work together');
  check('Sort preserved with filters', html.includes('条结果'), 'Sort + filters coexist');
}

async function testColumnWidths() {
  const html = await fetchPage(BASE);
  check('Table min width updated', html.includes('1110px'), 'Table minWidth set to 1110px');
}

async function testNoOldPagination() {
  const html = await fetchPage(BASE);
  // Old pagination had 'bg-blue-600 text-white border-blue-600' specific style
  const hasOldPaginationStyle = html.includes('bg-blue-600 text-white border-blue-600');
  // New pagination uses 'bg-slate-800 text-white shadow-sm' style
  check('Old pagination removed', !hasOldPaginationStyle, 'Old inline pagination style not present');
}

async function main() {
  console.log('=== Admin Laws Page Restructure Tests ===\n');

  await testBasicLoad();
  console.log('');
  await testStatusFilter();
  console.log('');
  await testLevelFilter();
  console.log('');
  await testRegionFilter();
  console.log('');
  await testYearFilter();
  console.log('');
  await testIndustryFilter();
  console.log('');
  await testSearch();
  console.log('');
  await testSorting();
  console.log('');
  await testPagination();
  console.log('');
  await testPageSize();
  console.log('');
  await testCombinedFilters();
  console.log('');
  await testColumnWidths();
  console.log('');
  await testNoOldPagination();

  console.log('\n=== Summary ===');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.name}: ${r.detail}`));
  }
}

main().catch(console.error);
