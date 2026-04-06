/**
 * 批量导入 Markdown 格式法规
 * 数据源：C:\Users\26371\Documents\EchoSyncMo\Mo Laws 6255部
 *
 * 用法:
 *   npx tsx scripts/import-md-laws.ts              # 预览模式（不写入数据库）
 *   npx tsx scripts/import-md-laws.ts --execute     # 执行导入
 *   npx tsx scripts/import-md-laws.ts --execute --skip-existing  # 跳过已存在的
 *   npx tsx scripts/import-md-laws.ts --limit 10    # 只处理前10个文件
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// 复用现有解析器（直接内联关键函数，避免导入问题）
// 来自 app/admin/utils/contentParser.ts

const prisma = new PrismaClient();

const SOURCE_DIR = 'C:\\Users\\26371\\Documents\\EchoSyncMo\\Mo Laws 6255部';

// ==================== 解析函数 ====================

/** 从文件名提取标题和日期 */
function parseFilename(filename: string): { title: string; date: string | null } {
  const base = path.basename(filename, '.md');
  const match = base.match(/^(.+?)\((\d{4}-\d{2}-\d{2})\)$/);
  if (match) {
    return { title: match[1], date: match[2] };
  }
  return { title: base, date: null };
}

/** 解析 .md 文件内容 */
function parseMdFile(content: string): {
  title: string;
  metadata: string;
  body: string;
} {
  const lines = content.split('\n');

  // 提取标题（第一个 # 行）
  let title = '';
  let titleLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      title = line.replace(/^#\s+/, '').trim();
      titleLineIndex = i;
      break;
    }
  }

  // 查找 <!-- INFO END -->
  let infoEndIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<!-- INFO END -->')) {
      infoEndIndex = i;
      break;
    }
  }

  let metadata = '';
  let body = '';

  if (infoEndIndex >= 0) {
    // 元数据：标题行到 INFO END 之间
    metadata = lines.slice(titleLineIndex + 1, infoEndIndex).join('\n').trim();
    // 正文：INFO END 之后
    body = lines.slice(infoEndIndex + 1).join('\n').trim();
  } else {
    // 没有 INFO END 标记，全部作为正文
    body = lines.slice(titleLineIndex + 1).join('\n').trim();
  }

  return { title, metadata, body };
}

/** 从元数据提取通过日期（取最后一个日期作为最新修订日期） */
function extractDatesFromMetadata(metadata: string): {
  promulgationDate: string | null;
  issuingAuthority: string | null;
} {
  if (!metadata) return { promulgationDate: null, issuingAuthority: null };

  // 提取所有年月日格式的日期
  const dateMatches = metadata.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/g);
  let promulgationDate: string | null = null;

  if (dateMatches && dateMatches.length > 0) {
    // 取最后一个日期（通常是最新修订日期）
    const lastDate = dateMatches[dateMatches.length - 1];
    const m = lastDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (m) {
      promulgationDate = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
  }

  // 尝试提取制定机关
  let issuingAuthority: string | null = null;
  // 常见模式：XX通过、XX公布、XX发布
  const authorityMatch = metadata.match(/([\u4e00-\u9fa5]+(?:常务委员会|人民代表大会|国务院|人民政府|委员会))/);
  if (authorityMatch) {
    issuingAuthority = authorityMatch[1];
  }

  return { promulgationDate, issuingAuthority };
}

