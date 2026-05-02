import { prisma } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import { parseContent } from '../app/admin/utils/contentParser';

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

  let imported = 0, skipped = 0, failed = 0;
  const results: string[] = [];

  for (const law of empty) {
    const bt = law.title.replace(/\([12]\d{3}年(修订|修正|公布|修改|发布)\)/g, '').trim();
    if (!fileIndex[bt]) continue;

    const fname = fileIndex[bt][0];
    const content = fs.readFileSync(path.join(srcDir, fname), 'utf-8');
    const afterInfo = content.split('<!-- INFO END -->')[1] || '';
    const textLines = afterInfo.trim().split('\n').filter(l => l.trim()).length;
    if (textLines <= 2) {
      skipped++;
      continue;
    }

    try {
      const rawContent = afterInfo.trim();
      const { articles, preamble, detectedFormat } = parseContent(rawContent);

      if (articles.length === 0) {
        results.push(`[SKIP] [${law.id}] ${law.title} - 解析后无条款`);
        skipped++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.article.deleteMany({ where: { lawId: law.id } });

        if (preamble) {
          await tx.law.update({
            where: { id: law.id },
            data: {
              preamble,
              articleFormat: detectedFormat,
            }
          });
        } else if (detectedFormat !== 'standard') {
          await tx.law.update({
            where: { id: law.id },
            data: { articleFormat: detectedFormat }
          });
        }

        for (let i = 0; i < articles.length; i++) {
          const art = articles[i];
          await tx.article.create({
            data: {
              lawId: law.id,
              chapter: art.chapter || null,
              section: art.section || null,
              title: art.title,
              order: i + 1,
              paragraphs: art.paragraphs && art.paragraphs.length > 0
                ? {
                    create: art.paragraphs.map((para) => ({
                      number: para.number,
                      content: para.content || null,
                      order: para.order,
                      items: para.items && para.items.length > 0
                        ? {
                            create: para.items.map((item) => ({
                              number: item.number,
                              content: item.content,
                              order: item.order,
                            }))
                          }
                        : undefined,
                    }))
                  }
                : undefined,
            }
          });
        }
      }, { maxWait: 10000, timeout: 120000 });

      imported++;
      results.push(`[OK] [${law.id}] ${law.title} -> ${articles.length} 条 (${detectedFormat})`);
    } catch (err: any) {
      failed++;
      results.push(`[FAIL] [${law.id}] ${law.title} - ${err.message}`);
    }
  }

  console.log('\n=== 批量导入结果 ===');
  console.log(`成功导入: ${imported} 部`);
  console.log(`跳过(无内容/无条款): ${skipped} 部`);
  console.log(`失败: ${failed} 部`);
  console.log('\n详细:');
  results.forEach(r => console.log('  ' + r));

  await prisma.$disconnect();
}

main();
