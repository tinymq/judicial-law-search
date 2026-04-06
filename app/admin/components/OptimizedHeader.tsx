'use client';

import Link from 'next/link';
import Image from 'next/image';

interface OptimizedHeaderProps {
  searchTerm?: string;
  searchAction?: string;
  actions?: React.ReactNode;
  title?: string;
}

/**
 * 优化后的顶部导航栏
 * - 朱红色底边强调权威感
 * - 宋体标题增强识别度
 * - 流畅的搜索交互
 */
export default function OptimizedHeader({
  searchTerm = '',
  searchAction = '/',
  actions,
  title = '可为法规随手查'
}: OptimizedHeaderProps) {
  return (
    <header className="optimized-admin-header">
      {/* Logo 和标题 */}
      <Link href="/" className="header-logo">
        <div className="logo-wrapper">
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="logo-image"
          />
          <div className="logo-accent" />
        </div>
        <h1 className="header-title">{title}</h1>
      </Link>

      {/* 搜索框 */}
      <form action={searchAction} method="GET" className="search-form">
        <svg
          className="search-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          name="q"
          defaultValue={searchTerm}
          placeholder="搜索法规、违法行为..."
          className="search-input"
        />
      </form>

      {/* 右侧操作区 */}
      <div className="header-actions">{actions}</div>

      <style jsx>{`
        .optimized-admin-header {
          background: #ffffff;
          border-bottom: 3px solid #c8302b;
          padding: 1rem 2rem;
          display: flex;
          align-items: center;
          gap: 2rem;
          box-shadow:
            0 1px 3px rgba(26, 26, 26, 0.06),
            0 1px 2px rgba(26, 26, 26, 0.04);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        /* Logo 区域 */
        .header-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          transition: opacity 0.2s ease;
        }

        .header-logo:hover {
          opacity: 0.8;
        }

        .logo-wrapper {
          position: relative;
          width: 40px;
          height: 40px;
        }

        .logo-image {
          width: 40px;
          height: 40px;
          object-fit: contain;
        }

        .logo-accent {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          background: #c8302b;
          border-radius: 2px;
        }

        .header-title {
          font-family: 'Noto Serif SC', serif;
          font-size: 1.125rem;
          font-weight: 700;
          color: #1a1a1a;
          letter-spacing: 0.05em;
        }

        /* 搜索框 */
        .search-form {
          flex: 1;
          max-width: 480px;
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          color: #9b9b9b;
          pointer-events: none;
          transition: color 0.2s ease;
        }

        .search-input {
          width: 100%;
          padding: 0.625rem 1rem 0.625rem 2.75rem;
          background: #faf8f5;
          border: 1px solid #e8e6e3;
          border-radius: 6px;
          font-family: 'Noto Sans SC', sans-serif;
          font-size: 0.875rem;
          color: #1a1a1a;
          transition: all 0.2s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: #c8302b;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(200, 48, 43, 0.1);
        }

        .search-input:focus + .search-icon,
        .search-input:not(:placeholder-shown) + .search-icon {
          color: #c8302b;
        }

        .search-input::placeholder {
          color: #9b9b9b;
        }

        /* 右侧操作区 */
        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-left: auto;
        }

        @media (max-width: 768px) {
          .optimized-admin-header {
            padding: 0.75rem 1rem;
            gap: 1rem;
          }

          .header-title {
            display: none;
          }

          .search-form {
            max-width: 240px;
          }
        }
      `}</style>
    </header>
  );
}
