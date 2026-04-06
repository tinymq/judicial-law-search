/**
 * AI 案件分析器
 * Step 1: 调用 LLM 从案件描述中提取关键词和案件要素
 * Step 2: 用关键词在数据库中搜索违法行为和法规
 * Step 3: 调用 LLM 组织结构化分析结果
 */

import { prisma } from '@/src/lib/db';

// ==================== Types ====================

export interface CaseAnalysisResult {
  success: boolean;
  error?: string;
  query: string;
  analysis?: {
    summary: string;
    keywords: string[];
    branches: {
      violations: MatchedViolation[];
      laws: MatchedLaw[];
      punishmentTypes: string[];
      warnings: string[];
    };
  };
}

export interface MatchedViolation {
  id: number;
  code: string | null;
  description: string;
  relevanceReason: string;
  violationBasis: {
    lawId: number;
    lawTitle: string;
    ref: string;
    content: string;
  } | null;
  punishmentBasis: {
    lawId: number;
    lawTitle: string;
    ref: string;
    content: string;
  } | null;
}

export interface MatchedLaw {
  id: number;
  title: string;
  status: string | null;
  relevantArticles: string[];
}

// ==================== Step 1: Extract keywords ====================

interface ExtractedKeywords {
  keywords: string[];
  domain: string;
  behaviorSummary: string;
}

async function extractKeywords(description: string): Promise<ExtractedKeywords> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_API_KEY not configured');

  const prompt = `你是一名市场监管执法分析专家。请从以下案件描述中提取信息，用于在违法行为数据库中搜索匹配。

案件描述：
${description}

请以 JSON 格式返回：
{
  "keywords": ["关键词1", "关键词2", ...],
  "domain": "监管领域（如：食品安全、广告监管、价格监管、产品质量、特种设备、反不正当竞争等）",
  "behaviorSummary": "一句话概括核心违法行为（不超过30字）"
}

要求：
1. keywords 提取 3-8 个关键词，包括：违法行为动词（如销售、经营、生产）、违法对象（如过期食品、假冒商品）、法律概念（如虚假宣传、无照经营）
2. domain 只返回一个最相关的监管领域
3. 直接输出 JSON，不要解释`;

  const response = await callZhipuAPI(prompt, 0.1, 500);

  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);
    return {
      keywords: result.keywords || [],
      domain: result.domain || '',
      behaviorSummary: result.behaviorSummary || '',
    };
  } catch {
    // Fallback: split description into keywords
    const fallbackKeywords = description
      .replace(/[，。、；：""''（）\s]+/g, ' ')
      .split(' ')
      .filter(w => w.length >= 2)
      .slice(0, 6);
    return {
      keywords: fallbackKeywords,
      domain: '',
      behaviorSummary: description.slice(0, 30),
    };
  }
}

// ==================== Step 2: Search database ====================

async function searchDatabase(keywords: string[], domain: string) {
  // Search violations by keywords with relevance scoring
  const violationConditions = keywords.map(kw => ({
    description: { contains: kw },
  }));

  const rawViolations = await prisma.violation.findMany({
    where: {
      OR: violationConditions,
    },
    select: {
      id: true,
      code: true,
      description: true,
      violationBasisLaw: { select: { id: true, title: true } },
      violationBasisArticle: {
        select: {
          id: true,
          title: true,
          paragraphs: {
            orderBy: { order: 'asc' as const },
            select: {
              content: true,
              items: { orderBy: { order: 'asc' as const }, select: { number: true, content: true } },
            },
          },
        },
      },
      violationBasisParagraph: { select: { number: true, content: true } },
      violationBasisItem: { select: { number: true, content: true } },
      punishmentBasisLaw: { select: { id: true, title: true } },
      punishmentBasisArticle: {
        select: {
          id: true,
          title: true,
          paragraphs: {
            orderBy: { order: 'asc' as const },
            select: {
              content: true,
              items: { orderBy: { order: 'asc' as const }, select: { number: true, content: true } },
            },
          },
        },
      },
      punishmentBasisParagraph: { select: { number: true, content: true } },
      punishmentBasisItem: { select: { number: true, content: true } },
    },
    take: 50,
  });

  // Score each violation by keyword match count
  const scored = rawViolations.map(v => {
    const matchCount = keywords.filter(kw => v.description.includes(kw)).length;
    return { ...v, _score: matchCount };
  });

  // Sort by score descending, filter out single-keyword matches if we have enough multi-match results
  scored.sort((a, b) => b._score - a._score);
  const multiMatch = scored.filter(v => v._score >= 2);
  const violations = multiMatch.length >= 3 ? multiMatch.slice(0, 15) : scored.slice(0, 15);

  // Derive laws from violation references instead of broad keyword search
  const lawIds = new Set<number>();
  for (const v of violations) {
    if (v.violationBasisLaw?.id) lawIds.add(v.violationBasisLaw.id);
    if (v.punishmentBasisLaw?.id) lawIds.add(v.punishmentBasisLaw.id);
  }

  // Also search laws by domain if provided
  const domainLaws = domain ? await prisma.law.findMany({
    where: { category: { contains: domain } },
    select: { id: true, title: true, status: true, category: true },
    take: 5,
  }) : [];

  const referencedLaws = lawIds.size > 0 ? await prisma.law.findMany({
    where: { id: { in: Array.from(lawIds) } },
    select: { id: true, title: true, status: true, category: true },
  }) : [];

  // Merge: referenced laws first, then domain laws (deduplicated)
  const lawMap = new Map<number, typeof referencedLaws[0]>();
  for (const l of referencedLaws) lawMap.set(l.id, l);
  for (const l of domainLaws) { if (!lawMap.has(l.id)) lawMap.set(l.id, l); }
  const laws = Array.from(lawMap.values()).slice(0, 10);

  return { violations, laws };
}

