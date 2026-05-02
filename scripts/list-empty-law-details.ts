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
      const bt = m[1].trim();
      if (!fileIndex[bt]) fileIndex[bt] = [];
      fileIndex[bt].push(f);
    }
  });

  const laws = await prisma.law.findMany({
    include: { _count: { select: { articles: true } } }
  });
  const empty = laws.filter(l => l._count.articles === 0);

  const emptySourceList: string[] = [];
  const noSourceList: string[] = [];

  for (const l of empty) {
    const bt = l.title.replace(/\([12]\d{3}年(修订|修正|公布|修改|发布)\)/g, '').trim();

    if (fileIndex[bt]) {
      const fname = fileIndex[bt][0];
      const content = fs.readFileSync(path.join(srcDir, fname), 'utf-8');
      const afterInfo = content.split('<!-- INFO END -->')[1] || '';
      const textLines = afterInfo.trim().split('\n').filter(l => l.trim()).length;
      if (textLines <= 2) {
        emptySourceList.push(`| ${l.id} | ${l.title} | ${l.level || ''} | ${l.region || ''} | ${fname} |`);
      }
    } else {
      noSourceList.push(`| ${l.id} | ${l.title} | ${l.level || ''} | ${l.region || ''} |`);
    }
  }

  console.log(`\n=== 有源文件但源文件也是空的（${emptySourceList.length} 部）===\n`);
  console.log('| ID | 标题 | 位阶 | 区域 | 源文件名 |');
  console.log('|:---:|------|------|------|----------|');
  emptySourceList.forEach(s => console.log(s));

  console.log(`\n=== 无匹配源文件（${noSourceList.length} 部）===\n`);
  console.log('| ID | 标题 | 位阶 | 区域 |');
  console.log('|:---:|------|------|------|');
  noSourceList.forEach(s => console.log(s));

  await prisma.$disconnect();
}

main();
