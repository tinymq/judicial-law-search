import EditLawClient from './EditLawClient';
import { getLawWithArticles, getLawIndustries } from '../../actions';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lawId = parseInt(id);

  if (isNaN(lawId)) {
    return {
      title: '编辑法规',
    };
  }

  const law = await getLawWithArticles(lawId);

  if (!law) {
    return {
      title: '法规未找到',
    };
  }

  return {
    title: `编辑 ${law.title}`,
  };
}

export default async function EditLawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lawId = parseInt(id);

  if (isNaN(lawId)) {
    notFound();
  }

  const law = await getLawWithArticles(lawId);

  if (!law) {
    notFound();
  }

  const lawIndustries = await getLawIndustries(lawId);

  return <EditLawClient law={{ ...law, lawIndustries }} />;
}
