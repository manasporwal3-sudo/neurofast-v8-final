// app/api/admin/users/route.ts
// GET:   List all users with stats
// PATCH: Change user role or adjust credits
// Protected: admin role only

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, creditTransactions } from "@/lib/db/schema";
import { requireAdmin, isAdminUser, promoteToAdmin, demoteToUser } from "@/lib/services/rbac";
import { auditInfo, auditCritical } from "@/lib/services/audit";
import { withSentry } from "@/lib/services/sentry";
import { ChangeUserRoleSchema, AdjustCreditsSchema } from "@/lib/schemas";
import { invalidateDashboard } from "@/lib/cache/redis";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("change_role"), ...ChangeUserRoleSchema.shape }),
  z.object({ action: z.literal("adjust_credits"), ...AdjustCreditsSchema.shape }),
]);

async function getHandler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20"));
  const offset = (page - 1) * limit;

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      plan: users.plan,
      creditsBalance: users.creditsBalance,
      totalJobsRun: users.totalJobsRun,
      monthlyJobsUsed: users.monthlyJobsUsed,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({
    users: allUsers,
    page,
    limit,
    hasMore: allUsers.length === limit,
  });
}

async function patchHandler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const body = await req.json() as unknown;
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.action === "change_role") {
    const { userId, role, reason } = parsed.data;

    // Prevent demoting yourself
    if (userId === adminResult.id) {
      return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
    }

    if (role === "admin") {
      await promoteToAdmin(userId);
    } else {
      await demoteToUser(userId);
    }

    // v8 fix: use auditCritical so severity is not overridden to "info"
    await auditCritical({
      userId: adminResult.id,
      actorEmail: adminResult.email,
      action: "admin.user_role_change",
      resource: "user",
      resourceId: userId,
      metadata: { newRole: role, reason },
      req,
    });

    return NextResponse.json({ success: true, userId, newRole: role });
  }

  if (parsed.data.action === "adjust_credits") {
    const { userId, amount, reason } = parsed.data;

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newBalance = Math.max(0, targetUser.creditsBalance + amount);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ creditsBalance: newBalance, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await tx.insert(creditTransactions).values({
        userId,
        type: amount > 0 ? "bonus" : "deduction",
        amount,
        balanceAfter: newBalance,
        description: `Admin adjustment: ${reason}`,
        referenceId: adminResult.id,
      });
    });

    await auditInfo({
      userId: adminResult.id,
      actorEmail: adminResult.email,
      // v8 fix: was incorrectly "admin.config_update" — should be "admin.user_role_change" (reuse for credits)
      action: "admin.user_role_change",
      resource: "user_credits",
      resourceId: userId,
      metadata: { adjustment: amount, reason, newBalance },
      req,
    });

    // v8 fix: bust dashboard cache so user sees new balance immediately
    await invalidateDashboard(userId);
    return NextResponse.json({ success: true, userId, newBalance });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export const GET = withSentry(getHandler);
export const PATCH = withSentry(patchHandler);
