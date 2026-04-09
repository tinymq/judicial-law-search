import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

// PUT /api/enforcement/[id]/link-law  body: { lawId: number | null }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const itemId = parseInt(id);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: '无效的事项ID' }, { status: 400 });
  }

  const body = await request.json();
  const lawId = body.lawId === null ? null : parseInt(body.lawId);

  if (lawId !== null && isNaN(lawId)) {
    return NextResponse.json({ error: '无效的法规ID' }, { status: 400 });
  }

  // 验证法规存在
  if (lawId !== null) {
    const law = await prisma.law.findUnique({ where: { id: lawId }, select: { id: true } });
    if (!law) {
      return NextResponse.json({ error: '法规不存在' }, { status: 404 });
    }
  }

  const updated = await prisma.enforcementItem.update({
    where: { id: itemId },
    data: { lawId },
    include: { law: { select: { id: true, title: true, level: true, issuingAuthority: true } } },
  });

  return NextResponse.json({ success: true, law: updated.law });
}
