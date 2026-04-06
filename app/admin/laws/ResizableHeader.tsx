'use client'

import { useRef } from 'react';
import { Resizable } from 'react-resizable';

interface ResizableHeaderProps {
  children: React.ReactNode;
  width: number;
  onResize: (e: any, data: { size: { width: number } }) => void;
  dataKey: string;
  className?: string;
  onClick?: () => void;
  stickyLeft?: boolean;
  stickyRight?: boolean;
}

export default function ResizableHeader({
  children,
  width,
  onResize,
  dataKey,
  className = '',
  onClick,
  stickyLeft = false,
  stickyRight = false,
}: ResizableHeaderProps) {
  const zIndex = stickyLeft || stickyRight ? 15 : 10;

  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
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

  return (
    <Resizable
      width={width}
      height={0}
      minConstraints={[50, 0]}
      maxConstraints={[500, 0]}
      onResize={onResize}
      handle={<span className="react-resizable-handle" />}
      data-key={dataKey}
    >
      <th
        data-column={dataKey}
        className={`px-3 py-3 text-left text-xs font-bold text-slate-600 uppercase react-resizable ${className} ${stickyLeft ? 'sticky-left-col' : ''} ${stickyRight ? 'sticky-right-col' : ''}`}
        style={{
          width: `${width}px`,
          position: 'sticky',
          top: '0px',
          left: stickyLeft ? '0px' : 'auto',
          right: stickyRight ? '0px' : 'auto',
          zIndex,
          backgroundColor: 'rgb(248, 250, 252)',
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        {children}
      </th>
    </Resizable>
  );
}
