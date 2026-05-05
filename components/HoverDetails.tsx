'use client'

import { useRef, useEffect, useState } from 'react';

export default function HoverDetails({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (ref.current) ref.current.open = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const trigger = el.querySelector('[data-hover-trigger]');
    if (!trigger) return;
    const open = () => setIsOpen(true);
    trigger.addEventListener('mouseenter', open);
    return () => trigger.removeEventListener('mouseenter', open);
  }, []);

  return (
    <details
      ref={ref}
      className={className}
      onMouseLeave={() => setIsOpen(false)}
      onClick={(e) => {
        const summary = (e.target as HTMLElement).closest('summary');
        if (summary && summary.parentElement === ref.current) e.preventDefault();
      }}
    >
      {children}
    </details>
  );
}
