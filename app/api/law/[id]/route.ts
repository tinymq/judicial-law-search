import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lawId = parseInt(id);

  if (isNaN(lawId)) {
    return NextResponse.json({ error: '无效的法规ID' }, { status: 400 });
  }

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
    return NextResponse.json({ error: '法规不存在' }, { status: 404 });
  }

  return NextResponse.json(law);
}
