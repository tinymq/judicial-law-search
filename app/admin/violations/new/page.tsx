import { prisma } from '@/src/lib/db';
import { createViolation } from '@/app/admin/actions';
import { redirect } from 'next/navigation';
import SplitViewViolationForm from '../SplitViewViolationForm';

export default async function NewViolationPage() {
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
    
    await createViolation({
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

  return (
    <SplitViewViolationForm
      mode="create"
      laws={laws}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
