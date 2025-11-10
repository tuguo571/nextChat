/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['sbp-ikairbucachjzcos.supabase.opentrust.net'],
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
