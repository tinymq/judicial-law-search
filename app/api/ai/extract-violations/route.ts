/**
 * AI 违法行为提取 API
 * POST /api/ai/extract-violations
 * Body: { lawId: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { extractViolationsFromLaw } from '@/src/lib/ai/violation-extractor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lawId } = body;

    if (!lawId) {
      return NextResponse.json(
        { success: false, error: '缺少 lawId 参数' },
        { status: 400 }
      );
    }

    // 获取法规信息
    const law = await prisma.law.findUnique({
      where: { id: lawId },
      include: {
        articles: {
          orderBy: { order: 'asc' },
          include: {
            paragraphs: {
              orderBy: { order: 'asc' },
              include: {
                items: {
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    if (!law) {
      return NextResponse.json(
        { success: false, error: '法规不存在' },
        { status: 404 }
      );
    }

    // 构建法规全文内容
    const lawContent = buildLawContent(law);

    // 🔍 调试：打印法规内容长度
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 AI 拆解调试信息');
    console.log('📚 法规标题:', law.title);
    console.log('📝 条款数量:', law.articles.length);
    console.log('📏 内容长度:', lawContent.length, '字符');
    console.log('📄 内容预览 (前500字):');
    console.log(lawContent.substring(0, 500));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 调用 AI 提取
    const result = await extractViolationsFromLaw(law.title, lawContent);

    // 🔍 调试：打印 AI 返回结果
    console.log('🤖 AI 返回结果:');
    console.log('   成功:', result.success);
    console.log('   错误:', result.error);
    console.log('   违法行为数量:', result.violations?.length || 0);
    if (result.violations && result.violations.length > 0) {
      console.log('   第一条:', result.violations[0].description);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 返回调试信息
    const debugInfo = {
      lawContentLength: lawContent.length,
      lawContentPreview: lawContent.substring(0, 300),
      aiResult: {
        success: result.success,
        error: result.error,
        violationsCount: result.violations?.length || 0,
        rawContent: (result as any).rawContent  // 返回完整原始内容
      }
    };

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, debug: debugInfo },
        { status: 500 }
      );
    }

    // 匹配条款 ID
    const violationsWithIds = await matchArticleIds(result.violations || [], law.articles);

    return NextResponse.json({
      success: true,
      lawId: law.id,
      lawTitle: law.title,
      violations: violationsWithIds,
      debug: debugInfo,  // 添加调试信息
      articles: law.articles.map(a => ({
        id: a.id,
        title: a.title,
        fullTitle: `第${a.title}条`,
        chapter: a.chapter,
        section: a.section
      }))
    });

  } catch (error) {
    console.error('AI 提取失败:', error);
    return NextResponse.json(
      { success: false, error: `服务器错误: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

/**
 * 构建法规全文内容
 * 优化：发送全部内容，但限制长度
 */
function buildLawContent(law: any): string {
  const parts: string[] = [];

  // 序言
  if (law.preamble) {
    parts.push(law.preamble);
  }

  // 发送全部条款
  for (const article of law.articles) {
    let articleText = `第${article.title}条`;

    // 章节信息
    if (article.chapter && article.section) {
      articleText = `${article.chapter} ${article.section} ${articleText}`;
    } else if (article.chapter) {
      articleText = `${article.chapter} ${articleText}`;
    } else if (article.section) {
      articleText = `${article.section} ${articleText}`;
    }

    parts.push(articleText);

    // 款和项
    for (const para of article.paragraphs) {
      if (para.content) {
        parts.push(para.content);
      }
      for (const item of para.items) {
        parts.push(`${item.number} ${item.content}`);
      }
    }
  }

  return parts.join('\n\n');
}

/**
 * 匹配条款 ID
 */
async function matchArticleIds(violations: any[], articles: any[]): Promise<any[]> {
  return violations.map(v => {
    // 尝试匹配违法依据条款
    const violationArticle = findArticleByTitle(v.violationArticleTitle, articles);

    // 尝试匹配处罚依据条款
    const punishmentArticle = findArticleByTitle(v.punishmentArticleTitle, articles);

    return {
      ...v,
      // 违法依据
      violationArticleId: violationArticle?.id || null,
      violationArticleTitleMatched: violationArticle ? `第${violationArticle.title}条` : null,
      // 处罚依据
      punishmentArticleId: punishmentArticle?.id || null,
      punishmentArticleTitleMatched: punishmentArticle ? `第${punishmentArticle.title}条` : null,
    };
  });
}

/**
 * 根据标题查找条款
 * 支持：第四十二条、第四十二条第一款、第42条、第一章 总 则 第四条 等格式
 */
function findArticleByTitle(title: string, articles: any[]): any | null {
  if (!title) return null;

  // 从字符串末尾提取条款号
  // 例如："第一章 总 则 第四条" → "四"
  // 例如："第六章 法律责任 第九十七条" → "九十七"
  const match = title.match(/第([一二三四五六七八九十百零]+)条$/);
  
  if (!match) return null;
  
  let normalized = match[1]; // 提取"第"和"条"之间的部分

  // 中文数字转阿拉伯数字
  const chineseToNum: Record<string, string> = {
    '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
    '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
    '十一': '11', '十二': '12', '十三': '13', '十四': '14', '十五': '15',
    '十六': '16', '十七': '17', '十八': '18', '十九': '19', '二十': '20',
    '二十一': '21', '二十二': '22', '二十三': '23', '二十四': '24', '二十五': '25',
    '二十六': '26', '二十七': '27', '二十八': '28', '二十九': '29',
    '三十': '30', '三十一': '31', '三十二': '32', '三十三': '33', '三十四': '34',
    '三十五': '35', '三十六': '36', '三十七': '37', '三十八': '38', '三十九': '39',
    '四十': '40', '四十一': '41', '四十二': '42', '四十三': '43', '四十四': '44',
    '四十五': '45', '四十六': '46', '四十七': '47', '四十八': '48', '四十九': '49',
    '五十': '50', '六十': '60', '七十': '70', '八十': '80', '九十': '90',
    '一百': '100', '一百零一': '101', '一百零二': '102', '一百零三': '103', '一百零四': '104',
    '一百零五': '105', '一百零六': '106', '一百零七': '107', '一百零八': '108', '一百零九': '109',
    '一百一十': '110', '一百一十一': '111', '一百一十二': '112', '一百一十三': '113', '一百一十四': '114',
    '一百一十五': '115', '一百一十六': '116', '一百一十七': '117', '一百一十八': '118', '一百一十九': '119'
  };

  const numFromChinese = chineseToNum[normalized];
  const searchKey = numFromChinese || normalized;

  console.log(`🔍 匹配条款: "${title}" → "${normalized}" → "${searchKey}"`);

  // 查找匹配的条款
  return articles.find(a => {
    if (!a.title) return false;
    // 直接匹配
    if (a.title === searchKey) return true;
    if (a.title === normalized) return true;
    return false;
  }) || null;
}
