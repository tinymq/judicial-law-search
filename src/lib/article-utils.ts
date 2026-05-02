export function normalizeArticleTitle(title: string): string {
  const match = title.match(/^第(.+)条$/);
  return match ? match[1] : title;
}

export function formatArticleTitle(
  title: string,
  format: 'standard' | 'ordinal' | 'bare' = 'standard'
): string {
  const bare = normalizeArticleTitle(title);
  switch (format) {
    case 'standard': return `第${bare}条`;
    case 'ordinal': return `${bare}、`;
    case 'bare': return bare;
  }
}