// ==================== Step 3: Organize results with AI ====================

async function organizeResults(
  description: string,
  extracted: ExtractedKeywords,
  dbViolations: any[],
  dbLaws: any[],
): Promise<CaseAnalysisResult['analysis']> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_API_KEY not configured');

  // Format DB results for the prompt
  const violationsList = dbViolations.map((v, i) => {
    const vBasis = v.violationBasisArticle
      ? `违法依据：${v.violationBasisLaw?.title || '未知'} 第${v.violationBasisArticle.title}条`
      : '违法依据：无';
    const pBasis = v.punishmentBasisArticle
      ? `处罚依据：${v.punishmentBasisLaw?.title || '未知'} 第${v.punishmentBasisArticle.title}条`
      : '处罚依据：无';
    return `${i + 1}. [${v.code || '未编号'}] ${v.description}\n   ${vBasis}\n   ${pBasis}`;
  }).join('\n');

  const lawsList = dbLaws.map((l, i) => `${i + 1}. ${l.title} (${l.status || '未知状态'})`).join('\n');

  const prompt = `你是一名市场监管执法分析专家。基于案件描述和数据库匹配结果，生成结构化分析。

案件描述：${description}
提取的关键词：${extracted.keywords.join('、')}
监管领域：${extracted.domain}

数据库匹配到的违法行为（${dbViolations.length}条）：
${violationsList || '暂无匹配'}

数据库匹配到的法规（${dbLaws.length}部）：
${lawsList || '暂无匹配'}

请以 JSON 格式返回分析结果：
{
  "summary": "案件分析摘要（一句话，不超过50字）",
  "relevantViolationIndices": [0, 1, 2],
  "relevanceReasons": ["与案件相关的原因1", "与案件相关的原因2", ...],
  "punishmentTypes": ["可能的处罚类型1", "可能的处罚类型2"],
  "warnings": ["注意事项1", "注意事项2"]
}

要求：
1. relevantViolationIndices 是上面违法行为列表的序号（从0开始），只选与案件真正相关的，最多选5条
2. relevanceReasons 与 relevantViolationIndices 一一对应，说明每条违法行为与案件的关联
3. punishmentTypes 列出可能的处罚类型（罚款、没收违法所得、吊销许可证等）
4. warnings 列出执法注意事项（法规时效、裁量区分、证据要点等），2-4条
5. 如果没有匹配到违法行为，summary 中说明，punishmentTypes 和 warnings 基于案件描述给出一般性建议
6. 直接输出 JSON，不要解释`;

  const response = await callZhipuAPI(prompt, 0.2, 2000);

  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    // Build structured violations
    const matchedViolations: MatchedViolation[] = (result.relevantViolationIndices || [])
      .filter((idx: number) => idx >= 0 && idx < dbViolations.length)
      .map((idx: number, i: number) => {
        const v = dbViolations[idx];
        return {
          id: v.id,
          code: v.code,
          description: v.description,
          relevanceReason: result.relevanceReasons?.[i] || '',
          violationBasis: v.violationBasisArticle ? {
            lawId: v.violationBasisLaw?.id,
            lawTitle: v.violationBasisLaw?.title || '',
            ref: `第${v.violationBasisArticle.title}条`,
            content: getArticleContent(v.violationBasisArticle, v.violationBasisParagraph, v.violationBasisItem),
          } : null,
          punishmentBasis: v.punishmentBasisArticle ? {
            lawId: v.punishmentBasisLaw?.id,
            lawTitle: v.punishmentBasisLaw?.title || '',
            ref: `第${v.punishmentBasisArticle.title}条`,
            content: getArticleContent(v.punishmentBasisArticle, v.punishmentBasisParagraph, v.punishmentBasisItem),
          } : null,
        };
      });

    // Build matched laws from violations
    const lawMap = new Map<number, MatchedLaw>();
    for (const v of matchedViolations) {
      if (v.violationBasis) {
        const existing = lawMap.get(v.violationBasis.lawId);
        if (existing) {
          if (!existing.relevantArticles.includes(v.violationBasis.ref)) {
            existing.relevantArticles.push(v.violationBasis.ref);
          }
        } else {
          lawMap.set(v.violationBasis.lawId, {
            id: v.violationBasis.lawId,
            title: v.violationBasis.lawTitle,
            status: null,
            relevantArticles: [v.violationBasis.ref],
          });
        }
      }
      if (v.punishmentBasis) {
        const existing = lawMap.get(v.punishmentBasis.lawId);
        if (existing) {
          if (!existing.relevantArticles.includes(v.punishmentBasis.ref)) {
            existing.relevantArticles.push(v.punishmentBasis.ref);
          }
        } else {
          lawMap.set(v.punishmentBasis.lawId, {
            id: v.punishmentBasis.lawId,
            title: v.punishmentBasis.lawTitle,
            status: null,
            relevantArticles: [v.punishmentBasis.ref],
          });
        }
      }
    }

    // Also add DB-matched laws not already in the map
    for (const law of dbLaws) {
      if (!lawMap.has(law.id)) {
        lawMap.set(law.id, {
          id: law.id,
          title: law.title,
          status: law.status,
          relevantArticles: [],
        });
      }
    }

    return {
      summary: result.summary || extracted.behaviorSummary,
      keywords: extracted.keywords,
      branches: {
        violations: matchedViolations,
        laws: Array.from(lawMap.values()),
        punishmentTypes: result.punishmentTypes || [],
        warnings: result.warnings || [],
      },
    };
  } catch {
    // Fallback: return raw DB results without AI organization
    const fallbackViolations: MatchedViolation[] = dbViolations.slice(0, 5).map(v => ({
      id: v.id,
      code: v.code,
      description: v.description,
      relevanceReason: '关键词匹配',
      violationBasis: v.violationBasisArticle ? {
        lawId: v.violationBasisLaw?.id,
        lawTitle: v.violationBasisLaw?.title || '',
        ref: `第${v.violationBasisArticle.title}条`,
        content: getArticleContent(v.violationBasisArticle, v.violationBasisParagraph, v.violationBasisItem),
      } : null,
      punishmentBasis: v.punishmentBasisArticle ? {
        lawId: v.punishmentBasisLaw?.id,
        lawTitle: v.punishmentBasisLaw?.title || '',
        ref: `第${v.punishmentBasisArticle.title}条`,
        content: getArticleContent(v.punishmentBasisArticle, v.punishmentBasisParagraph, v.punishmentBasisItem),
      } : null,
    }));

    return {
      summary: extracted.behaviorSummary,
      keywords: extracted.keywords,
      branches: {
        violations: fallbackViolations,
        laws: dbLaws.map(l => ({ id: l.id, title: l.title, status: l.status, relevantArticles: [] })),
        punishmentTypes: ['待AI分析'],
        warnings: ['AI组织结果失败，以下为关键词匹配结果'],
      },
    };
  }
}

