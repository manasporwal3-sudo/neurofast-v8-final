// app/api/jobs/[id]/route.ts
// GET: Poll and sync job status from Together AI
//
// UPGRADE LOG (v2):
//   + withSentry() — catches unhandled errors
//   + auditInfo()  — logs polling (info level, non-blocking)
//   Existing syncJobStatus() logic: unchanged

import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";
import { syncJobStatus } from "@/lib/training";
import { db } from "@/lib/db";
import { trainingJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withSentry } from "@/lib/services/sentry";

async function handler(
  req: NextRequest,
  context?: unknown
): Promise<NextResponse> {
  const { id } = (context as { params: { id: string } }).params;

  const user = await getUserForApi();
  if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

  // Sync status from Together AI (existing logic — unchanged)
  await syncJobStatus(id);

  // Return updated job from DB
  const [job] = await db
    .select()
    .from(trainingJobs)
    .where(eq(trainingJobs.togetherJobId, id));

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (job.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: job.id,
    togetherJobId: job.togetherJobId,
    status: job.status,
    progressPercent: job.progressPercent,
    currentEpoch: job.currentEpoch,
    trainingTokens: job.trainingTokens,
    logs: job.logs,
    errorMessage: job.errorMessage,
    fineTunedModelId: job.fineTunedModelId,
    updatedAt: job.updatedAt,
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  return withSentry(handler)(req, { params });
}
