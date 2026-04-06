import crypto from 'crypto';

export type LawCandidate = {
  id: number;
  title: string;
  lawGroupId: string | null;
  effectiveDate: Date | null;
  promulgationDate: Date | null;
  status: string | null;
  level: string;
};

export type LawMatchType =
  | 'normalized_exact'
  | 'base_title_exact'
  | 'base_title_contains'
  | 'keyword_overlap';

export type RelatedLawCandidate = LawCandidate & {
  normalizedTitle: string;
  baseTitle: string;
  score: number;
  matchType: LawMatchType;
  matchReason: string;
  shouldAutoSelect: boolean;
};

export type RelatedLawMatchResult = {
  inputTitle: string;
  normalizedTitle: string;
  baseTitle: string;
  recommended: RelatedLawCandidate | null;
  candidates: RelatedLawCandidate[];
};

const VERSION_MARKER_RE =
  /[\(\[（【]\s*\d{4}\s*(?:年)?(?:[^)\]）】]{0,20})[\)\]）】]\s*$/g;
const TRAILING_MARKER_RE =
  /(修订|修正|修改|公布|发布|施行|实施|暂行|试行)\s*$/g;
const EXTRA_WHITESPACE_RE = /\s+/g;
const PUNCTUATION_RE = /[《》"'“”‘’]/g;

function normalizeBrackets(value: string): string {
  return value
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/【/g, '[')
    .replace(/】/g, ']');
}

function normalizeFullWidthSpaces(value: string): string {
  return value.replace(/\u3000/g, ' ');
}

function dropTrailingMetadata(value: string): string {
  let current = value.trim();
  let previous = '';

  while (current !== previous) {
    previous = current;
    current = current.replace(VERSION_MARKER_RE, '').trim();
    current = current.replace(TRAILING_MARKER_RE, '').trim();
  }

  return current;
}

export function normalizeLawTitle(title: string): string {
  return normalizeBrackets(normalizeFullWidthSpaces(title))
    .replace(PUNCTUATION_RE, '')
    .replace(EXTRA_WHITESPACE_RE, ' ')
    .trim();
}

export function buildLawBaseTitle(title: string): string {
  const normalized = normalizeLawTitle(title);
  return dropTrailingMetadata(normalized)
    .replace(EXTRA_WHITESPACE_RE, ' ')
    .trim();
}

export function buildLawTitleTokens(title: string): string[] {
  const baseTitle = buildLawBaseTitle(title);
  const tokenSource = baseTitle
    .replace(/[()\-_,，。；：、]/g, ' ')
    .replace(EXTRA_WHITESPACE_RE, ' ')
    .trim();

  const tokens = new Set<string>();

  for (const part of tokenSource.split(' ')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.length >= 2) {
      tokens.add(trimmed);
    }

    for (let i = 0; i < trimmed.length - 1; i++) {
      const segment = trimmed.slice(i, i + 2);
      if (segment.length === 2) {
        tokens.add(segment);
      }
    }
  }

  return Array.from(tokens);
}

export function generateLawGroupId(title: string): string {
  const baseTitle = buildLawBaseTitle(title);
  const hash = crypto.createHash('md5').update(baseTitle).digest('hex');
  return `LAW_${hash.substring(0, 12).toUpperCase()}`;
}

function scoreCandidate(inputTitle: string, law: LawCandidate): RelatedLawCandidate {
  const normalizedInput = normalizeLawTitle(inputTitle);
  const baseInput = buildLawBaseTitle(inputTitle);
  const normalizedLawTitle = normalizeLawTitle(law.title);
  const baseLawTitle = buildLawBaseTitle(law.title);

  let score = 0;
  let matchType: LawMatchType = 'keyword_overlap';
  let matchReason = '标题存在部分关键词重叠';

  if (normalizedLawTitle === normalizedInput) {
    score = 1;
    matchType = 'normalized_exact';
    matchReason = '标准化标题完全一致';
  } else if (baseLawTitle === baseInput) {
    score = 0.98;
    matchType = 'base_title_exact';
    matchReason = '去除版本信息后标题一致';
  } else if (baseInput && baseLawTitle &&
    (baseLawTitle.includes(baseInput) || baseInput.includes(baseLawTitle))) {
    const shorter = Math.min(baseInput.length, baseLawTitle.length);
    const longer = Math.max(baseInput.length, baseLawTitle.length);
    score = 0.82 + shorter / Math.max(longer, 1) * 0.1;
    matchType = 'base_title_contains';
    matchReason = '核心标题高度接近';
  } else {
    const inputTokens = buildLawTitleTokens(inputTitle);
    const lawTokens = new Set(buildLawTitleTokens(law.title));
    const overlap = inputTokens.filter(token => lawTokens.has(token));
    const denominator = Math.max(inputTokens.length, 1);
    score = overlap.length / denominator * 0.75;
    matchType = 'keyword_overlap';
    matchReason = overlap.length > 0
      ? `匹配到 ${overlap.length} 个标题关键词`
      : '未匹配到足够标题关键词';
  }

  return {
    ...law,
    normalizedTitle: normalizedLawTitle,
    baseTitle: baseLawTitle,
    score,
    matchType,
    matchReason,
    shouldAutoSelect: score >= 0.95,
  };
}

export function findRelatedLawCandidates(
  inputTitle: string,
  laws: LawCandidate[],
  options?: { excludeLawId?: number }
): RelatedLawMatchResult {
  const filtered = laws.filter(law => law.id !== options?.excludeLawId);
  const scored = filtered
    .map(law => scoreCandidate(inputTitle, law))
    .filter(candidate => candidate.score >= 0.45)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const dateA = a.effectiveDate?.getTime() ?? a.promulgationDate?.getTime() ?? 0;
      const dateB = b.effectiveDate?.getTime() ?? b.promulgationDate?.getTime() ?? 0;
      return dateB - dateA;
    });

  return {
    inputTitle,
    normalizedTitle: normalizeLawTitle(inputTitle),
    baseTitle: buildLawBaseTitle(inputTitle),
    recommended: scored[0] ?? null,
    candidates: scored.slice(0, 10),
  };
}
