/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // {{ AURA: Add - 明确禁用静态导出，这是一个动态SSR应用 }}
  // output: 'standalone', // 如果EdgeOne支持standalone模式，可以启用
  images: {
    domains: ['sbp-ikairbucachjzcos.supabase.opentrust.net'],
    // {{ AURA: Add - 如果EdgeOne不支持Next.js图片优化，取消注释下一行 }}
    // unoptimized: true,
  },
  // {{ AURA: Add - 确保服务端渲染正常工作 }}
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 解决WebSocket在客户端的打包问题
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
