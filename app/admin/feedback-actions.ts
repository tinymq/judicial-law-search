'use server';

import { prisma } from '@/src/lib/db';
import { revalidatePath } from 'next/cache';
import { FEEDBACK_ISSUE_TYPES, FEEDBACK_STATUS_OPTIONS } from '@/src/lib/feedback-config';

export async function submitFeedback(data: {
  lawId: number;
  lawTitle: string;
  issueType: string;
  description: string;
  contact?: string;
}): Promise<{ success: boolean; message: string }> {
  const description = data.description.trim();
  if (!description) {
    return { success: false, message: '请填写问题描述' };
  }

  if (!FEEDBACK_ISSUE_TYPES.includes(data.issueType as any)) {
    return { success: false, message: '无效的问题类型' };
  }

  try {
    await prisma.lawFeedback.create({
      data: {
        lawId: data.lawId,
        lawTitle: data.lawTitle,
        issueType: data.issueType,
        description,
        contact: data.contact?.trim() || null,
      },
    });
    revalidatePath('/admin/feedback');
    return { success: true, message: '反馈提交成功，感谢您的帮助！' };
  } catch (error) {
    console.error('提交反馈失败:', error);
    return { success: false, message: '提交失败，请稍后重试' };
  }
}

export async function getFeedbackList(params: {
  status?: string;
  issueType?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const pageSize = [20, 50, 100].includes(params.pageSize || 0) ? params.pageSize! : 20;

  const where: any = {};
  if (params.status && FEEDBACK_STATUS_OPTIONS.includes(params.status as any)) {
    where.status = params.status;
  }
  if (params.issueType && FEEDBACK_ISSUE_TYPES.includes(params.issueType as any)) {
    where.issueType = params.issueType;
  }

  const [feedbacks, total] = await Promise.all([
    prisma.lawFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lawFeedback.count({ where }),
  ]);

  return {
    feedbacks,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function updateFeedbackStatus(
  id: number,
  data: { status?: string; adminNote?: string }
) {
  const updateData: any = {};
  if (data.status && FEEDBACK_STATUS_OPTIONS.includes(data.status as any)) {
    updateData.status = data.status;
  }
  if (data.adminNote !== undefined) {
    updateData.adminNote = data.adminNote;
  }

  await prisma.lawFeedback.update({
    where: { id },
    data: updateData,
  });
  revalidatePath('/admin/feedback');
}

export async function deleteFeedback(id: number) {
  await prisma.lawFeedback.delete({ where: { id } });
  revalidatePath('/admin/feedback');
}

export async function getFeedbackStats() {
  const [total, pending, processing, resolved, ignored] = await Promise.all([
    prisma.lawFeedback.count(),
    prisma.lawFeedback.count({ where: { status: '待处理' } }),
    prisma.lawFeedback.count({ where: { status: '处理中' } }),
    prisma.lawFeedback.count({ where: { status: '已解决' } }),
    prisma.lawFeedback.count({ where: { status: '已忽略' } }),
  ]);
  return { total, pending, processing, resolved, ignored };
}
