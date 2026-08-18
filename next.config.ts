import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: "standalone",

  // Speed up Vercel builds by skipping linting and type checking 
  // (assuming you already check for errors locally before pushing)
  // @ts-ignore
  eslint: { ignoreDuringBuilds: true },
  // @ts-ignore
  typescript: { ignoreBuildErrors: true },

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
  serverExternalPackages: ["bcryptjs", "razorpay"],

  // Barrel-optimize heavy libraries so only the used exports are bundled.
  experimental: {
    // Uploads travel as base64 data-URLs through server actions (the app's
    // standard pattern — venue photos, receipts, signed contracts). The default
    // body limit is 1 MB, and base64 inflates a file by ~a third, so a single
    // 3 MB phone photo was silently failing to save. Images are now downscaled
    // client-side (see lib/images/downscale-image.ts), which is the real fix;
    // this raises the ceiling to cover multi-image batches and PDF scans, which
    // are NOT downscaled. Kept at 4 MB on purpose: the serverless platform
    // enforces its own request-body cap of roughly 4.5 MB, so a larger number
    // here would be fiction — requests would still be rejected upstream.
    serverActions: { bodySizeLimit: "4mb" },
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
