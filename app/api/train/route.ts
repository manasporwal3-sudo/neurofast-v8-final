// app/api/train/route.ts
// POST: Launch a fine-tuning job
//
// UPGRADE LOG (v2):
//   + withSentry()     — catches and reports unhandled errors
//   + applyRateLimit() — 5 requests/min per user (train limiter)
//   + auditInfo()      — logs every job creation attempt
//   + Queue routing    — enqueues to BullMQ when Redis available,
//                        falls back to direct createFineTuneJob() if not
//   Existing logic: 100% preserved inside createFineTuneJob()

import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";
import { createFineTuneJob } from "@/lib/training";
import { applyRateLimit } from "@/lib/services/ratelimit";
import { auditInfo, auditWarn } from "@/lib/services/audit";
import { withSentry } from "@/lib/services/sentry";
import { getConfig } from "@/lib/services/config";
import { LaunchTrainSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { trainingJobs, datasets, users, creditTransactions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { enqueueTrainingJob } from "@/lib/queue/client";
import { estimateTrainingCost } from "@/lib/training-utils";
import {
  checkIdempotency,
  startIdempotencyKey,
  completeIdempotencyKey,
  failIdempotencyKey,
} from "@/lib/services/idempotency";
// v5: Invalidate dashboard cache after job creation so user sees it immediately
import { invalidateDashboard } from "@/lib/cache/redis";

async function handler(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const user = await getUserForApi();
  if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

  // ── 2. Rate limit (5 train requests/min per user) ─────────────────────────
  const rateLimitResult = await applyRateLimit(req, user.id, "train");
  if (rateLimitResult) {
    await auditWarn({
      userId: user.id,
      actorEmail: user.email,
      action: "train.create",
      resource: "training_job",
      metadata: { reason: "rate_limit_exceeded" },
      req,
    });
    return rateLimitResult;
  }

  // ── 3. Validate body ──────────────────────────────────────────────────────
  const body = await req.json() as unknown;
  const parsed = LaunchTrainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // ── 4. Check maintenance mode ─────────────────────────────────────────────
  const maintenance = await getConfig<boolean>("features.maintenance_mode");
  if (maintenance) {
    return NextResponse.json(
      { error: "Platform is under maintenance. Training is temporarily paused." },
      { status: 503 }
    );
  }

  // ── 5. Idempotency check — prevent duplicate job submissions ─────────────
  const idempotencyParams = {
    datasetId: parsed.data.datasetId,
    baseModel: parsed.data.baseModel,
    modelSuffix: parsed.data.modelSuffix,
    epochs: parsed.data.epochs,
  };
  const idempotencyCheck = await checkIdempotency(user.id, "train", idempotencyParams);

  if (idempotencyCheck.status === "processing") {
    return NextResponse.json({
      error: "A duplicate training job is already being processed. Please wait.",
      code: "DUPLICATE_IN_FLIGHT",
    }, { status: 409 });
  }

  if (idempotencyCheck.status === "completed") {
    return NextResponse.json({
      jobId: idempotencyCheck.resultId,
      mode: "deduplicated",
      message: "This exact job was already submitted and is running.",
    }, { status: 200 });
  }

  // ── 6. Check if queue is enabled in config ────────────────────────────────
  const queueEnabled = await getConfig<boolean>("features.queue_enabled");

  if (queueEnabled) {
    // ── QUEUE PATH: Enqueue job, worker handles the rest ───────────────────
    return await handleQueuePath(req, user, parsed.data, idempotencyParams);
  } else {
    // ── DIRECT PATH: Original createFineTuneJob() — unchanged ─────────────
    return await handleDirectPath(req, user, parsed.data, idempotencyParams);
  }
}

// ─── DIRECT PATH (original behavior) ─────────────────────────────────────────
// Calls createFineTuneJob() synchronously. Used when queue is disabled.
async function handleDirectPath(
  req: NextRequest,
  user: { id: string; email: string },
  data: ReturnType<typeof LaunchTrainSchema.parse>,
  idempotencyParams: Record<string, unknown>
): Promise<NextResponse> {
  const result = await createFineTuneJob({
    userId: user.id,
    ...data,
  });

  if (!result.success) {
    await failIdempotencyKey(user.id, "train", idempotencyParams);
    await auditWarn({
      userId: user.id,
      actorEmail: user.email,
      action: "train.create",
      resource: "training_job",
      metadata: { error: result.error, baseModel: data.baseModel, mode: "direct" },
      req,
    });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await completeIdempotencyKey(user.id, "train", idempotencyParams, result.jobId!);
  // v5: Bust dashboard cache so new job appears immediately
  await invalidateDashboard(user.id);
  await auditInfo({
    userId: user.id,
    actorEmail: user.email,
    action: "train.create",
    resource: "training_job",
    resourceId: result.jobId,
    metadata: {
      baseModel: data.baseModel,
      modelSuffix: data.modelSuffix,
      epochs: data.epochs,
      mode: "direct",
    },
    req,
  });

  return NextResponse.json(
    { jobId: result.jobId, mode: "direct" },
    { status: 201 }
  );
}

// ─── QUEUE PATH (new behavior when Redis is available) ────────────────────────
// Creates DB record, deducts credits, then enqueues. Worker does the rest.
async function handleQueuePath(
  req: NextRequest,
  user: { id: string; email: string; creditsBalance: number },
  data: ReturnType<typeof LaunchTrainSchema.parse>,
  idempotencyParams: Record<string, unknown>
): Promise<NextResponse> {
  // Fetch dataset for rowCount
  const [dataset] = await db
    .select()
    .from(datasets)
    .where(and(eq(datasets.id, data.datasetId), eq(datasets.userId, user.id)));

  if (!dataset) {
    return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
  }

  // Estimate cost
  const estimate = estimateTrainingCost({
    baseModel: data.baseModel,
    rowCount: dataset.rowCount,
    epochs: data.epochs,
  });

  // Check credits
  if (user.creditsBalance < estimate.creditsRequired) {
    return NextResponse.json(
      {
        error: `Insufficient credits. Need ${estimate.creditsRequired}, have ${user.creditsBalance}.`,
        creditsRequired: estimate.creditsRequired,
        creditsBalance: user.creditsBalance,
      },
      { status: 402 }
    );
  }

  // Deduct credits immediately (same as direct path)
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        creditsBalance: user.creditsBalance - estimate.creditsRequired,
        monthlyJobsUsed: (user as { monthlyJobsUsed: number } & typeof user).monthlyJobsUsed + 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await tx.insert(creditTransactions).values({
      userId: user.id,
      type: "deduction",
      amount: -estimate.creditsRequired,
      balanceAfter: user.creditsBalance - estimate.creditsRequired,
      description: `Training job queued: ${data.modelSuffix}`,
      metadata: JSON.stringify({ estimatedCost: estimate.totalCost }),
    });
  });

  // Create DB job record in "queued" status
  const [dbJob] = await db
    .insert(trainingJobs)
    .values({
      userId: user.id,
      datasetId: data.datasetId,
      status: "queued",
      baseModel: data.baseModel,
      modelSuffix: data.modelSuffix,
      epochs: data.epochs,
      learningRate: String(data.learningRate),
      loraRank: data.loraRank,
      warmupRatio: String(data.warmupRatio),
      batchSize: data.batchSize,
      estimatedCost: String(estimate.totalCost),
      creditsDeducted: estimate.creditsRequired,
      logs: JSON.stringify([
        `[${new Date().toISOString()}] Job queued. Model: ${data.modelSuffix}`,
        `[${new Date().toISOString()}] Credits deducted: ${estimate.creditsRequired}`,
        `[${new Date().toISOString()}] Waiting for worker to pick up...`,
      ]),
      queuedAt: new Date(),
    })
    .returning();

  // Enqueue in BullMQ
  // v5 fix: enqueueTrainingJob returns { bullJobId, queued } object — not a string
  const { bullJobId, queued } = await enqueueTrainingJob({
    dbJobId: dbJob.id,
    userId: user.id,
    datasetId: data.datasetId,
    baseModel: data.baseModel,
    modelSuffix: data.modelSuffix,
    epochs: data.epochs,
    learningRate: data.learningRate,
    loraRank: data.loraRank,
    warmupRatio: data.warmupRatio,
    batchSize: data.batchSize,
    estimatedCost: estimate.totalCost,
    creditsDeducted: estimate.creditsRequired,
    enqueuedAt: new Date().toISOString(),
    idempotencyKey: dbJob.id, // use dbJobId as stable idempotency key
  });

  await auditInfo({
    userId: user.id,
    actorEmail: user.email,
    action: "train.create",
    resource: "training_job",
    resourceId: dbJob.id,
    metadata: {
      baseModel: data.baseModel,
      modelSuffix: data.modelSuffix,
      bullJobId,
      queued,
      mode: "queued",
      estimatedCost: estimate.totalCost,
    },
    req,
  });

  // v5: Bust dashboard cache so queued job appears immediately
  await invalidateDashboard(user.id);

  return NextResponse.json(
    { jobId: dbJob.id, bullJobId, mode: "queued" },
    { status: 201 }
  );
}

export const POST = withSentry(handler);
