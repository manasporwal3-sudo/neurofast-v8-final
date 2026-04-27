/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // v8 fix: filter out empty string when NEXT_PUBLIC_APP_URL is not set
      allowedOrigins: ["localhost:3000", process.env.NEXT_PUBLIC_APP_URL].filter(Boolean),
    },
  },
  // v8 fix: tell Next.js these are Node.js-only packages — do NOT bundle for Edge
  serverExternalPackages: [
    "drizzle-orm",
    "postgres",
    "bullmq",
    "ioredis",
    "@upstash/redis",
    "@upstash/ratelimit",
    "@sentry/nextjs",
    "@supabase/supabase-js",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};

module.exports = nextConfig;
