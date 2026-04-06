/**
 * 验证导出的 JSON 文件
 * 检查字段完整性、结构正确性
 */

const fs = require('fs');
const path = require('path');

const outputDir = path.join(process.cwd(), 'laws-exported');

console.log('=== 验证导出的 JSON 文件 ===\n');

// 1. 检查目录
if (!fs.existsSync(outputDir)) {
  console.log('❌ laws-exported 目录不存在');
  console.log('请先在管理后台点击"导出 JSON"按钮');
  process.exit(1);
}

const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));
console.log(`✅ 找到 ${files.length} 个 JSON 文件\n`);

if (files.length === 0) {
  console.log('❌ 没有找到 JSON 文件');
  process.exit(1);
}

// 2. 检查第一个文件的完整结构
const sampleFile = files[0];
const filePath = path.join(outputDir, sampleFile);
const content = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(content);

console.log('📄 示例文件:', sampleFile);
console.log('\n--- 结构检查 ---\n');

// 检查 meta
if (data.meta) {
  console.log('✅ meta 字段存在');
  console.log('   - version:', data.meta.version);
  console.log('   - exported_at:', data.meta.exported_at);
  console.log('   - format:', data.meta.format);
} else {
  console.log('❌ 缺少 meta 字段');
}

// 检查 law
if (data.law) {
  console.log('\n✅ law 字段存在');
  const law = data.law;
  console.log('   - id:', law.id);
  console.log('   - title:', law.title);
  console.log('   - issuing_authority:', law.issuing_authority || '(空)');
  console.log('   - document_number:', law.document_number || '(空)');
  console.log('   - preamble:', law.preamble ? `${law.preamble.substring(0, 30)}...` : '(空)');
  console.log('   - promulgation_date:', law.promulgation_date || '(空)');
  console.log('   - effective_date:', law.effective_date || '(空)');
  console.log('   - status:', law.status);
  console.log('   - level:', law.level);
  console.log('   - category:', law.category);
  console.log('   - region:', law.region || '(空)');
  console.log('   - law_group_id:', law.law_group_id || '(空)');
} else {
  console.log('❌ 缺少 law 字段');
}

// 检查 structure
if (data.structure && data.structure.articles) {
  console.log('\n✅ structure.articles 字段存在');
  console.log('   - 条款总数:', data.structure.articles.length);

  if (data.structure.articles.length > 0) {
    const firstArticle = data.structure.articles[0];
    console.log('\n   第一条示例:');
    console.log('   - order:', firstArticle.order);
    console.log('   - chapter:', firstArticle.chapter || '(空)');
    console.log('   - section:', firstArticle.section || '(空)', firstArticle.section ? '✅ 有 section' : '⚠️  无 section');
    console.log('   - title:', firstArticle.title);

    if (firstArticle.paragraphs && firstArticle.paragraphs.length > 0) {
      console.log('   - 款数:', firstArticle.paragraphs.length);

      const firstPara = firstArticle.paragraphs[0];
      console.log('\n   第一款示例:');
      console.log('   - order:', firstPara.order);
      console.log('   - number:', firstPara.number);
      console.log('   - content:', firstPara.content ? `${firstPara.content.substring(0, 30)}...` : '(空)');

      if (firstPara.items && firstPara.items.length > 0) {
        console.log('   - 项数:', firstPara.items.length, '✅ 有 items');
        console.log('\n   第一项示例:');
        const firstItem = firstPara.items[0];
        console.log('   - order:', firstItem.order);
        console.log('   - number:', firstItem.number);
        console.log('   - content:', firstItem.content.substring(0, 30) + '...');
      } else {
        console.log('   - 项数: 0 (无项)');
      }
    } else {
      console.log('   - 款数: 0 (无款)');
    }
  }
} else {
  console.log('\n❌ 缺少 structure.articles 字段');
}

// 3. 统计所有文件
console.log('\n--- 统计信息 ---\n');

let totalWithSection = 0;
let totalWithItems = 0;
let totalParagraphs = 0;
let totalItems = 0;

files.forEach(file => {
  const filePath = path.join(outputDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  if (data.structure && data.structure.articles) {
    const hasSection = data.structure.articles.some(a => a.section);
    const hasItems = data.structure.articles.some(a =>
      a.paragraphs && a.paragraphs.some(p => p.items && p.items.length > 0)
    );

    if (hasSection) totalWithSection++;
    if (hasItems) totalWithItems++;

    const paraCount = data.structure.articles.reduce((sum, a) =>
      sum + (a.paragraphs ? a.paragraphs.length : 0), 0
    );
    const itemCount = data.structure.articles.reduce((sum, a) =>
      sum + (a.paragraphs ? a.paragraphs.reduce((s, p) =>
        s + (p.items ? p.items.length : 0), 0
      ) : 0), 0
    );

    totalParagraphs += paraCount;
    totalItems += itemCount;
  }
});

console.log(`总文件数: ${files.length}`);
console.log(`包含 section 的文件: ${totalWithSection} / ${files.length}`);
console.log(`包含 items 的文件: ${totalWithItems} / ${files.length}`);
console.log(`总款数: ${totalParagraphs}`);
console.log(`总项数: ${totalItems}`);

// 4. 字段完整性检查
console.log('\n--- 字段完整性检查 ---\n');

let missingFields = [];

files.forEach(file => {
  const filePath = path.join(outputDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  if (!data.meta) missingFields.push(`${file}: 缺少 meta`);
  if (!data.law) missingFields.push(`${file}: 缺少 law`);
  if (!data.structure) missingFields.push(`${file}: 缺少 structure`);
});

if (missingFields.length > 0) {
  console.log('⚠️  发现问题:');
  missingFields.slice(0, 5).forEach(err => console.log('   -', err));
  if (missingFields.length > 5) {
    console.log(`   ... 还有 ${missingFields.length - 5} 个问题`);
  }
} else {
  console.log('✅ 所有文件结构完整');
}

console.log('\n=== 验证完成 ===');
