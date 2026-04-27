// lib/services/rollback.ts
// Stores before-snapshots and restores them on demand
// Every AI brain execution creates a rollback_log row BEFORE changing anything
// POST /api/admin/rollback restores the snapshot

import { db } from "@/lib/db";
import { rollbackLogs, users, creditTransactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getConfig, setConfig } from "@/lib/services/config";

// ─── SNAPSHOT CAPTURE ─────────────────────────────────────────────────────────
// Call BEFORE execution to save restorable state
export async function captureSnapshot(params: {
  sessionId: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resource: string;         // config key (e.g. "pricing.inference_cost_per_msg") or "user:{id}"
  snapshotBefore: unknown;  // value being overwritten
}): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h window

  await db
    .insert(rollbackLogs)
    .values({
      sessionId: params.sessionId,
      adminId: params.adminId,
      adminEmail: params.adminEmail,
      action: params.action,
      resource: params.resource,
      snapshotBefore: params.snapshotBefore as never,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: rollbackLogs.sessionId,
      set: {
        snapshotBefore: params.snapshotBefore as never,
        expiresAt,
      },
    });
}

// Call AFTER successful execution to record what changed
export async function recordSnapshotAfter(
  sessionId: string,
  snapshotAfter: unknown
): Promise<void> {
  await db
    .update(rollbackLogs)
    .set({ snapshotAfter: snapshotAfter as never })
    .where(eq(rollbackLogs.sessionId, sessionId));
}

// ─── ROLLBACK EXECUTION ────────────────────────────────────────────────────────
// Restores the before-snapshot for a given session
export async function executeRollback(
  sessionId: string,
  rolledBackBy: string
): Promise<{ success: boolean; message: string; restored?: unknown }> {
  // Find the rollback log
  const [log] = await db
    .select()
    .from(rollbackLogs)
    .where(and(
      eq(rollbackLogs.sessionId, sessionId),
      eq(rollbackLogs.rolledBack, false)
    ));

  if (!log) {
    return { success: false, message: "Rollback log not found or already rolled back" };
  }

  if (new Date() > log.expiresAt) {
    return { success: false, message: "Rollback window expired (24h limit)" };
  }

  const before = log.snapshotBefore;

  try {
    // Restore based on resource type
    if (log.resource.startsWith("user:")) {
      // Credit/role rollback
      const userId = log.resource.replace("user:", "");
      const snapshot = before as { creditsBalance?: number; role?: string };

      await db.transaction(async (tx) => {
        const updates: Record<string, unknown> = {};
        if (snapshot.creditsBalance !== undefined) {
          updates.creditsBalance = snapshot.creditsBalance;

          // Log the credit reversal
          const [currentUser] = await tx
            .select()
            .from(users)
            .where(eq(users.id, userId));

          if (currentUser) {
            await tx.insert(creditTransactions).values({
              userId,
              type: "refund",
              amount: snapshot.creditsBalance - currentUser.creditsBalance,
              balanceAfter: snapshot.creditsBalance,
              description: `Rollback by ${rolledBackBy}: session ${sessionId}`,
              referenceId: sessionId,
            });
          }
        }
        if (snapshot.role !== undefined) updates.role = snapshot.role;

        if (Object.keys(updates).length > 0) {
          await tx
            .update(users)
            .set({ ...updates, updatedAt: new Date() } as never)
            .where(eq(users.id, userId));
        }
      });
    } else {
      // Config key rollback
      await setConfig(log.resource, before, `rollback:${rolledBackBy}`);
    }

    // Mark as rolled back
    await db
      .update(rollbackLogs)
      .set({
        rolledBack: true,
        rolledBackAt: new Date(),
        rolledBackBy,
      })
      .where(eq(rollbackLogs.sessionId, sessionId));

    return {
      success: true,
      message: `Rolled back "${log.action}" on "${log.resource}" to previous value`,
      restored: before,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await db
      .update(rollbackLogs)
      .set({ rollbackError: message })
      .where(eq(rollbackLogs.sessionId, sessionId));

    return { success: false, message: `Rollback failed: ${message}` };
  }
}

// ─── LIST ROLLBACKABLE ACTIONS ─────────────────────────────────────────────────
// Returns all unexpired, non-rolled-back logs for the admin UI
export async function listRollbackable(adminId: string) {
  const now = new Date();
  return db
    .select()
    .from(rollbackLogs)
    .where(
      and(
        eq(rollbackLogs.adminId, adminId),
        eq(rollbackLogs.rolledBack, false)
      )
    )
    .orderBy(rollbackLogs.createdAt);
}
