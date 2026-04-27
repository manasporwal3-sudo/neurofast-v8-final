// app/api/admin/queue-stats/route.ts
// GET: BullMQ queue statistics for admin dashboard
// Protected: admin role only

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminUser } from "@/lib/services/rbac";
import { getQueueStats } from "@/lib/queue/client";
import { withSentry } from "@/lib/services/sentry";
import { db } from "@/lib/db";
import { trainingJobs } from "@/lib/db/schema";
import { eq, count, and } from "drizzle-orm";

async function handler(_req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  // BullMQ stats
  const queueStats = await getQueueStats();

  // DB job stats
  const [runningCount] = await db
    .select({ count: count() })
    .from(trainingJobs)
    .where(eq(trainingJobs.status, "running"));

  const [queuedCount] = await db
    .select({ count: count() })
    .from(trainingJobs)
    .where(eq(trainingJobs.status, "queued"));

  const [completedCount] = await db
    .select({ count: count() })
    .from(trainingJobs)
    .where(eq(trainingJobs.status, "completed"));

  const [failedCount] = await db
    .select({ count: count() })
    .from(trainingJobs)
    .where(eq(trainingJobs.status, "failed"));

  return NextResponse.json({
    bullmq: queueStats ?? { available: false },
    db: {
      running: runningCount?.count ?? 0,
      queued: queuedCount?.count ?? 0,
      completed: completedCount?.count ?? 0,
      failed: failedCount?.count ?? 0,
    },
  });
}

export const GET = withSentry(handler);
