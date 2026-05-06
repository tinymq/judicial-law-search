/**
 * 解析 legalBasisText，拆分为独立的执法依据条目。
 *
 * 支持三种格式：
 *   A. 编号格式：1.《法规A》...\n第X条：...\n2.《法规B》...
 *   B. 无编号有《》：《法规A》...\n第X条：...\n《法规B》...
 *   C. 无编号裸名：法规名A\n第X条：...\n法规名B\n第X条：...
 *
 * 每条依据的"法规名"是条目开头的名称，条文正文中出现的《》是交叉引用。
 */

export interface LegalBasisEntry {
  index: number;
  lawName: string;        // 清洗后的法规名
  rawText: string;        // 该条依据的完整原文
}

// 法规名称尾部关键词（用于识别裸名行）
const LAW_SUFFIX_RE = /(?:法|条例|办法|规定|细则|决定|通知|意见|标准|规则|规程|规范|制度|命令|公约|守则|章程|纲要|方案|措施|目录|清单)(?:\s|$|[（(]|\d)/;

// 识别法规名行（含可选的发布机关和日期后缀）
const LAW_LINE_FULL_RE = /^(?:《([^》]+)》|([^第（(\d\s][^\n]{3,}?))\s*(?:\s+\S+\s+\d{4}-\d{2}-\d{2})?$/;

// 条文行（第X条/第X章等开头）
const ARTICLE_LINE_RE = /^第[一二三四五六七八九十百千零○〇\d]+[条章节款项]/;

// 编号开头 pattern
const NUMBERED_RE = /^\d+\s*[.．、]\s*《/;

export function parseLegalBasis(text: string): LegalBasisEntry[] {
  if (!text || !text.trim()) return [];

  // 修复格式：编号与《之间的点号位置错误
  let cleaned = text.replace(/(\d+)《\s*[.．]\s*/g, '$1.《');
  cleaned = cleaned.replace(/(\d+)\s*[.．、]\s*《/g, '$1.《');

  // 策略A：按编号拆分（1.《...  2.《...）
  if (/(?:^|\n)\d+\.《/.test(cleaned)) {
    const parts = cleaned.split(/(?<=[\n。！？]|^)(?=\d+\.《)/);
    const entries: LegalBasisEntry[] = [];
    let idx = 1;
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const entry = parseOneEntry(trimmed, idx);
      if (entry) { entries.push(entry); idx++; }
    }
    if (entries.length > 0) return entries;
  }

  // 策略B/C：按法规名行拆分（逐行扫描）
  return splitByLawNameLines(cleaned);
}

/**
 * 逐行扫描，识别法规名行作为分隔点，将文本拆分为多条依据。
 */
function splitByLawNameLines(text: string): LegalBasisEntry[] {
  const lines = text.split('\n');
  const segments: { startLine: number; lawName: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 跳过条文行
    if (ARTICLE_LINE_RE.test(line)) continue;
    // 跳过条文内容行（较长且不像法规名）
    if (i > 0 && line.length > 80 && !isLawNameLine(line)) continue;

    if (isLawNameLine(line)) {
      const lawName = extractLawNameFromLine(line);
      if (lawName) {
        segments.push({ startLine: i, lawName });
      }
    }
  }

  if (segments.length === 0) {
    // fallback：整体作为一条
    const entry = parseOneEntry(text, 1);
    return entry ? [entry] : [];
  }

  const entries: LegalBasisEntry[] = [];
  for (let s = 0; s < segments.length; s++) {
    const start = segments[s].startLine;
    const end = s + 1 < segments.length ? segments[s + 1].startLine : lines.length;
    const rawText = lines.slice(start, end).join('\n').trim();
    if (rawText) {
      entries.push({
        index: s + 1,
        lawName: cleanLawName(segments[s].lawName),
        rawText,
      });
    }
  }

  // 如果第一个 segment 不从第0行开始，前面的文本作为第一条
  if (segments.length > 0 && segments[0].startLine > 0) {
    const prefix = lines.slice(0, segments[0].startLine).join('\n').trim();
    if (prefix) {
      const prefixEntry = parseOneEntry(prefix, 0);
      if (prefixEntry) {
        entries.unshift({ ...prefixEntry, index: 0 });
        entries.forEach((e, i) => e.index = i + 1);
      }
    }
  }

  return entries;
}

function isLawNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 4) return false;

  // 以《开头的法规名
  if (/^《[^》]+》/.test(trimmed)) return true;

  // 裸名：以法规关键词结尾，或后跟 (年份修正) / 发布机关 日期
  // 排除条文行
  if (ARTICLE_LINE_RE.test(trimmed)) return false;
  // 排除项号开头
  if (/^[（(][一二三四五六七八九十\d]+[）)]/.test(trimmed)) return false;
  // 排除纯条文内容（以标点结尾的长句）
  if (trimmed.length > 60 && /[。；！？]$/.test(trimmed)) return false;

  // 检查法规名特征
  const nameOnly = trimmed
    .replace(/\s+\S+\s+\d{4}-\d{2}-\d{2}$/, '')  // 去掉 "发布机关 日期"
    .replace(/[（(]\d{4}[年修正订]*[）)]$/, '')       // 去掉 (2018修正)
    .trim();

  if (LAW_SUFFIX_RE.test(nameOnly + ' ')) return true;

  // "XXX的决定" pattern
  if (/的决定$/.test(nameOnly)) return true;

  return false;
}

function extractLawNameFromLine(line: string): string | null {
  const trimmed = line.trim();

  // 《法规名》后可能跟发布机关和日期
  const bracketMatch = trimmed.match(/^《([^》]+)》/);
  if (bracketMatch) return bracketMatch[1];

  // 裸名：去掉末尾的发布机关+日期
  const nameOnly = trimmed
    .replace(/\s{2,}\S+\s+\d{4}-\d{2}-\d{2}$/, '')  // "  发布机关  日期"
    .trim();

  return nameOnly || null;
}

function parseOneEntry(text: string, index: number): LegalBasisEntry | null {
  // 从开头提取法规名
  const bracketMatch = text.match(/^(?:\d+[.．、]?\s*)?《([^》]+)》/);
  if (bracketMatch) {
    return { index, lawName: cleanLawName(bracketMatch[1]), rawText: text };
  }

  // 无《》：第一行就是法规名
  const firstLine = text.split(/\n/)[0].replace(/^\d+[.．、]?\s*/, '').trim();
  if (firstLine && firstLine.length >= 4) {
    const nameOnly = firstLine
      .replace(/\s{2,}\S+\s+\d{4}-\d{2}-\d{2}$/, '')
      .trim();
    return { index, lawName: cleanLawName(nameOnly), rawText: text };
  }

  return null;
}

function cleanLawName(name: string): string {
  return name
    .replace(/^《|》$/g, '')
    .replace(/[\r\n]+/g, '')
    .replace(/^\s*[.．、]\s*/, '')
    .trim();
}

/**
 * 从 legalBasisText 中提取执法依据法规名（仅提取每条依据的法规名，
 * 不提取条文正文中的交叉引用）。
 */
export function extractBasisLawNames(text: string): string[] {
  const entries = parseLegalBasis(text);
  return entries.map(e => e.lawName).filter(n => n.length >= 3);
}

/**
 * 格式化 legalBasisText 用于展示：按编号拆分，每条之间空行分隔。
 */
export function formatLegalBasisForDisplay(text: string): string {
  const entries = parseLegalBasis(text);
  if (entries.length === 0) return text;
  if (entries.length === 1) return entries[0].rawText;
  return entries.map(e => e.rawText).join('\n\n');
}
