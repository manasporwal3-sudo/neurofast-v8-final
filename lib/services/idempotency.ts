// lib/services/idempotency.ts
// Prevents duplicate training jobs and payment operations
// Key format: sha256(userId:operation:stableParams)
// TTL: 24 hours per key

import { db } from "@/lib/db";
import { idempotencyKeys } from "@/lib/db/schema";
import { eq, lt } from "drizzle-orm";
import { createHash } from "crypto";

// Generate a stable idempotency key from user + operation + params
export function makeIdempotencyKey(
  userId: string,
  operation: string,
  params: Record<string, unknown>
): string {
  // Sort params for stability regardless of insertion order
  const stable = JSON.stringify(params, Object.keys(params).sort());
  return createHash("sha256")
    .update(`${userId}:${operation}:${stable}`)
    .digest("hex");
}

export type IdempotencyCheckResult =
  | { status: "new" }                             // first time — proceed
  | { status: "processing" }                      // in-flight — reject with 409
  | { status: "completed"; resultId: string }     // already done — return cached
  | { status: "failed" };                         // previous attempt failed — allow retry

// Check if this operation was already started/completed
export async function checkIdempotency(
  userId: string,
  operation: string,
  params: Record<string, unknown>
): Promise<IdempotencyCheckResult> {
  const key = makeIdempotencyKey(userId, operation, params);

  // Purge expired keys first (opportunistic cleanup)
  await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expiresAt, new Date()))
    .catch(() => {}); // non-fatal

  const [existing] = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key));

  if (!existing) return { status: "new" };
  if (existing.status === "processing") return { status: "processing" };
  if (existing.status === "completed" && existing.resultId) {
    return { status: "completed", resultId: existing.resultId };
  }
  if (existing.status === "failed") return { status: "failed" };
  return { status: "new" };
}

// Mark operation as started — call BEFORE making external API calls
export async function startIdempotencyKey(
  userId: string,
  operation: string,
  params: Record<string, unknown>
): Promise<string> {
  const key = makeIdempotencyKey(userId, operation, params);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await db
    .insert(idempotencyKeys)
    .values({ key, userId, operation, status: "processing", expiresAt })
    .onConflictDoUpdate({
      target: idempotencyKeys.key,
      set: { status: "processing", expiresAt },
    });

  return key;
}

// Mark operation as completed — call AFTER successful external API call
export async function completeIdempotencyKey(
  userId: string,
  operation: string,
  params: Record<string, unknown>,
  resultId: string
): Promise<void> {
  const key = makeIdempotencyKey(userId, operation, params);
  await db
    .update(idempotencyKeys)
    .set({ status: "completed", resultId })
    .where(eq(idempotencyKeys.key, key));
}

// Mark operation as failed — allow future retries
export async function failIdempotencyKey(
  userId: string,
  operation: string,
  params: Record<string, unknown>
): Promise<void> {
  const key = makeIdempotencyKey(userId, operation, params);
  await db
    .update(idempotencyKeys)
    .set({ status: "failed" })
    .where(eq(idempotencyKeys.key, key));
}
