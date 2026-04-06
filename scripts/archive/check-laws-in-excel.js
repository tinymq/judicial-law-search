const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

// 初始化 Prisma
const prisma = new PrismaClient();

/**
 * 计算字符串相似度（使用编辑距离）
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * 计算相似度百分比
 */
function similarity(str1, str2) {
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/**
 * 标准化字符串（去除空格、括号内容等）
 */
function normalize(str) {
  return str
    .replace(/\s+/g, '')
    .replace(/（.*?）/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/《.*?》/g, '')
    .trim();
}

/**
 * 查找最相似的法规
 */
function findSimilarLaw(excelLaw, dbLaws) {
  const normalizedExcel = normalize(excelLaw);

  // 1. 精确匹配
  const exactMatch = dbLaws.find(law => law.title === excelLaw);
  if (exactMatch) {
    return { status: '已存储', lawTitle: exactMatch.title, score: 1 };
  }

  // 2. 标准化后精确匹配
  const normalizedMatch = dbLaws.find(law => normalize(law.title) === normalizedExcel);
  if (normalizedMatch) {
    return { status: '已存储', lawTitle: normalizedMatch.title, score: 1 };
  }

  // 3. 包含关系匹配
  const containsMatch = dbLaws.find(law =>
    law.title.includes(excelLaw) || excelLaw.includes(law.title)
  );
  if (containsMatch) {
    return { status: '已存储', lawTitle: containsMatch.title, score: 0.95 };
  }

  // 4. 相似度匹配
  let bestMatch = null;
  let bestScore = 0;

  for (const law of dbLaws) {
    const score = similarity(normalizedExcel, normalize(law.title));
    if (score > bestScore && score >= 0.7) { // 相似度阈值70%
      bestScore = score;
      bestMatch = law;
    }
  }

  if (bestMatch) {
    if (bestScore >= 0.85) {
      return { status: '已存储', lawTitle: bestMatch.title, score: bestScore };
    } else {
      return { status: '存疑', lawTitle: bestMatch.title, score: bestScore };
    }
  }

  return { status: '未存储', lawTitle: '', score: 0 };
}

async function main() {
  try {
    console.log('开始核对法规...\n');

    // 1. 读取数据库中的所有法规
    console.log('正在读取数据库...');
    const dbLaws = await prisma.law.findMany({
      select: {
        id: true,
        title: true
      },
      orderBy: {
        title: 'asc'
      }
    });
    console.log(`数据库中共有 ${dbLaws.length} 个法规\n`);

    // 2. 读取 Excel 文件
    console.log('正在读取 Excel 文件...');
    const excelPath = path.join(__dirname, '..', '260128法规清单.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`Excel 中共有 ${data.length} 行数据\n`);

    // 3. 核对每个法规
    console.log('正在核对法规...\n');
    const results = [];
    let storedCount = 0;
    let notStoredCount = 0;
    let suspiciousCount = 0;

    for (let i = 0; i < data.length; i++) {
      const excelLaw = data[i][0]; // A列
      if (!excelLaw) continue;

      const result = findSimilarLaw(excelLaw, dbLaws);

      // 更新当前行
      data[i][1] = result.status; // B列
      data[i][2] = result.lawTitle || '无相似法规'; // C列

      // 统计
      if (result.status === '已存储') storedCount++;
      else if (result.status === '未存储') notStoredCount++;
      else suspiciousCount++;

      // 记录结果
      results.push({
        row: i + 1,
        excelLaw,
        status: result.status,
        dbLaw: result.lawTitle,
        score: result.score
      });

      // 显示进度
      if ((i + 1) % 10 === 0 || i === data.length - 1) {
        console.log(`已处理 ${i + 1}/${data.length} 行`);
      }
    }

    // 4. 写回 Excel
    console.log('\n正在写回 Excel...');
    const newSheet = XLSX.utils.aoa_to_sheet(data);
    workbook.Sheets[workbook.SheetNames[0]] = newSheet;

    // 添加列头（如果原来没有）
    if (!data[0] || data[0][0] !== '法规名称') {
      // 插入标题行
      data.unshift(['法规名称', '核查结果', '对应法规']);
      const headerSheet = XLSX.utils.aoa_to_sheet(data);
      workbook.Sheets[workbook.SheetNames[0]] = headerSheet;
    }

    // 保存文件（在原文件名基础上添加 _checked）
    const outputPath = path.join(__dirname, '..', '260128法规清单_checked.xlsx');
    XLSX.writeFile(workbook, outputPath);
    console.log(`结果已保存到: ${outputPath}\n`);

    // 5. 输出统计报告
    console.log('===== 核对统计 =====');
    console.log(`已存储: ${storedCount} 个 (${(storedCount / data.length * 100).toFixed(1)}%)`);
    console.log(`未存储: ${notStoredCount} 个 (${(notStoredCount / data.length * 100).toFixed(1)}%)`);
    console.log(`存疑: ${suspiciousCount} 个 (${(suspiciousCount / data.length * 100).toFixed(1)}%)`);
    console.log(`总计: ${data.length} 个\n`);

    // 6. 输出未存储的法规
    if (notStoredCount > 0) {
      console.log('===== 未存储的法规 =====');
      results
        .filter(r => r.status === '未存储')
        .forEach(r => {
          console.log(`- ${r.excelLaw}`);
        });
      console.log('');
    }

    // 7. 输出存疑的法规
    if (suspiciousCount > 0) {
      console.log('===== 存疑的法规（相似度 < 85%）=====');
      results
        .filter(r => r.status === '存疑')
        .forEach(r => {
          console.log(`- ${r.excelLaw}`);
          console.log(`  → 可能匹配: ${r.dbLaw} (相似度: ${(r.score * 100).toFixed(1)}%)`);
        });
      console.log('');
    }

    console.log('核对完成！');

  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
