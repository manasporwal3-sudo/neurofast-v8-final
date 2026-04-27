// app/api/admin/ai-action/route.ts
// POST: Execute a validated AI-proposed action
//
// SAFETY DESIGN:
//   - AI can ONLY propose actions from the SafeAiActions enum
//   - Every action is logged before AND after execution
//   - Dangerous actions (pricing, banning) blocked at schema level
//   - requiresApproval=true actions are logged but NOT executed (pending queue)
//   - Admin must call with requiresApproval=false to actually execute

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, creditTransactions } from "@/lib/db/schema";
import { requireAdmin, isAdminUser } from "@/lib/services/rbac";
import { auditInfo } from "@/lib/services/audit";
import { setConfig } from "@/lib/services/config";
import { withSentry } from "@/lib/services/sentry";
import { AiActionSchema } from "@/lib/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

// ─── ACTION EXECUTORS ─────────────────────────────────────────────────────────
// Each executor handles one SafeAiAction type.
// Returns { success, message } — never throws.

async function executeAction(
  action: z.infer<typeof AiActionSchema>
): Promise<{ success: boolean; message: string; data?: unknown }> {

  switch (action.action) {

    // Toggle a feature flag (e.g. maintenance mode, free tier)
    case "update_feature_flag": {
      const { key, value } = action.parameters as { key: string; value: boolean };
      if (!key.startsWith("features.") && !key.startsWith("ratelimit.")) {
        return { success: false, message: `Key ${key} is not a modifiable feature flag` };
      }
      await setConfig(key, value, "ai_system");
      return { success: true, message: `Feature flag ${key} set to ${value}` };
    }

    // Adjust rate limits (only rate limit keys)
    case "update_rate_limit": {
      const { key, value } = action.parameters as { key: string; value: number };
      if (!key.startsWith("ratelimit.")) {
        return { success: false, message: "Can only update ratelimit.* keys" };
      }
      if (typeof value !== "number" || value < 1 || value > 1000) {
        return { success: false, message: "Rate limit must be a number between 1 and 1000" };
      }
      await setConfig(key, value, "ai_system");
      return { success: true, message: `Rate limit ${key} set to ${value}` };
    }

    // Add bonus credits to a specific user
    case "add_credits_bonus": {
      const { userId, amount, reason } = action.parameters as {
        userId: string;
        amount: number;
        reason: string;
      };
      if (!userId || typeof amount !== "number" || amount <= 0 || amount > 10000) {
        return { success: false, message: "Invalid userId or amount (1–10000 only)" };
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return { success: false, message: "User not found" };

      const newBalance = user.creditsBalance + amount;
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ creditsBalance: newBalance })
          .where(eq(users.id, userId));

        await tx.insert(creditTransactions).values({
          userId,
          type: "bonus",
          amount,
          balanceAfter: newBalance,
          description: `AI bonus: ${reason}`,
          referenceId: "ai_system",
        });
      });

      return { success: true, message: `Added ${amount} credits to ${user.email}`, data: { newBalance } };
    }

    // Flag a user for human review (no automatic action — just logs)
    case "flag_user_for_review": {
      const { userId, reason } = action.parameters as { userId: string; reason: string };
      // Just log it — a human admin will review
      return {
        success: true,
        message: `User ${userId} flagged for review: ${reason}. Human admin must take action.`,
        data: { userId, reason, reviewRequired: true },
      };
    }

    // Send a notification (placeholder — wire to email/SMS in production)
    case "send_notification": {
      const { userId, message } = action.parameters as { userId: string; message: string };
      // TODO: integrate with your email provider (Resend, SendGrid, etc.)
      console.log(`[AI Notification] To user ${userId}: ${message}`);
      return { success: true, message: `Notification queued for user ${userId}` };
    }

    default:
      return { success: false, message: `Unknown action: ${String(action.action)}` };
  }
}

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
async function handler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const body = await req.json() as unknown;
  const parsed = AiActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid action schema", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Log the proposed action BEFORE executing
  await auditInfo({
    userId: adminResult.id,
    actorEmail: adminResult.email,
    action: "admin.ai_action_executed",
    resource: "ai_action",
    metadata: {
      proposedAction: parsed.data.action,
      parameters: parsed.data.parameters,
      reasoning: parsed.data.reasoning,
      requiresApproval: parsed.data.requiresApproval,
      status: "proposed",
    },
    severity: "warn",
    req,
  });

  // If requires approval, do NOT execute — just return pending status
  if (parsed.data.requiresApproval) {
    return NextResponse.json({
      status: "pending_approval",
      message: "Action logged. An admin must approve execution with requiresApproval: false",
      action: parsed.data,
    });
  }

  // Execute the action
  const result = await executeAction(parsed.data);

  // Log the execution result
  await auditInfo({
    userId: adminResult.id,
    actorEmail: adminResult.email,
    action: "admin.ai_action_executed",
    resource: "ai_action",
    metadata: {
      executedAction: parsed.data.action,
      parameters: parsed.data.parameters,
      reasoning: parsed.data.reasoning,
      result,
      status: "executed",
    },
    severity: result.success ? "warn" : "error",
    req,
  });

  return NextResponse.json({
    status: result.success ? "executed" : "failed",
    result,
  });
}

export const POST = withSentry(handler);
