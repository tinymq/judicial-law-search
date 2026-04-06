/**
 * AI 案件分析 API
 * POST /api/ai/analyze-case
 * Body: { description: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeCase } from '@/src/lib/ai/case-analyzer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: '请输入至少5个字的案件描述' },
        { status: 400 }
      );
    }

    const result = await analyzeCase(description.trim());

    return NextResponse.json(result);
  } catch (error) {
    console.error('案件分析失败:', error);
    return NextResponse.json(
      { success: false, error: `服务器错误: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
