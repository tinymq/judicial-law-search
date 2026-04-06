'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface OptimizedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * 优化后的按钮组件
 * - 朱红色主色调
 * - 精致的悬停效果
 * - 流畅的过渡动画
 */
export default function OptimizedButton({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}: OptimizedButtonProps) {
  return (
    <button
      className={`optimized-btn btn-${variant} btn-${size} ${className}`.trim()}
      {...props}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      <span className="btn-text">{children}</span>
      <style jsx>{`
        .optimized-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-family: 'Noto Sans SC', sans-serif;
          font-weight: 500;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .optimized-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.1) 0%,
            rgba(255, 255, 255, 0) 100%
          );
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .optimized-btn:hover::before {
          opacity: 1;
        }

        .btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-text {
          position: relative;
          z-index: 1;
        }

        /* 尺寸 */
        .btn-sm {
          padding: 0.375rem 0.75rem;
          font-size: 0.8125rem;
        }

        .btn-md {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
        }

        .btn-lg {
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
        }

        /* Primary - 朱红色 */
        .btn-primary {
          background: #c8302b;
          color: #ffffff;
          border: 1px solid #c8302b;
          box-shadow: 0 1px 2px rgba(200, 48, 43, 0.1);
        }

        .btn-primary:hover {
          background: #a82723;
          border-color: #a82723;
          box-shadow:
            0 4px 8px rgba(200, 48, 43, 0.15),
            0 1px 2px rgba(200, 48, 43, 0.2);
          transform: translateY(-1px);
        }

        .btn-primary:active {
          transform: translateY(0);
          box-shadow: 0 1px 2px rgba(200, 48, 43, 0.2);
        }

        /* Secondary - 灰色边框 */
        .btn-secondary {
          background: #ffffff;
          color: #1a1a1a;
          border: 1px solid #e8e6e3;
        }

        .btn-secondary:hover {
          border-color: #c8302b;
          color: #c8302b;
          background: rgba(200, 48, 43, 0.03);
        }

        /* Danger - 红色 */
        .btn-danger {
          background: #dc2626;
          color: #ffffff;
          border: 1px solid #dc2626;
          box-shadow: 0 1px 2px rgba(220, 38, 38, 0.1);
        }

        .btn-danger:hover {
          background: #b91c1c;
          border-color: #b91c1c;
          box-shadow:
            0 4px 8px rgba(220, 38, 38, 0.15),
            0 1px 2px rgba(220, 38, 38, 0.2);
          transform: translateY(-1px);
        }

        /* Ghost - 透明 */
        .btn-ghost {
          background: transparent;
          color: #6b6b6b;
          border: 1px solid transparent;
        }

        .btn-ghost:hover {
          background: rgba(26, 26, 26, 0.05);
          color: #1a1a1a;
        }

        /* 禁用状态 */
        .optimized-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }
      `}</style>
    </button>
  );
}
