// app/api/jobs/cancel/route.ts
// POST: Cancel a running training job and trigger credit refund

import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { trainingJobs, users, creditTransactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withSentry } from "@/lib/services/sentry";
import { auditInfo } from "@/lib/services/audit";
import { z } from "zod";

const CancelSchema = z.object({
  jobId: z.string().uuid(),
  reason: z.string().max(200).optional(),
});

const TOGETHER_BASE = "https://api.together.xyz/v1";

async function handler(req: NextRequest): Promise<NextResponse> {
  const user = await getUserForApi();
  if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

  const body = await req.json() as unknown;
  const parsed = CancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { jobId, reason } = parsed.data;

  // Fetch job — verify ownership
  const [job] = await db
    .select()
    .from(trainingJobs)
    .where(and(eq(trainingJobs.id, jobId), eq(trainingJobs.userId, user.id)));

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (["completed", "failed", "cancelled"].includes(job.status)) {
    return NextResponse.json({ error: `Job is already ${job.status}` }, { status: 409 });
  }

  // Cancel on Together AI if it has a Together job ID
  if (job.togetherJobId) {
    try {
      const res = await fetch(`${TOGETHER_BASE}/fine_tuning/jobs/${job.togetherJobId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_API_KEY!}`,
          "Content-Type": "application/json",
        },
      });
      // 404 = already completed/cancelled on Together side — that's fine
      if (!res.ok && res.status !== 404) {
        const err = await res.text();
        console.error(`[Cancel] Together cancel failed: ${err}`);
        // Don't block DB update — cancel locally even if Together fails
      }
    } catch (err) {
      console.error(`[Cancel] Together cancel error:`, err);
    }
  }

  // Update DB status
  const existingLogs: string[] = Array.isArray(job.logs) ? (job.logs as string[]) : [];
  existingLogs.push(`[${new Date().toISOString()}] 🚫 Cancelled by user. Reason: ${reason ?? "No reason provided"}`);

  await db
    .update(trainingJobs)
    .set({
      status: "cancelled",
      completedAt: new Date(),
      errorMessage: `Cancelled: ${reason ?? "User request"}`,
      logs: JSON.stringify(existingLogs),
      updatedAt: new Date(),
    })
    .where(eq(trainingJobs.id, jobId));

  // Full credit refund on cancellation (regardless of age — user chose to cancel)
  if (job.creditsDeducted > 0 && job.creditsRefunded === 0) {
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
    if (dbUser) {
      const newBalance = dbUser.creditsBalance + job.creditsDeducted;
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ creditsBalance: newBalance, updatedAt: new Date() })
          .where(eq(users.id, user.id));

        await tx.insert(creditTransactions).values({
          userId: user.id,
          type: "refund",
          amount: job.creditsDeducted,
          balanceAfter: newBalance,
          description: `Cancellation refund: ${job.modelSuffix}`,
          referenceId: jobId,
        });

        await tx
          .update(trainingJobs)
          .set({ creditsRefunded: job.creditsDeducted })
          .where(eq(trainingJobs.id, jobId));
      });
    }
  }

  await auditInfo({
    userId: user.id,
    actorEmail: user.email,
    action: "train.cancel",
    resource: "training_job",
    resourceId: jobId,
    metadata: { togetherJobId: job.togetherJobId, reason, creditsRefunded: job.creditsDeducted },
    req,
  });

  return NextResponse.json({
    cancelled: true,
    creditsRefunded: job.creditsDeducted,
    message: `Job cancelled. ${job.creditsDeducted} credits refunded.`,
  });
}

export const POST = withSentry(handler);
