// lib/services/ratelimit.ts
// Upstash Redis rate limiting — applied to critical routes only
// Gracefully degrades if Upstash env vars not set (dev-friendly)

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// Only initialize if env vars are present
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const redis = getRedis();

// ─── RATE LIMITERS ─────────────────────────────────────────────────────────
// Each limiter is scoped to a route with different limits

function makeLimiter(requests: number, windowSeconds: number): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds}s`),
    analytics: true,
    prefix: "neurofast",
  });
}

const limiters = {
  // v6: Tightened — 10 chat messages per minute per user (was 20)
  chat: makeLimiter(10, 60),
  // v6: Tightened — 3 training jobs per minute per user (was 5)
  train: makeLimiter(3, 60),
  // 10 uploads per minute per user
  upload: makeLimiter(10, 60),
  // 30 general API calls per minute per user
  api: makeLimiter(30, 60),
  // 5 admin actions per minute — extra strict
  admin: makeLimiter(5, 60),
  // v6: Demo endpoint — 20 demo messages per hour per IP
  demo: makeLimiter(20, 3600),
};

export type LimiterKey = keyof typeof limiters;

// ─── APPLY RATE LIMIT ──────────────────────────────────────────────────────
// Returns null if allowed, NextResponse if blocked
export async function applyRateLimit(
  req: NextRequest,
  identifier: string,   // usually userId or IP
  type: LimiterKey = "api"
): Promise<NextResponse | null> {
  const limiter = limiters[type];

  // Graceful degradation: if Upstash not configured, skip rate limiting
  if (!limiter) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[RateLimit] Upstash not configured — rate limiting disabled");
    }
    return null;
  }

  const key = `${type}:${identifier}`;
  const { success, limit, remaining, reset } = await limiter.limit(key);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please slow down.",
        retryAfterSeconds: retryAfter,
        limit,
        remaining: 0,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(reset),
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  return null; // allowed
}

// Helper: get IP from request (for anonymous rate limiting)
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
