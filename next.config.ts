import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.241"],
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "i.vimeocdn.com",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ["framer-motion"],
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/moi", permanent: true },
      { source: "/dashboard/projets", destination: "/moi", permanent: true },
      { source: "/dashboard/contacts", destination: "/moi", permanent: true },
    ];
  },
};

export default nextConfig;
