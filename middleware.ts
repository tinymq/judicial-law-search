import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 中间件
 *
 * 功能：将 /v2 路径重写为带 ?v2= 参数的内部路由
 * 例如：/v2 → /?v2= (浏览器地址栏仍显示 /v2)
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // 检测路径中是否包含 /v2
  if (url.pathname.includes('/v2')) {
    // 规范化路径：去掉 /v2
    let originalPath = url.pathname
      .replace(/\/v2$/, '')      // /path/v2 → /path
      .replace(/\/v2\//, '/');    // /path/v2/xxx → /path/xxx

    // 特殊处理：根路径 /v2 → /
    if (originalPath === '' || originalPath === '/v2') {
      originalPath = '/';
    }

    // 添加 v2 参数
    const searchParams = new URLSearchParams(url.searchParams);
    searchParams.set('v2', '');

    // 重写 URL（保持浏览器地址栏为 /v2）
    const newUrl = new URL(originalPath, request.url);
    newUrl.search = searchParams.toString();

    return NextResponse.rewrite(newUrl);
  }

  return NextResponse.next();
}

// 中间件匹配规则：排除静态资源和 API 路由
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
