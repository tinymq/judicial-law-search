'use client'

import { useRef } from 'react';

interface ResizableHeaderProps {
  children: React.ReactNode;
  width: number;
  onResize: (e: any, data: { size: { width: number } }) => void;
  dataKey: string;
  className?: string;
  onClick?: () => void;
  stickyTop?: number;
}

export default function ResizableHeader({
  children,
  width,
  onResize,
  dataKey,
  className = '',
  onClick,
  stickyTop = 0,
}: ResizableHeaderProps) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isResizingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isResizingRef.current) return;
    if (!mouseDownPosRef.current) {
      onClick?.();
      return;
    }
    const deltaX = Math.abs(e.clientX - mouseDownPosRef.current.x);
    const deltaY = Math.abs(e.clientY - mouseDownPosRef.current.y);
    if (deltaX < 5 && deltaY < 5) {
      onClick?.();
    }
    mouseDownPosRef.current = null;
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = thRef.current?.offsetWidth ?? width;
    isResizingRef.current = true;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(50, Math.min(500, startWidth + moveEvent.clientX - startX));
      onResize(moveEvent, { size: { width: newWidth } });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setTimeout(() => { isResizingRef.current = false; }, 0);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <th
      ref={thRef}
      data-column={dataKey}
      className={`px-3 py-3 text-left text-xs font-bold text-slate-600 uppercase ${className}`}
      style={{
        width: `${width}px`,
        position: 'sticky',
        top: stickyTop,
        zIndex: 10,
        backgroundColor: 'rgb(248, 250, 252)',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {children}
      <div className="col-resize-handle" onMouseDown={handleResizeStart} />
    </th>
  );
}
