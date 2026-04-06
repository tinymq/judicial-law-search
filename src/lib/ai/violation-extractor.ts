/**
 * AI 违法行为提取器
 * 使用智谱 GLM API 从法规中提取违法行为
 */

export interface ExtractedViolation {
  description: string;
  violationArticleTitle: string;
  violationContent: string;
  punishmentArticleTitle: string;
  punishmentContent: string;
  punishmentSuggestion: string;
}

export interface ExtractResult {
  success: boolean;
  violations?: ExtractedViolation[];
  error?: string;
  rawContent?: string;
}

/**
 * 构建 Prompt
 */
function buildPrompt(lawTitle: string, lawContent: string): string {
  return `你是一名市场监管法规分析专家。请分析以下法规，提取所有可能的违法行为。

法规标题：${lawTitle}

法规内容：
${lawContent}

请以 JSON 数组格式返回，格式如下：
[
  {
    "description": "违法行为描述（不超过50字）",
    "violationArticleTitle": "第二十一条",
    "violationContent": "摘要（不超过50字）",
    "punishmentArticleTitle": "第九十四条",
    "punishmentContent": "摘要（不超过50字）",
    "punishmentSuggestion": "处罚内容（不超过50字）"
  }
]

关键规则：
1. 条款标题只返回编号（如"第二十一条"），不要章节信息
2. 违法依据 = 定义义务的条款，处罚依据 = 法律责任条款
3. 每条描述不超过50字
4. 禁止/应当/必须等词 = 违法行为线索
5. 直接输出 JSON，不要解释`;
}

/**
 * 调用智谱 GLM-4-flash API 提取违法行为
 */
export async function extractViolationsFromLaw(
  lawTitle: string,
  lawContent: string
): Promise<ExtractResult> {
  const apiKey = process.env.ZHIPU_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: 'ZHIPU_API_KEY not configured'
    };
  }

  const maxContentLength = 120000;
  const truncatedContent = lawContent.length > maxContentLength 
    ? lawContent.substring(0, maxContentLength) 
    : lawContent;

  const prompt = buildPrompt(lawTitle, truncatedContent);
  const startTime = Date.now();

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4-plus',  // glm-4-plus 支持更高输出
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 32000
      })
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API call failed (${response.status}): ${errorText.substring(0, 200)}`
      };
    }

    const data = await response.json();
    
    if (data.error) {
      return {
        success: false,
        error: `API error: ${JSON.stringify(data.error)}`
      };
    }

    const message = data.choices?.[0]?.message;
    let content = message?.content || '';

    // 如果 content 为空，尝试从 reasoning_content 提取
    if (!content && message?.reasoning_content) {
      content = message.reasoning_content;
    }

    if (!content) {
      return {
        success: false,
        error: 'AI returned empty content'
      };
    }

    // 解析 JSON
    const violations = parseAIResponse(content);

    return {
      success: true,
      violations,
      rawContent: content
    };

  } catch (error) {
    return {
      success: false,
      error: `Exception: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 解析 AI 返回的 JSON
 */
function parseAIResponse(content: string): ExtractedViolation[] {
  // 清理内容
  let cleanedContent = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/^\s*[\u4e00-\u9fa5]+[：:]\s*/gm, '')  // 移除中文标签
    .trim();

  // 尝试直接解析
  try {
    const result = JSON.parse(cleanedContent);
    if (Array.isArray(result)) {
      return result;
    }
  } catch (e) {
    // 直接解析失败，尝试提取 JSON 数组
  }

  // 提取 JSON 数组
  const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]);
      if (Array.isArray(result)) {
        return result;
      }
    } catch (e) {
      // 提取后解析失败
    }
  }

  return [];
}
