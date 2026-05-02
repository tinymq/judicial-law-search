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

  const laws = await prisma.law.findMany({ include: { _count: { select: { articles: true } } } });
  const empty = laws.filter(l => l._count.articles === 0);

  const matched = empty.filter(l => {
    const bt = l.title.replace(/\([12]\d{3}年(修订|修正|公布|修改|发布)\)/g, '').trim();
    return fileIndex[bt];
  });

  let hasContent = 0, noContent = 0;
  const withContentList: string[] = [];

  for (const l of matched) {
    const bt = l.title.replace(/\([12]\d{3}年(修订|修正|公布|修改|发布)\)/g, '').trim();
    const fname = fileIndex[bt]![0];
    const content = fs.readFileSync(path.join(srcDir, fname), 'utf-8');
    const afterInfo = content.split('<!-- INFO END -->')[1] || '';
    const textLines = afterInfo.trim().split('\n').filter(l => l.trim()).length;
    if (textLines > 2) {
      hasContent++;
      withContentList.push(`[${l.id}] ${l.title} -> ${fname} (${textLines} lines)`);
    } else {
      noContent++;
    }
  }

  console.log(`=== 151 部有源文件的空法规 ===`);
  console.log(`源文件有正文: ${hasContent} 部`);
  console.log(`源文件也是空的: ${noContent} 部`);

  if (withContentList.length > 0) {
    console.log('\n可导入的法规:');
    withContentList.forEach(s => console.log('  ' + s));
  }

  await prisma.$disconnect();
}

main();
