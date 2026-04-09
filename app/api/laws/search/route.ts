import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

// GET /api/laws/search?q=关键词&limit=10
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '10'), 50);

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  // 搜索法规，同组只取最新版
  const laws = await prisma.law.findMany({
    where: { title: { contains: q } },
    select: { id: true, title: true, level: true, issuingAuthority: true, lawGroupId: true, effectiveDate: true },
    orderBy: { effectiveDate: 'desc' },
    take: limit * 3, // 多取一些用于去重
  });

  // 按 lawGroupId 去重，保留最新版
  const seen = new Set<string>();
  const results: typeof laws = [];
  for (const law of laws) {
    const key = law.lawGroupId || `solo_${law.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(law);
    if (results.length >= limit) break;
  }

  return NextResponse.json(results);
}
