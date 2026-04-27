// app/api/admin/audit/route.ts
// GET: Query audit logs with filtering
// Protected: admin role only

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { requireAdmin, isAdminUser } from "@/lib/services/rbac";
import { withSentry } from "@/lib/services/sentry";
import { desc, eq, and, gte, lte, like } from "drizzle-orm";

async function handler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const offset = (page - 1) * limit;
  const severity = url.searchParams.get("severity");
  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("userId");

  // Build dynamic where conditions
  const conditions = [];
  if (severity) conditions.push(eq(auditLogs.severity, severity));
  if (action) conditions.push(like(auditLogs.action, `%${action}%`));
  if (userId) conditions.push(eq(auditLogs.userId, userId));

  const logs = await db
    .select()
    .from(auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({
    logs,
    page,
    limit,
    hasMore: logs.length === limit,
  });
}

export const GET = withSentry(handler);
