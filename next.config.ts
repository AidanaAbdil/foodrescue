import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // next/image only loads remote photos from hosts listed here.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
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
