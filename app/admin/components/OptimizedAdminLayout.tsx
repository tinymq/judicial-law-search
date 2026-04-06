'use client';

import { ReactNode } from 'react';

interface OptimizedAdminLayoutProps {
  children: ReactNode;
  header?: ReactNode;
  sidebar?: ReactNode;
}

/**
 * 优化后的管理后台布局
 * 设计理念：精致官僚现代主义
 * - 纸张纹理背景
 * - 朱红色装饰线
 * - 优雅的动画效果
 */
export default function OptimizedAdminLayout({ children, header, sidebar }: OptimizedAdminLayoutProps) {
  return (
    <div className="admin-layout">
      {/* 纸张纹理背景 */}
      <div className="paper-texture" />

      {/* 主内容区 */}
      <div className="admin-content">
        {header && <header className="admin-header">{header}</header>}

        <div className="admin-body">
          {sidebar && <aside className="admin-sidebar">{sidebar}</aside>}
          <main className="admin-main">{children}</main>
        </div>
      </div>

      <style jsx global>{`
        /* ========== 全局变量 ========== */
        :root {
          /* 配色方案：米白 + 深灰 + 朱红 */
          --color-bg-primary: #faf8f5;
          --color-bg-secondary: #f5f3f0;
          --color-bg-paper: #ffffff;
          --color-text-primary: #1a1a1a;
          --color-text-secondary: #6b6b6b;
          --color-text-tertiary: #9b9b9b;
          --color-accent: #c8302b; /* 朱红色 */
          --color-accent-hover: #a82723;
          --color-border: #e8e6e3;
          --color-border-light: #f0ede9;

          /* 字体 */
          --font-display: 'Noto Serif SC', serif;
          --font-body: 'Noto Sans SC', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;

          /* 间距 */
          --space-xs: 0.25rem;
          --space-sm: 0.5rem;
          --space-md: 1rem;
          --space-lg: 1.5rem;
          --space-xl: 2rem;
          --space-2xl: 3rem;

          /* 圆角 */
          --radius-sm: 4px;
          --radius-md: 6px;
          --radius-lg: 8px;

          /* 阴影 */
          --shadow-sm: 0 1px 2px rgba(26, 26, 26, 0.05);
          --shadow-md: 0 2px 8px rgba(26, 26, 26, 0.08);
          --shadow-lg: 0 8px 24px rgba(26, 26, 26, 0.12);
          --shadow-paper: 0 1px 3px rgba(26, 26, 26, 0.06), 0 1px 2px rgba(26, 26, 26, 0.04);

          /* 过渡 */
          --transition-fast: 150ms ease;
          --transition-normal: 250ms ease;
          --transition-slow: 350ms ease;
        }

        /* ========== 字体引入 ========== */
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;500;600;700&display=swap');

        /* ========== 布局容器 ========== */
        .admin-layout {
          min-height: 100vh;
          background: var(--color-bg-primary);
          font-family: var(--font-body);
          color: var(--color-text-primary);
          position: relative;
          overflow-x: hidden;
        }

        /* 纸张纹理背景 */
        .paper-texture {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background-image:
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0, 0, 0, 0.01) 2px,
              rgba(0, 0, 0, 0.01) 4px
            );
          opacity: 0.6;
        }

        .admin-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        /* ========== 顶部导航 ========== */
        .admin-header {
          background: var(--color-bg-paper);
          border-bottom: 2px solid var(--color-accent);
          padding: var(--space-md) var(--space-xl);
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: var(--shadow-sm);
          position: sticky;
          top: 0;
          z-index: 100;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* ========== 主体内容区 ========== */
        .admin-body {
          display: flex;
          flex: 1;
        }

        .admin-sidebar {
          width: 280px;
          background: var(--color-bg-secondary);
          border-right: 1px solid var(--color-border);
          padding: var(--space-lg);
          overflow-y: auto;
          max-height: calc(100vh - 73px);
          position: sticky;
          top: 73px;
        }

        .admin-main {
          flex: 1;
          padding: var(--space-xl);
          min-width: 0;
        }

        /* ========== 按钮样式 ========== */
        .btn-primary {
          background: var(--color-accent);
          color: white;
          border: none;
          padding: var(--space-sm) var(--space-lg);
          border-radius: var(--radius-md);
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all var(--transition-normal);
          box-shadow: var(--shadow-sm);
          display: inline-flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .btn-primary:hover {
          background: var(--color-accent-hover);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .btn-primary:active {
          transform: translateY(0);
        }

        .btn-secondary {
          background: transparent;
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
          padding: var(--space-sm) var(--space-lg);
          border-radius: var(--radius-md);
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all var(--transition-normal);
        }

        .btn-secondary:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
          background: rgba(200, 48, 43, 0.05);
        }

        /* ========== 卡片样式 ========== */
        .card {
          background: var(--color-bg-paper);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-paper);
          overflow: hidden;
          transition: all var(--transition-normal);
        }

        .card:hover {
          box-shadow: var(--shadow-md);
        }

        /* ========== 输入框样式 ========== */
        .input {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          padding: var(--space-sm) var(--space-md);
          border-radius: var(--radius-md);
          font-family: var(--font-body);
          font-size: 0.875rem;
          color: var(--color-text-primary);
          transition: all var(--transition-fast);
          width: 100%;
        }

        .input:focus {
          outline: none;
          border-color: var(--color-accent);
          background: var(--color-bg-paper);
          box-shadow: 0 0 0 3px rgba(200, 48, 43, 0.1);
        }

        .input::placeholder {
          color: var(--color-text-tertiary);
        }

        /* ========== 表格样式 ========== */
        .table-container {
          background: var(--color-bg-paper);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-paper);
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead {
          background: var(--color-bg-secondary);
          border-bottom: 2px solid var(--color-accent);
        }

        th {
          padding: var(--space-md) var(--space-lg);
          text-align: left;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        tbody tr {
          border-bottom: 1px solid var(--color-border-light);
          transition: background var(--transition-fast);
        }

        tbody tr:hover {
          background: rgba(200, 48, 43, 0.03);
        }

        tbody tr:last-child {
          border-bottom: none;
        }

        td {
          padding: var(--space-md) var(--space-lg);
          font-size: 0.875rem;
          color: var(--color-text-primary);
        }

        /* ========== 标签样式 ========== */
        .tag {
          display: inline-flex;
          align-items: center;
          padding: var(--space-xs) var(--space-md);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 500;
          border: 1px solid;
        }

        .tag-accent {
          background: rgba(200, 48, 43, 0.1);
          color: var(--color-accent);
          border-color: rgba(200, 48, 43, 0.2);
        }

        .tag-success {
          background: rgba(34, 139, 34, 0.1);
          color: #228b22;
          border-color: rgba(34, 139, 34, 0.2);
        }

        .tag-warning {
          background: rgba(220, 140, 40, 0.1);
          color: #dc8c28;
          border-color: rgba(220, 140, 40, 0.2);
        }

        /* ========== 动画 ========== */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fadeIn 0.3s ease;
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease;
        }

        .stagger-1 { animation-delay: 0.05s; }
        .stagger-2 { animation-delay: 0.1s; }
        .stagger-3 { animation-delay: 0.15s; }
        .stagger-4 { animation-delay: 0.2s; }
        .stagger-5 { animation-delay: 0.25s; }
      `}</style>
    </div>
  );
}
