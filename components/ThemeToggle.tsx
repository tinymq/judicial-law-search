'use client';

import { useState, useEffect } from 'react';

type Theme = 'legacy' | 'optimized';

interface ThemeToggleProps {
  /** 额外的样式类 */
  className?: string;
  /** 保留给不同页面场景的兼容参数 */
  variant?: 'app' | 'admin';
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('legacy');
  const [mounted, setMounted] = useState(false);

  // 初始化：从 localStorage 读取主题
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    }
    setMounted(true);
  }, []);

  // 应用主题：给主容器添加/移除 class
  const applyTheme = (newTheme: Theme) => {
    const mainContainer = document.querySelector('.min-h-screen');
    if (!mainContainer) return;

    if (newTheme === 'optimized') {
      // 添加所有优化主题的 class
      mainContainer.classList.add('app-optimized', 'admin-optimized');
    } else {
      // 移除所有优化主题的 class
      mainContainer.classList.remove('app-optimized', 'admin-optimized');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'legacy' ? 'optimized' : 'legacy';
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // 避免服务端渲染不一致
  if (!mounted) {
    return (
      <button
        className={`px-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white text-slate-500 ${className}`}
        disabled
      >
        🎨 主题
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`
        px-3 py-1.5 text-xs rounded-md border transition-all duration-200 font-medium
        ${theme === 'optimized'
          ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-400'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
        }
        ${className}
      `}
      title={theme === 'optimized' ? '切换到默认主题（蓝灰色）' : '切换到朱红主题（米白色）'}
    >
      {theme === 'optimized' ? '🔴 朱红' : '🔵 默认'}
    </button>
  );
}