// ==================== Helpers ====================

function getArticleContent(article: any, paragraph: any, item: any): string {
  if (!article) return '';
  if (item) return item.content || '';
  if (paragraph) return paragraph.content || '';
  if (!article.paragraphs?.length) return '';
  return article.paragraphs
    .map((p: any) => {
      let text = p.content || '';
      if (p.items?.length) text += '\n' + p.items.map((i: any) => `${i.number} ${i.content}`).join('\n');
      return text;
    })
    .filter(Boolean)
    .join('\n');
}

async function callZhipuAPI(prompt: string, temperature: number, maxTokens: number): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_API_KEY not configured');

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4-plus',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed (${response.status}): ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  if (!content) throw new Error('AI returned empty content');
  return content;
}

// ==================== Main entry ====================

export async function analyzeCase(description: string): Promise<CaseAnalysisResult> {
  try {
    // Step 1: Extract keywords
    const extracted = await extractKeywords(description);
    console.log('[CaseAnalyzer] Step 1 - Keywords:', extracted.keywords, 'Domain:', extracted.domain);

    // Step 2: Search database
    const { violations, laws } = await searchDatabase(extracted.keywords, extracted.domain);
    console.log('[CaseAnalyzer] Step 2 - Found:', violations.length, 'violations,', laws.length, 'laws');

    // Step 3: Organize results
    const analysis = await organizeResults(description, extracted, violations, laws);
    console.log('[CaseAnalyzer] Step 3 - Organized:', analysis?.branches.violations.length, 'violations');

    return {
      success: true,
      query: description,
      analysis,
    };
  } catch (error) {
    console.error('[CaseAnalyzer] Error:', error);
    return {
      success: false,
      query: description,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
