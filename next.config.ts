import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: "standalone",

  // Production image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google OAuth profile pictures
      },
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com", // Vercel Blob storage
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com", // curated venue photography (guest app)
      },
    ],
  },

  // Security headers are set in vercel.json for Vercel deployments
  // and via middleware for other deployments

  // Reduce bundle size by enabling tree shaking for server-only modules
  serverExternalPackages: ["bcryptjs"],

  // Barrel-optimize heavy libraries so only the used exports are bundled.
  experimental: {
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "date-fns",
      "@tanstack/react-table",
    ],

    // Client-side Router Cache: reuse already-fetched route payloads instead of
    // re-rendering on the server for every navigation. This is what makes moving
    // between pages (and back) feel instant — prefetched links and recently
    // visited pages are served from the in-memory cache. Server Actions that call
    // revalidatePath/revalidateTag still bust these entries, so mutations stay fresh.
    staleTimes: {
      dynamic: 30, // reuse a dynamic page's payload for 30s before refetching
      static: 180, // static / prefetched routes stay warm for 3 minutes
    },
  },

  // Suppress noisy static generation logs
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default withNextIntl(nextConfig);