/** 将 Markdown 正文转换为纯文本（供 parseContent 使用） */
function mdToPlainText(body: string): string {
  return body
    // ## 第一章 总则 → 第一章 总则
    .replace(/^##\s+/gm, '')
    // 去掉其他 markdown 格式
    .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')      // *italic* → italic
    .trim();
}

/** 从标题检测区域 */
function detectRegion(title: string): string {
  if (!title) return '全国';

  // 省份前缀匹配
  const provincePatterns = [
    '北京', '上海', '天津', '重庆',
    '河北', '山西', '辽宁', '吉林', '黑龙江',
    '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '海南',
    '四川', '贵州', '云南', '陕西', '甘肃', '青海',
    '内蒙古', '广西', '西藏', '宁夏', '新疆',
  ];

  // 特殊区域前缀
  const specialPrefixes = [
    { prefix: '海南经济特区', region: '海南' },
    { prefix: '海南自由贸易港', region: '海南' },
    { prefix: '深圳经济特区', region: '广东' },
    { prefix: '厦门经济特区', region: '福建' },
    { prefix: '珠海经济特区', region: '广东' },
  ];

  for (const { prefix, region } of specialPrefixes) {
    if (title.startsWith(prefix)) return region;
  }

  for (const province of provincePatterns) {
    if (title.startsWith(province)) return province;
  }

  // 城市前缀：XX市YYY条例
  const cityMatch = title.match(/^([\u4e00-\u9fa5]{2,4})市/);
  if (cityMatch) {
    // 判断是哪个省的城市（简单映射，不完整但够用）
    return cityMatch[1];
  }

  // 自治州/自治县
  const autoMatch = title.match(/^([\u4e00-\u9fa5]+(?:自治州|自治县))/);
  if (autoMatch) {
    return autoMatch[1];
  }

  return '全国';
}

/** 从标题/内容推断效力位阶 */
function detectLevel(title: string, issuingAuthority: string | null): string {
  // 中华人民共和国XX法 → 法律
  if (title.startsWith('中华人民共和国') && title.endsWith('法')) return '法律';
  if (title.match(/^中华人民共和国.*法$/)) return '法律';

  // XX条例（国务院）→ 行政法规
  if (issuingAuthority?.includes('国务院') && title.includes('条例')) return '行政法规';

  // 省级法规
  const provinceNames = ['省', '自治区', '直辖市'];
  const isProvincial = provinceNames.some(p =>
    title.match(new RegExp(`^[\u4e00-\u9fa5]+${p}`))
  );

  if (isProvincial && (title.includes('条例') || title.includes('规定') || title.includes('办法'))) {
    return '地方性法规';
  }

  // 市级法规
  if (title.match(/^[\u4e00-\u9fa5]{2,4}市/) && (title.includes('条例') || title.includes('规定') || title.includes('办法'))) {
    return '地方性法规';
  }

  // 自治条例/单行条例
  if (title.includes('自治条例') || title.includes('单行条例')) {
    return '自治条例和单行条例';
  }

  // 部门规章
  if (issuingAuthority && (
    issuingAuthority.includes('部') ||
    issuingAuthority.includes('委员会') ||
    issuingAuthority.includes('总局') ||
    issuingAuthority.includes('署')
  )) {
    return '部门规章';
  }

  return '地方性法规'; // 默认
}

// ==================== 条款解析（简化版，复用核心逻辑） ====================

interface ParsedArticle {
  title: string;
  chapter: string | null;
  section: string | null;
  content: null;
  paragraphs: Array<{
    number: number;
    content: string | null;
    items: Array<{ number: string; content: string; order: number }>;
    order: number;
  }>;
}

function parseContent(rawContent: string): { articles: ParsedArticle[]; preamble: string } {
  let preamble = '';
  let text = rawContent;

  // 提取序言
  const trimmedStart = rawContent.trimStart();
  if (trimmedStart.startsWith('（') || trimmedStart.startsWith('(')) {
    const openBracket = trimmedStart[0];
    const closeBracket = openBracket === '（' ? '）' : ')';
    const closeIndex = rawContent.indexOf(closeBracket);
    if (closeIndex !== -1) {
      preamble = rawContent.substring(0, closeIndex + 1).trim();
      text = rawContent.substring(closeIndex + 1).trim();
    }
  }

  const lines = text.split('\n');
  const articles: any[] = [];

  let currentChapter = '';
  let currentSection = '';
  let currentArticle: any = null;

  const chapterRegex = /^\s*(第[零一二三四五六七八九十百千0-9]+章)\s+(.*)/;
  const sectionRegex = /^\s*(第[零一二三四五六七八九十百千0-9]+节)\s+(.*)/;
  const articleRegex = /^\s*\**\s*(第[零一二三四五六七八九十百千0-9]+条)\s*\**\s*(.*)/;
  const itemRegex1 = /^\s*([（(][一二三四五六七八九十]+[）)])\s*(.*)/;
  const itemRegex2 = /^\s*(\d+[.、])\s*(.*)/;
  const itemRegex3 = /^\s*([（(]\d+[）)])\s*(.*)/;

  const normalizeTitle = (t: string) => {
    const m = t.match(/^第([零一二三四五六七八九十百千0-9]+)条$/);
    return m ? m[1] : t;
  };

  const isItem = (line: string) => itemRegex1.test(line) || itemRegex2.test(line) || itemRegex3.test(line);

  for (const line of lines) {
    const trimLine = line.trim();
    if (!trimLine || /^\s*\d+\s*$/.test(trimLine)) continue;

    const chapMatch = trimLine.match(chapterRegex);
    if (chapMatch) {
      if (currentArticle) { articles.push(currentArticle); currentArticle = null; }
      currentChapter = trimLine;
      currentSection = '';
      continue;
    }

    const secMatch = trimLine.match(sectionRegex);
    if (secMatch) {
      if (currentArticle) { articles.push(currentArticle); currentArticle = null; }
      currentSection = trimLine;
      continue;
    }

    const artMatch = trimLine.match(articleRegex);
    if (artMatch) {
      if (currentArticle) articles.push(currentArticle);
      currentArticle = {
        title: normalizeTitle(artMatch[1]),
        chapter: currentChapter || null,
        section: currentSection || null,
        content: null,
        paragraphs: [],
        _firstLineText: artMatch[2] || '',
      };
      continue;
    }

    if (currentArticle && isItem(trimLine)) {
      let para = currentArticle.paragraphs[currentArticle.paragraphs.length - 1];
      if (!para) {
        para = { number: 1, content: currentArticle._firstLineText || null, items: [], order: 1 };
        currentArticle.paragraphs.push(para);
        currentArticle._firstLineText = '';
      }
      const m1 = trimLine.match(itemRegex1) || trimLine.match(itemRegex2) || trimLine.match(itemRegex3);
      if (m1) {
        para.items.push({ number: m1[1], content: m1[2], order: para.items.length + 1 });
      }
      continue;
    }

    if (currentArticle && trimLine) {
      if (currentArticle.paragraphs.length > 0) {
        const lastPara = currentArticle.paragraphs[currentArticle.paragraphs.length - 1];
        if (lastPara.items && lastPara.items.length > 0) {
          const n = currentArticle.paragraphs.length + 1;
          currentArticle.paragraphs.push({ number: n, content: trimLine, items: [], order: n });
        } else if (!lastPara.content) {
          lastPara.content = trimLine;
        } else {
          const n = currentArticle.paragraphs.length + 1;
          currentArticle.paragraphs.push({ number: n, content: trimLine, items: [], order: n });
        }
      } else {
        if (currentArticle._firstLineText) {
          currentArticle.paragraphs.push({ number: 1, content: currentArticle._firstLineText, items: [], order: 1 });
          currentArticle.paragraphs.push({ number: 2, content: trimLine, items: [], order: 2 });
          currentArticle._firstLineText = '';
        } else {
          currentArticle._firstLineText = trimLine;
        }
      }
    }
  }

  if (currentArticle) articles.push(currentArticle);

  // 后处理
  articles.forEach((art: any) => {
    if (art._firstLineText && art.paragraphs.length === 0) {
      art.paragraphs.push({ number: 1, content: art._firstLineText, items: [], order: 1 });
    }
    delete art._firstLineText;
  });

  return { articles, preamble };
}

// ==================== 主导入逻辑 ====================

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const skipExisting = args.includes('--skip-existing');
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) : 0;

  console.log('='.repeat(60));
  console.log('法规 Markdown 批量导入工具');
  console.log('='.repeat(60));
  console.log(`模式: ${execute ? '执行导入' : '预览模式（不写数据库）'}`);
  console.log(`跳过已存在: ${skipExisting}`);
  if (limit) console.log(`限制数量: ${limit}`);
  console.log('');

  // 读取所有 .md 文件
  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  console.log(`找到 ${files.length} 个 .md 文件`);

  const processFiles = limit ? files.slice(0, limit) : files;

  // 获取已存在的法规标题
  const existingTitles = new Set<string>();
  if (skipExisting) {
    const existing = await prisma.law.findMany({ select: { title: true } });
    existing.forEach(l => existingTitles.add(l.title));
    console.log(`数据库已有 ${existingTitles.size} 部法规`);
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ file: string; error: string }> = [];

  for (let i = 0; i < processFiles.length; i++) {
    const file = processFiles[i];

    try {
      const filepath = path.join(SOURCE_DIR, file);
      const content = fs.readFileSync(filepath, 'utf-8');

      // 解析文件名
      const { date: fileDate } = parseFilename(file);

      // 解析文件内容
      const { title, metadata, body } = parseMdFile(content);

      if (!title) {
        errors.push({ file, error: '无法提取标题' });
        failed++;
        continue;
      }

      // 跳过已存在的
      if (skipExisting && existingTitles.has(title)) {
        skipped++;
        continue;
      }

      // 提取元数据
      const { promulgationDate: metaDate, issuingAuthority } = extractDatesFromMetadata(metadata);
      const promulgationDate = metaDate || fileDate;

      // 检测区域和效力位阶
      const region = detectRegion(title);
      const level = detectLevel(title, issuingAuthority);

      // 解析正文
      const plainBody = mdToPlainText(body);
      const { articles, preamble } = parseContent(plainBody);

      if (!execute) {
        // 预览模式
        if (i < 5 || (i % 500 === 0)) {
          console.log(`[${i + 1}] ${title}`);
          console.log(`    区域: ${region} | 位阶: ${level} | 日期: ${promulgationDate || '未知'}`);
          console.log(`    条款: ${articles.length} 条 | 序言: ${preamble ? '有' : '无'}`);
        }
      } else {
        // 执行导入
        await prisma.law.create({
          data: {
            title,
            issuingAuthority,
            preamble: preamble || null,
            promulgationDate: promulgationDate ? new Date(promulgationDate) : null,
            status: '现行有效',
            level,
            category: '综合监管', // 临时默认值
            region,
            articles: {
              create: articles.map((art, idx) => ({
                title: art.title,
                chapter: art.chapter,
                section: art.section,
                order: idx + 1,
                paragraphs: {
                  create: art.paragraphs.map(para => ({
                    number: para.number,
                    content: para.content,
                    order: para.order,
                    items: {
                      create: para.items.map(item => ({
                        number: item.number,
                        content: item.content,
                        order: item.order,
                      })),
                    },
                  })),
                },
              })),
            },
          },
        });
      }

      imported++;

      // 进度报告
      if ((i + 1) % 200 === 0 || i === processFiles.length - 1) {
        console.log(`进度: ${i + 1}/${processFiles.length} | 导入: ${imported} | 跳过: ${skipped} | 失败: ${failed}`);
      }
    } catch (err: any) {
      errors.push({ file, error: err.message?.substring(0, 100) || 'unknown error' });
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('导入完成');
  console.log(`  处理文件: ${processFiles.length}`);
  console.log(`  成功导入: ${imported}`);
  console.log(`  跳过已存在: ${skipped}`);
  console.log(`  失败: ${failed}`);

  if (errors.length > 0) {
    console.log(`\n前 20 个错误:`);
    errors.slice(0, 20).forEach(e => console.log(`  ${e.file}: ${e.error}`));
  }

  if (!execute) {
    console.log('\n这是预览模式，未写入数据库。添加 --execute 参数执行实际导入。');
  }

  // 统计数据库
  const totalLaws = await prisma.law.count();
  console.log(`\n数据库法规总数: ${totalLaws}`);
}

main()
  .catch((e) => {
    console.error('导入失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
