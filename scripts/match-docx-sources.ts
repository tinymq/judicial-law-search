import { prisma } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';

const srcDirs = [
  'C:\\Users\\26371\\Documents\\MoSyncEcho\\Mo Laws 法律法规\\法律',
  'C:\\Users\\26371\\Documents\\MoSyncEcho\\Mo Laws 法律法规\\江苏',
  'C:\\Users\\26371\\Documents\\MoSyncEcho\\Mo Laws 法律法规\\行政法规',
];

async function main() {
  const fileIndex: Record<string, { path: string; ext: string }[]> = {};

  for (const dir of srcDirs) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.startsWith('~$')) continue;
      const m = f.match(/^(.+?)_\d{8}\.(docx?|doc)$/);
      if (m) {
        const bt = m[1].trim();
        if (!fileIndex[bt]) fileIndex[bt] = [];
        fileIndex[bt].push({ path: path.join(dir, f), ext: m[2] });
      }
    }
  }

  const laws = await prisma.law.findMany({
    include: { _count: { select: { articles: true } } }
  });
  const empty = laws.filter(l => l._count.articles === 0);

  let matchDocx = 0, matchDoc = 0, noMatch = 0;
  const docxList: string[] = [];
  const docList: string[] = [];
  const noMatchList: string[] = [];

  for (const l of empty) {
    const bt = l.title.replace(/\([12]\d{3}年(修订|修正|公布|修改|发布)\)/g, '').trim();

    if (fileIndex[bt]) {
      const hasDocx = fileIndex[bt].some(f => f.ext === 'docx');
      if (hasDocx) {
        matchDocx++;
        const f = fileIndex[bt].find(f => f.ext === 'docx')!;
        docxList.push(`[${l.id}] ${l.title} -> ${path.basename(f.path)}`);
      } else {
        matchDoc++;
        docList.push(`[${l.id}] ${l.title} -> ${path.basename(fileIndex[bt][0].path)}`);
      }
    } else {
      noMatch++;
      noMatchList.push(`[${l.id}] ${bt} | region=${l.region} level=${l.level}`);
    }
  }

  console.log(`=== 匹配结果（${empty.length} 部空法规）===`);
  console.log(`匹配到 .docx: ${matchDocx} 部`);
  console.log(`匹配到 .doc:  ${matchDoc} 部`);
  console.log(`未匹配:       ${noMatch} 部`);

  if (docxList.length > 0) {
    console.log(`\n--- .docx 匹配（${docxList.length}）---`);
    docxList.forEach(s => console.log('  ' + s));
  }
  if (docList.length > 0) {
    console.log(`\n--- .doc 匹配（${docList.length}）---`);
    docList.forEach(s => console.log('  ' + s));
  }
  if (noMatchList.length > 0) {
    console.log(`\n--- 未匹配（${noMatchList.length}）---`);
    noMatchList.forEach(s => console.log('  ' + s));
  }

  await prisma.$disconnect();
}

main();
