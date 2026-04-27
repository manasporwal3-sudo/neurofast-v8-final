// lib/services/config.ts
// Reads dynamic platform config from DB — used by API routes at runtime
// Falls back to hardcoded defaults if DB record missing (safe startup)
// Admin and AI system can update these values without code deploys
//
// CHANGES v5:
//   - Replaced in-memory Map cache (process-local, resets on cold start)
//     with Redis cache (TTL 60s, shared across all serverless instances)
//   - invalidateConfig() called on every setConfig() write
//   - Graceful fallback: if Redis unavailable → hits DB, then defaults

import { db } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCachedConfig, cacheConfig, invalidateConfig } from "@/lib/cache/redis";

// ─── DEFAULT CONFIG VALUES ─────────────────────────────────────────────────
// These are the baseline values. Override in DB via admin panel.
export const CONFIG_DEFAULTS: Record<string, unknown> = {
  // Pricing (credits)
  "pricing.inference_cost_per_msg": 1,
  "pricing.free_signup_credits": 100,
  "pricing.credit_to_usd_ratio": 0.01,   // 1 credit = $0.01

  // Limits
  "limits.free_monthly_jobs": 1,
  "limits.max_concurrent_jobs": 3,
  "limits.max_dataset_rows": 50000,
  "limits.max_dataset_mb": 50,
  "limits.max_message_length": 4000,

  // Rate limits (per minute per user)
  "ratelimit.chat_rpm": 20,
  "ratelimit.train_rpm": 5,
  "ratelimit.upload_rpm": 10,

  // Feature flags
  "features.registration_open": true,
  "features.free_tier_enabled": true,
  "features.maintenance_mode": false,
  "features.queue_enabled": false,      // flip to true to use BullMQ

  // AI control flags
  "ai.can_update_pricing": false,       // safety: AI cannot change pricing without admin approval
  "ai.can_ban_users": false,
  "ai.can_send_notifications": true,
  "ai.auto_refund_threshold_minutes": 2,
};

export async function getConfig<T = unknown>(key: string): Promise<T> {
  // 1. Check Redis cache (TTL 60s, shared across serverless instances)
  const cached = await getCachedConfig<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 2. Cache miss — fetch from DB
  try {
    const [row] = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, key));

    const value = row ? (row.value as T) : (CONFIG_DEFAULTS[key] as T);

    // Write back to Redis cache
    await cacheConfig(key, value);

    return value;
  } catch {
    // DB unavailable — use default (do NOT cache this so next request retries DB)
    return CONFIG_DEFAULTS[key] as T;
  }
}

export async function setConfig(
  key: string,
  value: unknown,
  updatedBy = "admin"
): Promise<void> {
  // v8 fix: drizzle-orm jsonb columns accept JS values natively.
  // JSON.stringify was double-encoding (e.g. true → '"true"') — removed.
  await db
    .insert(systemConfig)
    .values({
      key,
      value: value as never,
      lastUpdatedBy: updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: {
        value: value as never,
        lastUpdatedBy: updatedBy,
        updatedAt: new Date(),
      },
    });

  // Invalidate Redis cache so next read picks up the new value
  await invalidateConfig(key);
}

// Seed default config values into DB (run once on first deploy)
export async function seedDefaultConfig(): Promise<void> {
  for (const [key, value] of Object.entries(CONFIG_DEFAULTS)) {
    await db
      .insert(systemConfig)
      .values({
        key,
        value: value as never,
        description: `Default value for ${key}`,
        category: key.split(".")[0] ?? "general",
        lastUpdatedBy: "system",
      })
      .onConflictDoNothing();
  }
}
