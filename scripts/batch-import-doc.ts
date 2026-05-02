import { prisma } from '../src/lib/db';
import { parseContent } from '../app/admin/utils/contentParser';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const srcDirs = [
  'C:\\Users\\26371\\Documents\\MoSyncEcho\\Mo Laws 法律法规\\法律',
  'C:\\Users\\26371\\Documents\\MoSyncEcho\\Mo Laws 法律法规\\江苏',
  'C:\\Users\\26371\\Documents\\MoSyncEcho\\Mo Laws 法律法规\\行政法规',
];

function buildFileIndex() {
  const fileIndex: Record<string, { path: string; ext: string }[]> = {};
  for (const dir of srcDirs) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.startsWith('~$')) continue;
      const m = f.match(/^(.+?)_\d{8}\.(docx?)$/);
      if (m) {
        const bt = m[1].trim();
        if (!fileIndex[bt]) fileIndex[bt] = [];
        fileIndex[bt].push({ path: path.join(dir, f), ext: m[2] });
      }
    }
  }
  return fileIndex;
}

function stripTitle(rawText: string, lawTitle: string): string {
  let text = rawText.replace(/​/g, '').trim();
  const lines = text.split('\n');
  let startIdx = 0;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const trimmed = lines[i].trim();
    if (/^[（(]\d{4}年/.test(trimmed)) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === 0) {
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const trimmed = lines[i].trim();
      if (/^第[零一二三四五六七八九十百千0-9]+条/.test(trimmed) ||
          /^[一二三四五六七八九十]+、/.test(trimmed)) {
        startIdx = i;
        break;
      }
    }
  }

  return lines.slice(startIdx).join('\n').trim();
}

function extractDocText(filePath: string): string {
  const tmpDir = path.join(process.env.TEMP || 'C:\\Temp', 'doc-extract');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const outFile = path.join(tmpDir, `doc_text_${Date.now()}.txt`);

  const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
  $doc = $word.Documents.Open('${filePath.replace(/'/g, "''")}', $false, $true)
  $text = $doc.Content.Text
  $doc.Close($false)
  [System.IO.File]::WriteAllText('${outFile.replace(/'/g, "''")}', $text, [System.Text.Encoding]::UTF8)
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
`;
  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

  try {
    execSync(
      `powershell -NoProfile -EncodedCommand ${encoded}`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 60000 }
    );
    const text = fs.readFileSync(outFile, 'utf8');
    return text;
  } finally {
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  }
}

async function main() {
  const fileIndex = buildFileIndex();

  const laws = await prisma.law.findMany({
    include: { _count: { select: { articles: true } } }
  });
  const empty = laws.filter(l => l._count.articles === 0);

  let imported = 0, skipped = 0, failed = 0;
  const results: string[] = [];

  for (const law of empty) {
    const bt = law.title.replace(/\([12]\d{3}年(修订|修正|公布|修改|发布)\)/g, '').trim();
    if (!fileIndex[bt]) continue;

    const docFile = fileIndex[bt].find(f => f.ext === 'doc');
    const hasDocx = fileIndex[bt].some(f => f.ext === 'docx');
    if (!docFile || hasDocx) continue;

    try {
      const rawText = extractDocText(docFile.path).replace(/\r\n?/g, '\n');
      const content = stripTitle(rawText, law.title);

      if (content.length < 20) {
        results.push(`[SKIP] [${law.id}] ${law.title} - 内容太短(${content.length}字)`);
        skipped++;
        continue;
      }

      const { articles, preamble, detectedFormat } = parseContent(content);

      if (articles.length === 0) {
        results.push(`[SKIP] [${law.id}] ${law.title} - 解析后无条款`);
        skipped++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.article.deleteMany({ where: { lawId: law.id } });

        const updateData: any = {};
        if (preamble) updateData.preamble = preamble;
        if (detectedFormat !== 'standard') updateData.articleFormat = detectedFormat;
        if (Object.keys(updateData).length > 0) {
          await tx.law.update({ where: { id: law.id }, data: updateData });
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
      results.push(`[OK] [${law.id}] ${law.title} -> ${articles.length}条 (${detectedFormat}) preamble=${preamble ? preamble.length + '字' : '无'}`);
    } catch (err: any) {
      failed++;
      results.push(`[FAIL] [${law.id}] ${law.title} - ${err.message.substring(0, 200)}`);
    }
  }

  console.log('\n=== .doc 批量导入结果 ===');
  console.log(`成功: ${imported} 部`);
  console.log(`跳过: ${skipped} 部`);
  console.log(`失败: ${failed} 部`);
  console.log('\n详细:');
  results.forEach(r => console.log('  ' + r));

  await prisma.$disconnect();
}

main();
