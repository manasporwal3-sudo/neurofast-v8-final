// app/api/admin/rollback/route.ts
// GET:  List all rollbackable actions (unexpired, not yet rolled back)
// POST: Execute a rollback by sessionId

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rollbackLogs } from "@/lib/db/schema";
import { requireAdmin, isAdminUser } from "@/lib/services/rbac";
import { executeRollback, listRollbackable } from "@/lib/services/rollback";
import { auditInfo } from "@/lib/services/audit";
import { withSentry } from "@/lib/services/sentry";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";

const RollbackSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().min(1).max(300).optional(),
});

async function getHandler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const logs = await listRollbackable(adminResult.id);
  const now = new Date();

  return NextResponse.json({
    rollbackable: logs
      .filter((l) => l.expiresAt > now)
      .map((l) => ({
        sessionId: l.sessionId,
        action: l.action,
        resource: l.resource,
        snapshotBefore: l.snapshotBefore,
        snapshotAfter: l.snapshotAfter,
        createdAt: l.createdAt,
        expiresAt: l.expiresAt,
        minutesUntilExpiry: Math.floor((l.expiresAt.getTime() - now.getTime()) / 60000),
      })),
    total: logs.length,
  });
}

async function postHandler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const body = await req.json() as unknown;
  const parsed = RollbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const { sessionId, reason } = parsed.data;

  const result = await executeRollback(sessionId, adminResult.email);

  // Audit the rollback attempt
  await auditInfo({
    userId: adminResult.id,
    actorEmail: adminResult.email,
    // v8 fix: use correct audit action type for rollback
    action: "admin.rollback_executed",
    resource: "rollback",
    resourceId: sessionId,
    metadata: {
      success: result.success,
      message: result.message,
      reason: reason ?? "No reason given",
      restored: result.restored,
    },
    severity: result.success ? "warn" : "error",
    req,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

export const GET = withSentry(getHandler);
export const POST = withSentry(postHandler);
