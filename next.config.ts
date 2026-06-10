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

  // Suppress noisy static generation logs
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default withNextIntl(nextConfig);
