/**
 * AI 提供者抽象接口
 *
 * 用于执法事项提取等 AI 功能。
 * 设计为可插拔的提供者模式，支持 OpenAI、Claude、通义千问等任意 LLM API。
 *
 * 使用方式：
 *   1. 实现 AIProvider 接口
 *   2. 在 createProvider() 中注册
 *   3. 通过环境变量 AI_PROVIDER 选择提供者
 */

// ============================================================
// 类型定义
// ============================================================

/** AI 提取出的单条执法事项 */
export interface ExtractedEnforcementItem {
  /** 事项名称 — 格式：检查对象+检查内容+行政检查 */
  name: string;
  /** 执法类别 — 行政检查 / 行政处罚 / 行政许可 / 行政强制 */
  category: string;
  /** 执法主体（实施层级）— 如"省级""市级""县级" */
  enforcementBody?: string;
  /** 执法依据原文 — 法规中的具体条款引用 */
  legalBasisText?: string;
  /** 相关条款号 — 如 ["第十条", "第十一条"] */
  relatedArticles?: string[];
  /** 备注 */
  remarks?: string;
}

/** AI 提取的完整结果 */
export interface ExtractionResult {
  /** 法规 ID */
  lawId: number;
  /** 法规标题 */
  lawTitle: string;
  /** 提取出的执法事项列表 */
  items: ExtractedEnforcementItem[];
  /** 提取耗时（毫秒） */
  durationMs: number;
  /** 原始 AI 回复（用于调试） */
  rawResponse?: string;
}

/** 传给 AI 的法规内容 */
export interface LawContent {
  lawId: number;
  title: string;
  level: string;
  issuingAuthority?: string;
  articles: {
    title: string;       // 条款号，如"第十条"
    chapter?: string;
    section?: string;
    content: string;     // 条款全文（含款、项）
  }[];
}

/** AI 提供者接口 */
export interface AIProvider {
  /** 提供者名称 */
  readonly name: string;

  /**
   * 从法规内容中提取行政检查事项
   * @param law 法规内容
   * @returns 提取结果
   */
  extractEnforcementItems(law: LawContent): Promise<ExtractionResult>;
}

// ============================================================
// 提示词模板
// ============================================================

/**
 * 生成行政检查事项提取的系统提示词
 */
export function getSystemPrompt(): string {
  return `你是一位专业的法律文本分析专家，擅长从法规条文中提取行政检查事项。

## 任务
从给定的法规条文中，识别并提取所有的**行政检查事项**。

## 提取规则
1. **事项名称**：格式为"检查对象+检查内容+行政检查"
   - 示例："危险化学品经营企业安全生产条件行政检查"
   - 示例："食品生产经营者食品安全状况行政检查"
2. **执法类别**：固定为"行政检查"
3. **执法主体**：根据法规内容判断实施层级（省级/市级/县级/各级）
4. **执法依据**：引用具体条款原文
5. **相关条款**：列出涉及的条款号

## 识别信号
以下关键词/句式通常表示行政检查事项：
- "监督检查"、"检查"、"核查"、"巡查"、"抽查"
- "有权检查"、"应当检查"、"定期检查"
- "监督管理部门"+"检查/监督"
- "进入...检查"、"查阅...资料"、"询问..."

## 输出格式
请以 JSON 数组格式输出，每个元素包含：
\`\`\`json
[
  {
    "name": "检查对象+检查内容+行政检查",
    "category": "行政检查",
    "enforcementBody": "实施层级",
    "legalBasisText": "法规中的依据原文",
    "relatedArticles": ["第X条"],
    "remarks": "补充说明（可选）"
  }
]
\`\`\`

## 注意事项
- 只提取**行政检查**类事项，不要提取行政处罚、行政许可等
- 如果法规中没有行政检查事项，返回空数组 \`[]\`
- 名称要具体、完整，能准确描述检查事项的对象和内容
- 执法依据尽量引用原文，但不要过长（控制在200字以内）`;
}

/**
 * 生成用户提示词（包含法规内容）
 */
export function getUserPrompt(law: LawContent): string {
  let prompt = `请分析以下法规，提取其中的行政检查事项。\n\n`;
  prompt += `## 法规信息\n`;
  prompt += `- 标题：${law.title}\n`;
  prompt += `- 效力位阶：${law.level}\n`;
  if (law.issuingAuthority) {
    prompt += `- 制定机关：${law.issuingAuthority}\n`;
  }
  prompt += `\n## 法规条文\n\n`;

  for (const article of law.articles) {
    if (article.chapter) prompt += `【${article.chapter}】`;
    if (article.section) prompt += `【${article.section}】`;
    prompt += `${article.title}\n${article.content}\n\n`;
  }

  prompt += `\n请以 JSON 数组格式输出提取结果。如果没有行政检查事项，返回 \`[]\`。`;
  return prompt;
}

// ============================================================
// Mock 提供者（开发/测试用）
// ============================================================

/**
 * Mock AI 提供者 — 返回空结果，用于测试脚本流程
 */
