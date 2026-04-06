import { prisma } from '@/src/lib/db';
import { updateViolation } from '@/app/admin/actions';
import { notFound, redirect } from 'next/navigation';
import SplitViewViolationForm from '../../SplitViewViolationForm';

export const dynamic = 'force-dynamic';

export default async function EditViolationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 获取违法行为数据
  const violation = await prisma.violation.findUnique({
    where: { id: parseInt(id) },
    include: {
      violationBasisLaw: true,
      violationBasisArticle: true,
      punishmentBasisLaw: true,
      punishmentBasisArticle: true,
    },
  });

  if (!violation) {
    notFound();
  }

  // 只获取法规基本信息（id + title），条款按需加载
  const laws = await prisma.law.findMany({
    where: { status: '现行有效' },
    orderBy: { title: 'asc' },
    select: {
      id: true,
      title: true,
    }
  });

  async function handleSave(data: {
    description: string;
    violationBasisLawId: number | null;
    violationBasisArticleId: number | null;
    punishmentBasisLawId: number | null;
    punishmentBasisArticleId: number | null;
    punishmentSuggestion: string | null;
  }) {
    'use server';
    
    await updateViolation(violation!.id, {
      description: data.description,
      violationBasisLawId: data.violationBasisLawId,
      violationBasisArticleId: data.violationBasisArticleId,
      violationBasisParagraphId: null,
      violationBasisItemId: null,
      punishmentBasisLawId: data.punishmentBasisLawId,
      punishmentBasisArticleId: data.punishmentBasisArticleId,
      punishmentBasisParagraphId: null,
      punishmentBasisItemId: null,
      sentencingGuidelines: null,
      punishmentSuggestion: data.punishmentSuggestion,
    });

    redirect('/admin/violations');
  }

  async function handleCancel() {
    'use server';
    redirect('/admin/violations');
  }

  // 准备初始数据
  const initialData = {
    description: violation.description,
    violationBasisLawId: violation.violationBasisLawId,
    violationBasisArticleId: violation.violationBasisArticleId,
    punishmentBasisLawId: violation.punishmentBasisLawId,
    punishmentBasisArticleId: violation.punishmentBasisArticleId,
    punishmentSuggestion: violation.punishmentSuggestion,
  };

  return (
    <SplitViewViolationForm
      mode="edit"
      initialData={initialData}
      laws={laws}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
