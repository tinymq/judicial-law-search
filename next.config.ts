import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  typescript: {
    // TODO: 两台电脑代码同步后移除此配置，修复所有类型错误
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
