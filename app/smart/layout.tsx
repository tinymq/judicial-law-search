import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '智能查询',
  description: '法规智能查询 - 知识图谱 + 违法行为 + 类案联动',
};

export default function SmartLayout({ children }: { children: React.ReactNode }) {
  // /smart 路由强制使用 optimized（朱砂）主题，无视用户当前 ThemeToggle 选择
  return <div className="min-h-screen app-optimized">{children}</div>;
}
