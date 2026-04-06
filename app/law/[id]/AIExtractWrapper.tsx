'use client';

import { useState } from 'react';
import AIExtractButton from './AIExtractButton';
import SplitViewViolationModal from './SplitViewViolationModal';

interface Article {
  id: number;
  title: string;
  chapter: string | null;
  section: string | null;
  paragraphs: Array<{
    id: number;
    number: string | null;
    content: string | null;
    items: Array<{
      id: number;
      number: string;
      content: string;
    }>;
  }>;
}

interface AIExtractWrapperProps {
  lawId: number;
  lawTitle: string;
  articles: Article[];
}

export default function AIExtractWrapper({
  lawId,
  lawTitle,
  articles
}: AIExtractWrapperProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [violations, setViolations] = useState<any[]>([]);

  const handleExtractComplete = (result: any[]) => {
    if (result && result.length > 0) {
      setViolations(result);
      setIsModalOpen(true);
    } else {
      alert('AI 未识别出任何违法行为');
    }
  };

  return (
    <>
      <AIExtractButton
        lawId={lawId}
        lawTitle={lawTitle}
        articles={articles}
        onExtractComplete={handleExtractComplete}
      />

      <SplitViewViolationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lawId={lawId}
        lawTitle={lawTitle}
        articles={articles}
        violations={violations}
      />
    </>
  );
}
