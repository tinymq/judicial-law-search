import type { Metadata } from "next";
import {
  Noto_Sans_SC,
  Noto_Serif_SC,
  JetBrains_Mono
} from "next/font/google";
import "./globals.css";

// 配置优化后的字体
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-custom",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "执法监督法规查",
    template: "%s - 执法监督法规查",
  },
  description: "司法领域执法监督法规检索系统，支持法规全文搜索、行业分类筛选、执法事项目录管理",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${notoSansSC.variable} ${notoSerifSC.variable} ${jetBrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
