import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const exportDir = path.join(process.cwd(), 'exports');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

  // 1. 无施行日期的法规清单
  const noEffective = await prisma.law.findMany({
    where: { effectiveDate: null },
    select: { id: true, title: true, promulgationDate: true, issuingAuthority: true, level: true, region: true },
    orderBy: { id: 'asc' },
  });

  let csv1 = 'ID,标题,公布日期,制定机关,效力位阶,区域\n';
  for (const law of noEffective) {
    const date = law.promulgationDate ? new Date(law.promulgationDate).toISOString().split('T')[0] : '';
    const title = (law.title || '').replace(/"/g, '""');
    const auth = (law.issuingAuthority || '').replace(/"/g, '""');
    csv1 += `${law.id},"${title}",${date},"${auth}",${law.level},${law.region || ''}\n`;
  }
  fs.writeFileSync(path.join(exportDir, 'laws-no-effective-date.csv'), '\uFEFF' + csv1);
  console.log('无施行日期:', noEffective.length, '部');

  // 2. 归入"其他"行业的法规清单
  const otherIndustry = await prisma.law.findMany({
    where: {
      lawIndustries: {
        some: {
          industry: { name: '其他' },
        },
      },
    },
    select: { id: true, title: true, issuingAuthority: true, level: true, region: true },
    orderBy: { id: 'asc' },
  });

  let csv2 = 'ID,标题,制定机关,效力位阶,区域\n';
  for (const law of otherIndustry) {
    const title = (law.title || '').replace(/"/g, '""');
    const auth = (law.issuingAuthority || '').replace(/"/g, '""');
    csv2 += `${law.id},"${title}","${auth}",${law.level},${law.region || ''}\n`;
  }
  fs.writeFileSync(path.join(exportDir, 'laws-other-industry.csv'), '\uFEFF' + csv2);
  console.log('其他行业:', otherIndustry.length, '部');

  console.log('已导出到 exports/ 目录');
}

main().catch(console.error).finally(() => prisma.$disconnect());
