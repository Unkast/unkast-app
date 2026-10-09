import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.241"],
  devIndicators: false,
  // Ne pas annoncer la technologie du site dans les reponses.
  poweredByHeader: false,
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
  // En-tetes de securite, sur toutes les reponses. Le site ne s'affiche dans un cadre
  // que sur lui-meme (les lecteurs YouTube et Vimeo sont des cadres SORTANTS, non
  // concernes). Une politique de contenu complete (scripts, styles, images) est un
  // chantier a part : elle se regle d'abord en mode rapport seul.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
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
