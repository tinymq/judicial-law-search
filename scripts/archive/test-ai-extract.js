/**
 * 测试 AI 违法行为提取
 * 用于调试 AI 返回结果
 */

const fetch = require('node-fetch');

async function testExtract() {
  const lawId = 1; // 测试法规 ID

  console.log('🔍 测试 AI 提取法规 ID:', lawId);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const response = await fetch('http://localhost:3000/api/ai/extract-violations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lawId })
    });

    const data = await response.json();

    console.log('\n📊 API 响应状态:', response.status);
    console.log('📊 成功:', data.success);

    if (data.error) {
      console.log('❌ 错误:', data.error);
    }

    if (data.lawTitle) {
      console.log('📚 法规标题:', data.lawTitle);
    }

    if (data.violations) {
      console.log('\n📋 识别出的违法行为数量:', data.violations.length);

      if (data.violations.length > 0) {
        console.log('\n前3条示例:');
        data.violations.slice(0, 3).forEach((v, i) => {
          console.log(`\n${i + 1}. ${v.description}`);
          console.log(`   违法依据: ${v.violationArticleTitle}`);
          console.log(`   处罚依据: ${v.punishmentArticleTitle}`);
        });
      } else {
        console.log('\n⚠️ AI 返回了空数组！可能原因：');
        console.log('   1. 法规内容为空或太短');
        console.log('   2. AI 认为没有违法行为');
        console.log('   3. AI 返回的内容格式错误');
      }
    }

    if (data.articles) {
      console.log('\n📝 法规条款数量:', data.articles.length);
    }

  } catch (error) {
    console.error('❌ 请求失败:', error.message);
  }
}

testExtract();
