import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '创建法规',
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
