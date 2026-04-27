// app/api/jobs/poll/route.ts
// GET: Bulk-sync all active training jobs from Together AI
//
// Called by:
//   1. Vercel Cron (vercel.json cron config) every 2 minutes
//   2. Admin dashboard "Sync All" button
//
// This is the FALLBACK for when BullMQ worker is not running.
// When worker IS running, it handles status updates itself.
// Both can coexist safely — DB updates are idempotent.
//
// Auth: requires CRON_SECRET header OR admin role

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trainingJobs, fineTunedModels, users, creditTransactions, aiCostLogs } from "@/lib/db/schema";
import { eq, inArray, and, notInArray } from "drizzle-orm";
import { withSentry } from "@/lib/services/sentry";
import { auditInfo } from "@/lib/services/audit";

const TOGETHER_BASE = "https://api.together.xyz/v1";

interface TogetherJobStatus {
  id: string;
  status: "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
  model_output_name?: string;
  trained_tokens?: number;
  epochs_completed?: number;
  events?: Array<{ message: string; created_at: number; level: string }>;
}

async function fetchTogetherStatus(togetherJobId: string): Promise<TogetherJobStatus> {
  const res = await fetch(`${TOGETHER_BASE}/fine_tuning/jobs/${togetherJobId}`, {
    headers: {
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY!}`,
      "Content-Type": "application/json",
    },
    // 10s timeout — don't block cron for a single slow job
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Together API ${res.status}: ${text}`);
  }

  return res.json() as Promise<TogetherJobStatus>;
}

function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function getDefaultSystemPrompt(modelSuffix: string): string {
  const s = modelSuffix.toLowerCase();
  if (s.includes("fleet") || s.includes("routing")) {
    return "You are NeuroFast Fleet AI, specialized in last-mile logistics fleet routing and vehicle management. Provide precise, operational guidance for Indian logistics operations.";
  }
  if (s.includes("sku") || s.includes("inventory")) {
    return "You are NeuroFast Inventory AI, a dark-store SKU specialist. Help manage stock levels, demand forecasting, and replenishment cycles with data-driven precision.";
  }
  return "You are NeuroFast AI, a sovereign logistics intelligence system for Indian supply chain operations.";
}

