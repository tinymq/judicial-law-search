/**
 * 按省份导出需人工处理的法规清单
 *
 * 导出湖南、海南、山东、江苏 4 省的：
 * 1. 无施行日期的法规
 * 2. 归入"其他"行业的法规
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { getAllowedRegionValues } from '../../src/lib/region-config';

const prisma = new PrismaClient();

const PROVINCES = ['湖南', '海南', '山东', '江苏'];

async function main() {
  const exportDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  const allowedRegions = getAllowedRegionValues();

  // 1. 无施行日期的法规（按省份）
  const noEffective = await prisma.law.findMany({
    where: {
      effectiveDate: null,
      OR: [
        { region: { in: allowedRegions } },
        { region: null },
      ],
    },
    select: { id: true, title: true, promulgationDate: true, issuingAuthority: true, level: true, region: true },
    orderBy: [{ region: 'asc' }, { id: 'asc' }],
  });

  let csv1 = 'ID,标题,公布日期,制定机关,效力位阶,区域\n';
  for (const law of noEffective) {
    const date = law.promulgationDate ? new Date(law.promulgationDate).toISOString().split('T')[0] : '';
    const title = (law.title || '').replace(/"/g, '""');
    const auth = (law.issuingAuthority || '').replace(/"/g, '""');
    csv1 += `${law.id},"${title}",${date},"${auth}",${law.level},${law.region || '全国'}\n`;
  }
  const file1 = path.join(exportDir, 'four-provinces-no-effective-date.csv');
  fs.writeFileSync(file1, '\uFEFF' + csv1);
  console.log(`无施行日期（4省+全国）: ${noEffective.length} 部 → ${file1}`);

  // 按省份统计
  const byProvince1: Record<string, number> = {};
  for (const law of noEffective) {
    const p = law.region || '全国';
    byProvince1[p] = (byProvince1[p] || 0) + 1;
  }
  // 汇总到省级
  const summary1: Record<string, number> = { '全国': 0 };
  for (const prov of PROVINCES) summary1[prov] = 0;
  for (const [region, count] of Object.entries(byProvince1)) {
    if (region === '全国' || !region) {
      summary1['全国'] += count;
    } else {
      const matched = PROVINCES.find(p => region.includes(p));
      if (matched) summary1[matched] = (summary1[matched] || 0) + count;
      else summary1['全国'] += count;
    }
  }
  console.log('  按省份:', JSON.stringify(summary1));

  // 2. 归入"其他"行业的法规（按省份）
  const otherIndustry = await prisma.law.findMany({
    where: {
      lawIndustries: {
        some: {
          industry: { name: '其他' },
        },
      },
      OR: [
        { region: { in: allowedRegions } },
        { region: null },
      ],
    },
    select: { id: true, title: true, issuingAuthority: true, level: true, region: true },
    orderBy: [{ region: 'asc' }, { id: 'asc' }],
  });

  let csv2 = 'ID,标题,制定机关,效力位阶,区域\n';
  for (const law of otherIndustry) {
    const title = (law.title || '').replace(/"/g, '""');
    const auth = (law.issuingAuthority || '').replace(/"/g, '""');
    csv2 += `${law.id},"${title}","${auth}",${law.level},${law.region || '全国'}\n`;
  }
  const file2 = path.join(exportDir, 'four-provinces-other-industry.csv');
  fs.writeFileSync(file2, '\uFEFF' + csv2);
  console.log(`\n"其他"行业（4省+全国）: ${otherIndustry.length} 部 → ${file2}`);

  // 按省份统计
  const summary2: Record<string, number> = { '全国': 0 };
  for (const prov of PROVINCES) summary2[prov] = 0;
  for (const law of otherIndustry) {
    const region = law.region || '全国';
    if (region === '全国' || !region) {
      summary2['全国']++;
    } else {
      const matched = PROVINCES.find(p => region.includes(p));
      if (matched) summary2[matched]++;
      else summary2['全国']++;
    }
  }
  console.log('  按省份:', JSON.stringify(summary2));

  console.log('\n已导出到 exports/ 目录');
}

main().catch(console.error).finally(() => prisma.$disconnect());
