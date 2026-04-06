const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;
const prisma = new PrismaClient();

const DATA_DIR = path.join(__dirname, '../laws');
const DATE_REGEX = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
const DOC_NUMBER_REGEX = /（([^(]+[第]号[）)]/; // 提取括号内的发文字号

// 生成法规组ID
function generateLawGroupId(title) {
  // 使用 MD5 哈希生成唯一 ID
  const hash = crypto.createHash('md5').update(title).digest('hex');
  // 取前 12 位作为 groupId
  return `LAW_${hash.substring(0, 12).toUpperCase()}`;
}

// 提取文件名中的发文字号（如果有的话）
function extractDocumentNumberFromFileName(fileName) {
  // 匹配：公司法（主席令第66号）.json → 主席令第66号
  const match = fileName.match(/（([^）]+）\.json$/);
  return match ? match[1] : null;
}

async function main() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  console.log('Starting incremental import...');
  // Removed global deleteMany to prevent data loss

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const fileNameTitle = path.basename(file, '.json').trim();

    try {
      // 0. 检查是否存在
      const existing = await prisma.law.findFirst({
        where: { title: fileNameTitle }
      });

      if (existing) {
        console.log(`Skipped (Already exists): ${fileNameTitle}`);
        continue;
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const json = JSON.parse(rawData);

      // 0. 提取发文字号和序言
      let documentNumber = null;
      let preamble = null;

      // 优先从文件名中提取发文字号
      const fileDocNumber = extractDocumentNumberFromFileName(fileNameTitle);
      if (fileDocNumber) {
        documentNumber = fileDocNumber;
      }

      // 如果文件名中没有，尝试从 JSON 内容中提取
      if (!documentNumber && json.preamble) {
        // 尝试从 preamble 中提取发文字号（如果有的话）
        const docMatch = json.preamble.match(/（([^（]+[第]号））/);
        if (docMatch) {
          documentNumber = docMatch[1];
        }
        preamble = json.preamble.replace(/（([^（]+[第]号））/g, ''); // 移除发文字号
      } else {
        preamble = json.preamble;
      }

      // 1. 日期提取
      let promulgationDate = null;
      if (preamble) {
        const matches = [...preamble.matchAll(DATE_REGEX)];
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          promulgationDate = new Date(`${lastMatch[1]}-${lastMatch[2]}-${lastMatch[3]}`);
        }
      }

      // 2. 级别推断
      let level = '部门规章';
      if (fileNameTitle.endsWith('法')) level = '法律';
      else if (fileNameTitle.endsWith('条例')) level = fileNameTitle.includes('省') || fileNameTitle.includes('市') ? '地方性法规' : '行政法规';
      
      // 3. 分类推断
      let category = '综合监管';
      const t = fileNameTitle;
      if (t.includes('食品') || t.includes('乳粉') || t.includes('餐饮') || t.includes('保健食品') || t.includes('冷链')) category = '食品安全';
      else if (t.includes('药品') || t.includes('疫苗') || t.includes('中药') || t.includes('制剂')) category = '药品监管';
      else if (t.includes('医疗器械')) category = '医疗器械';
      else if (t.includes('广告') || t.includes('促销')) category = '广告监管';
      else if (t.includes('特种设备') || t.includes('电梯') || t.includes('锅炉') || t.includes('游乐设施') || t.includes('索道')) category = '特种设备';
      else if (t.includes('计量') || t.includes('度量衡') || t.includes('测量')) category = '计量监督';
      else if (t.includes('认证') || t.includes('检验') || t.includes('检测') || t.includes('认可') || t.includes('标准')) category = '认证认可';
      else if (t.includes('价格') || t.includes('收费') || t.includes('明码标价')) category = '价格监管';
      else if (t.includes('反垄断') || t.includes('竞争') || t.includes('商业贿赂') || t.includes('直销') || t.includes('传销')) category = '反垄断与反不正当竞争';
      else if (t.includes('知识产权') || t.includes('商标') || t.includes('专利') || t.includes('著作权') || t.includes('奥林匹克')) category = '知识产权';
      else if (t.includes('消费者') || t.includes('维权') || t.includes('退货')) category = '消保维权';
      else if (t.includes('公司') || t.includes('企业') || t.includes('登记') || t.includes('注册') || t.includes('执照') || t.includes('市场主体')) category = '商事登记';
      else if (t.includes('网络') || t.includes('电商') || t.includes('电子') || t.includes('互联网')) category = '网监';

      // 4. 条款处理
      const articlesData = [];
      const processArticle = (art, chapterTitle = null) => {
          let fullContent = art.content || '';
          if (art.sub_articles && art.sub_articles.length > 0) {
            fullContent += '\n' + art.sub_articles.map(sub => `  ${sub.number} ${sub.content}`).join('\n');
          }
          articlesData.push({ title: art.article_number || '条', content: fullContent, chapter: chapterTitle, order: articlesData.length + 1 });
      };

      if (Array.isArray(json.articles) && json.articles.length > 0) {
        json.articles.forEach(art => processArticle(art));
      } else if (Array.isArray(json.chapters)) {
        json.chapters.forEach(chap => {
          const chapTitle = `${chap.chapter_number} ${chap.chapter_title || ''}`.trim();
          if (Array.isArray(chap.articles)) chap.articles.forEach(art => processArticle(art, chapTitle));
        });
      }

      await prisma.law.create({
        data: {
          title: fileNameTitle,
          documentNumber: documentNumber,
          preamble: preamble,
          promulgationDate: promulgationDate,
          level: level,
          category: category,
          status: '现行有效',
          lawGroupId: generateLawGroupId(fileNameTitle),
          articles: { create: articlesData }
        }
      });
      console.log(`Imported: ${fileNameTitle} | ${category} | groupId: ${generateLawGroupId(fileNameTitle)} | DocNum: ${documentNumber || '无'} | Preamble: ${preamble ? '有' : '无'}`);
    } catch (err) { console.error(`Failed to import ${file}:`, err.message); }
  }
  console.log('Done!');
}

main().finally(() => prisma.$disconnect());
