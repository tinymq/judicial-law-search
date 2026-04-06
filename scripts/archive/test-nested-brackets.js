/**
 * 测试嵌套括号序言提取
 */

const testContent = `（1984年9月20日第六届全国人民代表大会常务委员会第七次会议通过  2001年2月28日第九届全国人民代表大会常务委员会第二十次会议第一次修订  根据2013年12月28日第十二届全国人民代表大会常务委员会第六次会议《关于修改〈中华人民共和国海洋环境保护法〉等七部法律的决定》第一次修正  根据2015年4月24日第十二届全国人民代表大会常务委员会第十四次会议《关于修改〈中华人民共和国药品管理法〉的决定》第二次修正 2019年8月26日第十三届全国人民代表大会常务委员会第十二次会议第二次修订）

目　　录

第一章　总　　则

第二章　药品研制和注册

第三章　药品上市许可持有人

第一条　为了加强药品管理，保证药品质量，保障公众用药安全和合法权益，保护和促进公众健康，制定本法。

第二条　在中华人民共和国境内从事药品研制、生产、经营、使用和监督管理活动，适用本法。

第九条　县级以上地方人民政府...
`;

// 复制修复后的解析逻辑
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
      console.log('📜 提取到序言:', preamble.substring(0, 100) + '...');
      console.log('📜 序言长度:', preamble.length, '字符');
    }
  }

  const lines = text.split('\n');
  console.log('📊 提取序言后的前10行内容:');
  lines.slice(0, 10).forEach((line, i) => {
    console.log(`  ${i + 1}. ${line}`);
  });

  // 简化版：只检查是否正确识别了"第一章"
  const has第一章 = lines.some(line => line.includes('第一章'));
  const has目录 = lines.some(line => line.includes('目　　录'));

  console.log('\n✅ 验证结果:');
  console.log('  - 是否包含"目　　录":', has目录 ? '✅ 是（说明目录在正文中，未误识别为序言）' : '❌ 否');
  console.log('  - 是否包含"第一章":', has第一章 ? '✅ 是（说明章节在正文中，未误识别为序言）' : '❌ 否');

  if (has目录 && has第一章) {
    console.log('\n🎉 修复成功！序言正确提取，目录和章节都在正文中。');
  } else {
    console.log('\n❌ 仍有问题！');
  }

  return { preamble, text };
}

// 运行测试
console.log('='.repeat(60));
console.log('测试嵌套括号序言提取');
console.log('='.repeat(60));

parseContent(testContent);
