// lib/cache/redis.ts
// PART 3 — REDIS CACHE LAYER
//
// Wraps Upstash Redis for caching config and dashboard data.
// Uses the same Upstash credentials already in .env (UPSTASH_REDIS_REST_URL / TOKEN).
// Gracefully degrades to no-cache if Redis is unavailable.
//
// Key schema:
//   config:{key}       → TTL 60s
//   dashboard:{userId} → TTL 30s
//
// Invalidation:
//   invalidateConfig(key)    → on config update
//   invalidateDashboard(uid) → on new job / credit change

import { Redis } from "@upstash/redis";

// ─── SINGLETON ────────────────────────────────────────────────────────────────
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null; // graceful degradation — cache disabled
  }
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

// ─── TTLs (seconds) ──────────────────────────────────────────────────────────
const TTL = {
  config: 60,     // system_config rows — 60 seconds
  dashboard: 30,  // dashboard API response — 30 seconds
} as const;

// ─── KEY BUILDERS ─────────────────────────────────────────────────────────────
export const cacheKey = {
  config: (key: string) => `config:${key}`,
  dashboard: (userId: string) => `dashboard:${userId}`,
};

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch (err) {
    console.warn("[Cache] GET failed:", err);
    return null;
  }
}

// ─── SET ──────────────────────────────────────────────────────────────────────
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.warn("[Cache] SET failed:", err);
  }
}

// ─── DELETE (INVALIDATE) ──────────────────────────────────────────────────────
export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (err) {
    console.warn("[Cache] DEL failed:", err);
  }
}

// ─── DOMAIN-SPECIFIC HELPERS ──────────────────────────────────────────────────

/** Cache a config value. TTL = 60s. */
export async function cacheConfig<T>(configKey: string, value: T): Promise<void> {
  await cacheSet(cacheKey.config(configKey), value, TTL.config);
}

/** Get a cached config value. Returns null on miss. */
export async function getCachedConfig<T>(configKey: string): Promise<T | null> {
  return cacheGet<T>(cacheKey.config(configKey));
}

/** Invalidate a config cache entry. Call after setConfig(). */
export async function invalidateConfig(configKey: string): Promise<void> {
  await cacheDelete(cacheKey.config(configKey));
}

/** Cache dashboard data for a user. TTL = 30s. */
export async function cacheDashboard<T>(userId: string, data: T): Promise<void> {
  await cacheSet(cacheKey.dashboard(userId), data, TTL.dashboard);
}

/** Get cached dashboard data. Returns null on miss. */
export async function getCachedDashboard<T>(userId: string): Promise<T | null> {
  return cacheGet<T>(cacheKey.dashboard(userId));
}

/** Invalidate dashboard cache for a user. Call after job creation / credit change. */
export async function invalidateDashboard(userId: string): Promise<void> {
  await cacheDelete(cacheKey.dashboard(userId));
}
