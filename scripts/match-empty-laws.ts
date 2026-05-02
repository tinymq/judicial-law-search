import { prisma } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

const srcDir = 'C:\\Users\\26371\\Documents\\MoSyncEcho\\Mo Laws 6255部';

async function main() {
  const files = fs.readdirSync(srcDir);

  const fileIndex: Record<string, string[]> = {};
  files.forEach(f => {
    const m = f.match(/^(.+?)\(\d{4}-\d{2}-\d{2}\)\.md$/);
    if (m) {
      const baseTitle = m[1].trim();
      if (!fileIndex[baseTitle]) fileIndex[baseTitle] = [];
      fileIndex[baseTitle].push(f);
    }
  });

  const laws = await prisma.law.findMany({
    include: { _count: { select: { articles: true } } }
  });

  const empty = laws.filter(l => l._count.articles === 0);

  let matched = 0, unmatched = 0;
  const unmatchedList: any[] = [];
  const matchedList: any[] = [];

  empty.forEach(l => {
    const baseTitle = l.title.replace(/\([12]\d{3}年(修订|修正|公布|修改|发布)\)/g, '').trim();

    if (fileIndex[baseTitle]) {
      matched++;
      matchedList.push({ id: l.id, title: l.title, file: fileIndex[baseTitle][0] });
    } else {
      unmatched++;
      unmatchedList.push({ id: l.id, title: baseTitle, region: l.region, level: l.level });
    }
  });

  console.log('=== 匹配结果 ===');
  console.log('有源文件:', matched, '部');
  console.log('无源文件:', unmatched, '部');
  console.log('');
  console.log('有源文件的前10部:');
  matchedList.slice(0, 10).forEach(m => console.log(`  [${m.id}] ${m.title} -> ${m.file}`));
  console.log('');
  console.log('无源文件按区域:');
  const byRegion: Record<string, number> = {};
  unmatchedList.forEach(m => { byRegion[m.region || '未知'] = (byRegion[m.region || '未知'] || 0) + 1; });
  Object.entries(byRegion).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => console.log(`  ${r}: ${c}部`));

  await prisma.$disconnect();
}

main();
