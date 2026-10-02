import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // next/image only loads remote photos from hosts listed here.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  // Security headers recommended for PWAs (see the Next.js PWA guide).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" }, // no embedding in other sites (clickjacking)
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The service worker must never be cached, so app updates reach users.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Bag photos are uploaded through a Server Action (default limit 1 MB).
      // The browser shrinks photos first, so this is just headroom; the
      // action itself rejects files over 4 MB.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