export class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  async extractEnforcementItems(law: LawContent): Promise<ExtractionResult> {
    // 简单模拟：扫描条文中的检查关键词
    const items: ExtractedEnforcementItem[] = [];
    const checkKeywords = ['监督检查', '检查', '核查', '巡查', '抽查'];

    for (const article of law.articles) {
      const content = article.content || '';
      const hasCheck = checkKeywords.some(kw => content.includes(kw));
      if (hasCheck && content.includes('检查')) {
        items.push({
          name: `[Mock] ${law.title}相关行政检查`,
          category: '行政检查',
          enforcementBody: '各级',
          legalBasisText: content.slice(0, 200),
          relatedArticles: [article.title],
          remarks: 'Mock提取结果，仅用于流程测试',
        });
      }
    }

    return {
      lawId: law.lawId,
      lawTitle: law.title,
      items,
      durationMs: 0,
    };
  }
}

// ============================================================
// OpenAI 兼容提供者（适配大多数国内外 LLM API）
// ============================================================

/**
 * OpenAI 兼容的 AI 提供者
 *
 * 支持所有兼容 OpenAI Chat Completions API 的服务：
 * - OpenAI (api.openai.com)
 * - 通义千问 (dashscope.aliyuncs.com)
 * - 智谱 ChatGLM (open.bigmodel.cn)
 * - DeepSeek (api.deepseek.com)
 * - 本地 Ollama (localhost:11434)
 *
 * 环境变量：
 *   AI_BASE_URL  — API 基础地址（必填）
 *   AI_API_KEY   — API 密钥（必填）
 *   AI_MODEL     — 模型名称（必填）
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(options: { baseUrl: string; apiKey: string; model: string; name?: string }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.name = options.name || 'openai-compatible';
  }

  async extractEnforcementItems(law: LawContent): Promise<ExtractionResult> {
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: getSystemPrompt() },
          { role: 'user', content: getUserPrompt(law) },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '[]';
    const durationMs = Date.now() - start;

    const items = parseAIResponse(rawContent);

    return {
      lawId: law.lawId,
      lawTitle: law.title,
      items,
      durationMs,
      rawResponse: rawContent,
    };
  }
}

// ============================================================
// 响应解析
// ============================================================

/**
 * 解析 AI 返回的 JSON 字符串为结构化结果
 */
export function parseAIResponse(raw: string): ExtractedEnforcementItem[] {
  try {
    // 尝试直接解析
    let parsed = JSON.parse(raw);

    // 如果返回的是 { items: [...] } 格式
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.items)) {
      parsed = parsed.items;
    }

    if (!Array.isArray(parsed)) {
      console.warn('AI 返回格式不是数组，跳过');
      return [];
    }

    return parsed
      .filter((item: any) => item && item.name)
      .map((item: any) => ({
        name: String(item.name || ''),
        category: String(item.category || '行政检查'),
        enforcementBody: item.enforcementBody ? String(item.enforcementBody) : undefined,
        legalBasisText: item.legalBasisText ? String(item.legalBasisText) : undefined,
        relatedArticles: Array.isArray(item.relatedArticles) ? item.relatedArticles.map(String) : undefined,
        remarks: item.remarks ? String(item.remarks) : undefined,
      }));
  } catch {
    // 尝试从 markdown 代码块中提取 JSON
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return parseAIResponse(jsonMatch[1].trim());
    }

    console.warn('无法解析 AI 返回内容:', raw.slice(0, 200));
    return [];
  }
}

// ============================================================
// 工厂函数
// ============================================================

/**
 * 根据环境变量创建 AI 提供者实例
 *
 * 环境变量：
 *   AI_PROVIDER  — 提供者类型：mock | openai-compatible（默认 mock）
 *   AI_BASE_URL  — API 基础地址
 *   AI_API_KEY   — API 密钥
 *   AI_MODEL     — 模型名称
 */
export function createProvider(): AIProvider {
  const providerType = process.env.AI_PROVIDER || 'mock';

  switch (providerType) {
    case 'mock':
      return new MockAIProvider();

    case 'openai-compatible': {
      const baseUrl = process.env.AI_BASE_URL;
      const apiKey = process.env.AI_API_KEY;
      const model = process.env.AI_MODEL;

      if (!baseUrl || !apiKey || !model) {
        throw new Error(
          '使用 openai-compatible 提供者需要设置环境变量：AI_BASE_URL, AI_API_KEY, AI_MODEL\n' +
          '示例：\n' +
          '  AI_BASE_URL=https://api.deepseek.com/v1 AI_API_KEY=sk-xxx AI_MODEL=deepseek-chat\n' +
          '  AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 AI_API_KEY=sk-xxx AI_MODEL=qwen-plus'
        );
      }

      return new OpenAICompatibleProvider({
        baseUrl,
        apiKey,
        model,
        name: process.env.AI_PROVIDER_NAME || 'openai-compatible',
      });
    }

    default:
      throw new Error(`未知的 AI 提供者: ${providerType}。支持: mock, openai-compatible`);
  }
}
