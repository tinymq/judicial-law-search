'use client'

import { useRef } from 'react';

export default function HoverDetails({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  return (
    <details
      ref={ref}
      className={className}
      onMouseEnter={() => { if (ref.current) ref.current.open = true; }}
      onMouseLeave={() => { if (ref.current) ref.current.open = false; }}
    >
      {children}
    </details>
  );
}