async function handler(req: NextRequest): Promise<NextResponse> {
  // Auth: accept CRON_SECRET (from Vercel cron) or skip in dev
  const cronSecret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecret !== `Bearer ${expectedSecret}` && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });
  }

  const startTime = Date.now();

  // Find all jobs that are still active and have a Together job ID
  const activeJobs = await db
    .select()
    .from(trainingJobs)
    .where(
      and(
        inArray(trainingJobs.status, ["queued", "running", "pending"]),
        notInArray(trainingJobs.status, ["completed", "failed", "cancelled"])
      )
    );

  const jobsWithTogetherIds = activeJobs.filter((j) => j.togetherJobId);

  if (jobsWithTogetherIds.length === 0) {
    return NextResponse.json({ synced: 0, message: "No active jobs to sync" });
  }

  const results: Array<{
    dbJobId: string;
    togetherJobId: string;
    oldStatus: string;
    newStatus: string;
    error?: string;
  }> = [];

  // Process each job sequentially (avoid Together API rate limits)
  for (const job of jobsWithTogetherIds) {
    try {
      const status = await fetchTogetherStatus(job.togetherJobId!);

      // Build new log entries from Together events
      const existingLogs: string[] = Array.isArray(job.logs) ? (job.logs as string[]) : [];
      const existingLogSet = new Set(existingLogs);
      const newEvents = (status.events ?? [])
        .map((e) => `[${new Date(e.created_at * 1000).toISOString()}] [${e.level.toUpperCase()}] ${e.message}`)
        .filter((line) => !existingLogSet.has(line));
      const allLogs = [...existingLogs, ...newEvents].slice(-200);

      const mappedStatus = status.status === "pending" ? "queued" : status.status;
      const progress = (status.epochs_completed && job.epochs)
        ? Math.min(Math.round((status.epochs_completed / job.epochs) * 100), 99)
        : job.progressPercent;

      const update: Partial<typeof trainingJobs.$inferInsert> = {
        status: mappedStatus,
        logs: JSON.stringify(allLogs),
        trainingTokens: status.trained_tokens ?? job.trainingTokens,
        currentEpoch: status.epochs_completed ?? job.currentEpoch,
        progressPercent: progress,
        updatedAt: new Date(),
      };

      // ── Handle completion ──────────────────────────────────────────────────
      if (status.status === "completed" && status.model_output_name && !job.fineTunedModelId) {
        update.completedAt = new Date();
        update.progressPercent = 100;

        const shareId = generateShareId();
        const [newModel] = await db
          .insert(fineTunedModels)
          .values({
            userId: job.userId,
            jobId: job.id,
            name: job.modelSuffix,
            baseModel: job.baseModel,
            togetherModelId: status.model_output_name,
            status: "active",
            systemPrompt: getDefaultSystemPrompt(job.modelSuffix),
            shareId,
          })
          .returning();

        update.fineTunedModelId = newModel.id;
        update.actualCost = job.estimatedCost;

        // Log to cost tracker
        await db.insert(aiCostLogs).values({
          userId: job.userId,
          provider: "together",
          model: job.baseModel,
          callType: "fine_tune",
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: status.trained_tokens ?? 0,
          costUsd: job.estimatedCost ?? "0",
          referenceId: job.id,
          metadata: JSON.stringify({ togetherJobId: job.togetherJobId, syncedByCron: true }),
        });

        allLogs.push(`[${new Date().toISOString()}] ✅ Completed (synced by cron). Model: ${status.model_output_name}`);
        update.logs = JSON.stringify(allLogs);
      }

      // ── Handle failure with refund window ──────────────────────────────────
      if (status.status === "failed" && job.status !== "failed") {
        update.completedAt = new Date();
        update.errorMessage = "Training job failed on Together AI servers.";

        const ageMs = Date.now() - new Date(job.createdAt).getTime();
        if (ageMs < 2 * 60 * 1000 && job.creditsDeducted > 0 && job.creditsRefunded === 0) {
          const [user] = await db.select().from(users).where(eq(users.id, job.userId));
          if (user) {
            const newBalance = user.creditsBalance + job.creditsDeducted;
            await db.transaction(async (tx) => {
              await tx
                .update(users)
                .set({ creditsBalance: newBalance })
                .where(eq(users.id, job.userId));
              await tx.insert(creditTransactions).values({
                userId: job.userId,
                type: "refund",
                amount: job.creditsDeducted,
                balanceAfter: newBalance,
                description: `Auto-refund: early failure for ${job.modelSuffix}`,
                referenceId: job.togetherJobId,
              });
            });
            update.creditsRefunded = job.creditsDeducted;
          }
        }

        allLogs.push(`[${new Date().toISOString()}] ❌ Failed (synced by cron).`);
        update.logs = JSON.stringify(allLogs);
      }

      await db
        .update(trainingJobs)
        .set(update)
        .where(eq(trainingJobs.id, job.id));

      results.push({
        dbJobId: job.id,
        togetherJobId: job.togetherJobId!,
        oldStatus: job.status,
        newStatus: mappedStatus,
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Poll cron] Job ${job.id} sync failed:`, message);
      results.push({
        dbJobId: job.id,
        togetherJobId: job.togetherJobId!,
        oldStatus: job.status,
        newStatus: job.status, // unchanged
        error: message,
      });
    }
  }

  const durationMs = Date.now() - startTime;

  await auditInfo({
    action: "train.create",
    resource: "cron_poll",
    metadata: {
      jobsChecked: jobsWithTogetherIds.length,
      results: results.map(r => ({ ...r, error: r.error?.slice(0, 100) })),
      durationMs,
    },
    severity: "info",
    req,
  });

  return NextResponse.json({
    synced: results.length,
    durationMs,
    results,
  });
}

export const GET = withSentry(handler);
// Also support POST for manual trigger from admin UI
export const POST = withSentry(handler);
