/**
 * 测试法规内容解析器
 *
 * 用于验证解析逻辑是否正确
 */

const testContent = `（1984年9月20日通过）

第一章　总　则

第一条　为了加强药品管理，保证药品质量，保障公众用药安全和合法权益，保护和促进公众健康，制定本法。

第二条　在中华人民共和国境内从事药品研制、生产、经营、使用和监督管理活动，适用本法。

第三条　药品管理应当以人民健康为中心，坚持风险管理、全程管控、社会共治的原则。

第二章　药品研制

第四条　国家发展现代药和传统药，充分发挥其在预防、医疗和保健中的作用。

第五条　国家鼓励研究和创制新药，保护公民、法人和其他组织研究、开发新药的合法权益。
`;

// 复制解析逻辑
function parseContent(rawContent) {
  console.log('🚀 开始解析法规内容');

  let preamble = '';
  let text = rawContent;

  // 提取序言（支持中文括号（）和英文括号()）
  // 注意：修订记录中可能包含嵌套括号，需要找到匹配最外层的右括号
  const trimmedStart = rawContent.trimStart();
  if (trimmedStart.startsWith('（') || trimmedStart.startsWith('(')) {
    const openBracket = trimmedStart[0];
    const closeBracket = openBracket === '（' ? '）' : ')';

    // ✅ 修复：使用 lastIndexOf 而不是 indexOf，找到匹配最外层左括号的最后一个右括号
    const closeIndex = rawContent.lastIndexOf(closeBracket);
    if (closeIndex !== -1 && closeIndex > 0) {
      preamble = rawContent.substring(0, closeIndex + 1).trim();
      text = rawContent.substring(closeIndex + 1).trim();
      console.log('📜 提取到序言:', preamble.substring(0, 100) + (preamble.length > 100 ? '...' : ''));
    }
  }

  const lines = text.split('\n');
  const articles = [];

  let currentChapter = '';
  let currentSection = '';
  let currentArticle = null;

  // 正则表达式定义
  const chapterRegex = /^\s*(第[零一二三四五六七八九十百千0-9]+章)\s+(.*)/;
  const sectionRegex = /^\s*(第[零一二三四五六七八九十百千0-9]+节)\s+(.*)/;
  const articleRegex = /^\s*\**\s*(第[零一二三四五六七八九十百千0-9]+条)\s*\**\s*(.*)/;
  const pageNumRegex = /^\s*\d+\s*$/;

  const normalizeArticleTitle = (fullTitle) => {
    const match = fullTitle.match(/^第([零一二三四五六七八九十百千0-9]+)条$/);
    if (match) {
      return match[1];
    }
    return fullTitle;
  };

  // 逐行解析
  for (const line of lines) {
    const trimLine = line.trim();
    if (!trimLine || pageNumRegex.test(trimLine)) continue;

    // 匹配章
    const chapMatch = trimLine.match(chapterRegex);
    if (chapMatch) {
      console.log('📖 匹配到章:', chapMatch[1]);
      currentChapter = trimLine;
      currentSection = '';

      // ✅ 修复：如果存在未保存的 Article，先保存
      if (currentArticle) {
        articles.push(currentArticle);
        currentArticle = null;
      }
      continue;
    }

    // 匹配节
    const secMatch = trimLine.match(sectionRegex);
    if (secMatch) {
      console.log('📋 匹配到节:', secMatch[1]);
      currentSection = trimLine;

      // ✅ 修复：如果存在未保存的 Article，先保存
      if (currentArticle) {
        articles.push(currentArticle);
        currentArticle = null;
      }
      continue;
    }

    // 匹配条
    const artMatch = trimLine.match(articleRegex);
    if (artMatch) {
      if (currentArticle) {
        articles.push(currentArticle);
      }

      const firstLineText = artMatch[2] || '';
      console.log('📝 匹配到条:', artMatch[1], '所属章节:', currentChapter || '(无)');

      // 新逻辑：所有条款都使用 paragraphs
      currentArticle = {
        title: normalizeArticleTitle(artMatch[1]),
        chapter: currentChapter || null,
        section: currentSection || null,
        content: null,
        paragraphs: [],
        _firstLineText: firstLineText,
        _isTerminology: false
      };
      continue;
    }

    // 处理普通文本
    if (currentArticle && trimLine) {
      if (currentArticle.paragraphs.length > 0) {
        const lastParagraph = currentArticle.paragraphs[currentArticle.paragraphs.length - 1];

        if (!lastParagraph.content) {
          lastParagraph.content = trimLine;
        } else {
          const newParagraphNumber = currentArticle.paragraphs.length + 1;
          currentArticle.paragraphs.push({
            number: newParagraphNumber,
            content: trimLine,
            items: [],
            order: newParagraphNumber
          });
        }
      } else {
        // 还没有款
        if (currentArticle._firstLineText) {
          currentArticle.paragraphs.push({
            number: 1,
            content: currentArticle._firstLineText,
            items: [],
            order: 1
          });
          currentArticle.paragraphs.push({
            number: 2,
            content: trimLine,
            items: [],
            order: 2
          });
          currentArticle._firstLineText = '';
        } else {
          currentArticle._firstLineText = trimLine;
        }
      }
    }
  }

  // 处理最后一个条款
  if (currentArticle) {
    articles.push(currentArticle);
  }

  // 最终处理
  articles.forEach((art) => {
    if (art._firstLineText && art.paragraphs.length === 0) {
      art.paragraphs.push({
        number: 1,
        content: art._firstLineText,
        items: [],
        order: 1
      });
    }

    delete art._firstLineText;
    delete art._isTerminology;
    art.content = null;
  });

  console.log('✅ 解析完成，共', articles.length, '条');

  return { articles, preamble };
}

// 运行测试
console.log('='.repeat(60));
console.log('测试法规内容解析器');
console.log('='.repeat(60));

const result = parseContent(testContent);

console.log('\n📊 解析结果：');
console.log('序言:', result.preamble);
console.log('条款数量:', result.articles.length);

console.log('\n📋 条款详情：');
result.articles.forEach((art, index) => {
  const artNum = index + 1;
  const chapter = art.chapter || '(无章节)';
  const content = art.paragraphs[0]?.content?.substring(0, 30) || '(无内容)';

  console.log(`  ${artNum}. ${art.title}条 [${chapter}]`);
  console.log(`     内容: ${content}...`);
});

console.log('\n🔍 验证：');
const firstArticleWithChapter = result.articles.find(a => a.chapter);
if (firstArticleWithChapter) {
  const firstIndex = result.articles.indexOf(firstArticleWithChapter);
  console.log(`第一个带章节的条款是第 ${firstIndex + 1} 条（${firstArticleWithChapter.title}）`);
  console.log(`所属章节: ${firstArticleWithChapter.chapter}`);

  if (firstIndex === 0) {
    console.log('✅ 第一个条就有关联章节，解析正确！');
  } else {
    console.log(`❌ 前 ${firstIndex} 个条没有关联章节，这可能是问题所在！`);
  }
} else {
  console.log('❌ 没有任何条款关联章节！');
}
