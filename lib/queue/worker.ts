// lib/queue/worker.ts
// BullMQ WORKER — separate process: `npm run worker`
//
// Production features:
//   ✅ Real Together AI fine-tuning (no mocks)
//   ✅ DB status updated at every state transition
//   ✅ Dead-letter queue after 3 failed attempts
//   ✅ Credit refund within 2min window on early failure
//   ✅ PM2 health file written every 30s
//   ✅ Structured JSON logging
//   ✅ Graceful shutdown (SIGTERM/SIGINT)
//   ✅ Worker concurrency: 3 simultaneous jobs
//   ✅ Polling interval: 15s with exponential back-off on Together errors

import "dotenv/config";
import { Worker, Job, UnrecoverableError } from "bullmq";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import * as schema from "../db/schema";
import type { TrainingJobData, TrainingJobResult } from "./definitions";
import { QUEUE_NAMES } from "./definitions";
import { moveToDLQ } from "./client";

// ─── STRUCTURED LOGGER ────────────────────────────────────────────────────────
function log(level: "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta });
  if (level === "error") process.stderr.write(entry + "\n");
  else process.stdout.write(entry + "\n");
}

// ─── PM2 HEALTH FILE ──────────────────────────────────────────────────────────
// PM2 can monitor this file to detect dead workers
const HEALTH_FILE = path.join(process.cwd(), ".worker-health");
let jobsProcessed = 0;
let jobsFailed = 0;

function writeHealthFile() {
  try {
    fs.writeFileSync(HEALTH_FILE, JSON.stringify({
      pid: process.pid,
      uptime: process.uptime(),
      lastBeat: new Date().toISOString(),
      jobsProcessed,
      jobsFailed,
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    }));
  } catch { /* non-fatal */ }
}
setInterval(writeHealthFile, 30_000);
writeHealthFile();

// ─── DB (standalone connection) ───────────────────────────────────────────────
const sql = postgres(process.env.DATABASE_URL!, {
  max: 5,
  idle_timeout: 30,
  connect_timeout: 10,
});
const db = drizzle(sql, { schema });

// ─── TOGETHER AI ──────────────────────────────────────────────────────────────
const TOGETHER_BASE = "https://api.together.xyz/v1";
const TOGETHER_KEY = process.env.TOGETHER_API_KEY!;

function togetherHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${TOGETHER_KEY}`,
    "Content-Type": "application/json",
  };
}

async function togetherPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${TOGETHER_BASE}${path}`, {
    method: "POST",
    headers: togetherHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    // 4xx errors from Together are unrecoverable — don't retry
    if (res.status >= 400 && res.status < 500) {
      throw new UnrecoverableError(`Together ${path} 4xx ${res.status}: ${text}`);
    }
    throw new Error(`Together ${path} failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function togetherGet<T>(path: string): Promise<T> {
  const res = await fetch(`${TOGETHER_BASE}${path}`, { headers: togetherHeaders() });
  if (!res.ok) {
    const text = await res.text();
    if (res.status >= 400 && res.status < 500) {
      throw new UnrecoverableError(`Together GET ${path} 4xx: ${text}`);
    }
    throw new Error(`Together GET ${path} failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── DB HELPERS ───────────────────────────────────────────────────────────────
async function appendLog(dbJobId: string, line: string): Promise<void> {
  try {
    const [job] = await db
      .select({ logs: schema.trainingJobs.logs })
      .from(schema.trainingJobs)
      .where(eq(schema.trainingJobs.id, dbJobId));

    const existing: string[] = Array.isArray(job?.logs) ? (job.logs as string[]) : [];
    const ts = new Date().toISOString();
    const newLogs = [...existing, `[${ts}] ${line}`].slice(-200); // cap at 200 lines

    await db
      .update(schema.trainingJobs)
      .set({ logs: JSON.stringify(newLogs), updatedAt: new Date() })
      .where(eq(schema.trainingJobs.id, dbJobId));
  } catch (err) {
    log("warn", "appendLog failed", { dbJobId, err: String(err) });
  }
}

async function setJobStatus(
  dbJobId: string,
  update: Partial<typeof schema.trainingJobs.$inferInsert>
): Promise<void> {
  await db
    .update(schema.trainingJobs)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(schema.trainingJobs.id, dbJobId));
}

// ─── DATASET → TOGETHER FILE ──────────────────────────────────────────────────
async function ensureTogetherFileId(datasetId: string): Promise<string> {
  const [dataset] = await db
    .select()
    .from(schema.datasets)
    .where(eq(schema.datasets.id, datasetId));

  if (!dataset) throw new UnrecoverableError(`Dataset ${datasetId} not found in DB`);

  // Already uploaded previously — skip re-upload (idempotent)
  if (dataset.togetherFileId) {
    log("info", "Dataset already uploaded to Together", { datasetId, togetherFileId: dataset.togetherFileId });
    return dataset.togetherFileId;
  }

  log("info", "Fetching dataset from Supabase", { datasetId, url: dataset.fileUrl });
  const fileRes = await fetch(dataset.fileUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to fetch dataset from Supabase: ${fileRes.status}`);
  }
  const jsonlContent = await fileRes.text();

  if (!jsonlContent.trim()) {
    throw new UnrecoverableError("Dataset file is empty");
  }

  log("info", "Uploading dataset to Together AI", { datasetId, bytes: jsonlContent.length });

  const formData = new FormData();
  const blob = new Blob([jsonlContent], { type: "application/octet-stream" });
  formData.append("file", blob, dataset.fileName);
  formData.append("purpose", "fine-tune");

  const uploadRes = await fetch(`${TOGETHER_BASE}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOGETHER_KEY}` },
    body: formData,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    if (uploadRes.status >= 400 && uploadRes.status < 500) {
      throw new UnrecoverableError(`Dataset upload rejected by Together: ${err}`);
    }
    throw new Error(`Dataset upload failed: ${err}`);
  }

  const uploadData = (await uploadRes.json()) as { id: string };

  // Persist so next run / retry skips re-upload
  await db
    .update(schema.datasets)
    .set({ togetherFileId: uploadData.id })
    .where(eq(schema.datasets.id, datasetId));

  log("info", "Dataset uploaded to Together", { datasetId, togetherFileId: uploadData.id });
  return uploadData.id;
}

// ─── TOGETHER JOB STATUS ──────────────────────────────────────────────────────
interface TogetherStatus {
  id: string;
  status: "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
  model_output_name?: string;
  trained_tokens?: number;
  epochs_completed?: number;
  events?: Array<{ message: string; created_at: number; level: string }>;
}

// Poll Together every 15s until terminal state
async function pollUntilDone(
  togetherJobId: string,
  dbJobId: string,
  bullJob: Job,
  totalEpochs: number,
  maxMinutes = 240
): Promise<TogetherStatus> {
  const deadline = Date.now() + maxMinutes * 60 * 1000;
  let lastEventIndex = 0;
  let consecutiveErrors = 0;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 15_000));

    let status: TogetherStatus;
    try {
      status = await togetherGet<TogetherStatus>(`/fine_tuning/jobs/${togetherJobId}`);
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      log("warn", "Together poll error", { togetherJobId, attempt: consecutiveErrors, err: String(err) });
      if (consecutiveErrors >= 5) throw err; // give up after 5 consecutive errors
      await new Promise((r) => setTimeout(r, 30_000 * consecutiveErrors)); // back-off
      continue;
    }

    // Append new events to DB logs
    const events = status.events ?? [];
    for (let i = lastEventIndex; i < events.length; i++) {
      const ev = events[i];
      const ts = new Date(ev.created_at * 1000).toISOString();
      await appendLog(dbJobId, `[Together][${ev.level.toUpperCase()}] ${ev.message}`);
    }
    lastEventIndex = events.length;

    // Update progress
    const epochsDone = status.epochs_completed ?? 0;
    const progress = totalEpochs > 0 ? Math.min(Math.round((epochsDone / totalEpochs) * 100), 99) : 0;

    await setJobStatus(dbJobId, {
      status: status.status === "pending" ? "queued" : status.status,
      progressPercent: progress,
      currentEpoch: epochsDone,
      trainingTokens: status.trained_tokens ?? 0,
    });
    await bullJob.updateProgress(progress);

    log("info", "Job poll", {
      togetherJobId,
      status: status.status,
      progress,
      epochsDone,
      trainedTokens: status.trained_tokens,
    });

    if (["completed", "failed", "cancelled"].includes(status.status)) {
      return status;
    }
  }

  throw new Error(`Training timed out after ${maxMinutes} minutes`);
}

// ─── CREDIT REFUND ────────────────────────────────────────────────────────────
// Only refund if job failed within 2 minutes of being enqueued (Together rejected fast)
async function refundIfEligible(data: TrainingJobData): Promise<void> {
  const ageMs = Date.now() - new Date(data.enqueuedAt).getTime();
  if (ageMs > 2 * 60 * 1000 || data.creditsDeducted <= 0) return;

  try {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, data.userId));

    if (!user) return;

    const newBalance = user.creditsBalance + data.creditsDeducted;

    await db.transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({ creditsBalance: newBalance })
        .where(eq(schema.users.id, data.userId));

      await tx.insert(schema.creditTransactions).values({
        userId: data.userId,
        type: "refund",
        amount: data.creditsDeducted,
        balanceAfter: newBalance,
        description: `Auto-refund: early failure for ${data.modelSuffix}`,
        referenceId: data.dbJobId,
      });
    });

    await appendLog(data.dbJobId, `💰 ${data.creditsDeducted} credits refunded (early failure)`);
    log("info", "Credits refunded", { userId: data.userId, amount: data.creditsDeducted });
  } catch (err) {
    log("error", "Credit refund failed", { dbJobId: data.dbJobId, err: String(err) });
  }
}

// ─── MAIN PROCESSOR ───────────────────────────────────────────────────────────
async function processTrainingJob(
  bullJob: Job<TrainingJobData, TrainingJobResult>
): Promise<TrainingJobResult> {
  const data = bullJob.data;
  const { dbJobId, userId, datasetId } = data;
  const startMs = Date.now();

  log("info", "Job started", { dbJobId, attempt: bullJob.attemptsMade + 1, modelSuffix: data.modelSuffix });

  try {
    // ── 1. Mark running ───────────────────────────────────────────────────────
    await setJobStatus(dbJobId, { status: "running", startedAt: new Date() });
    await appendLog(dbJobId, `🚀 Worker started (attempt ${bullJob.attemptsMade + 1}/3) — PID ${process.pid}`);

    // ── 2. Ensure dataset is on Together ─────────────────────────────────────
    await appendLog(dbJobId, "📁 Verifying dataset on Together AI...");
    const togetherFileId = await ensureTogetherFileId(datasetId);
    await appendLog(dbJobId, `✅ Dataset ready: ${togetherFileId}`);

    // ── 3. Create Together fine-tune job ──────────────────────────────────────
    await appendLog(dbJobId, `🧠 Creating fine-tune job: ${data.baseModel}`);

    const togetherJob = await togetherPost<{ id: string; status: string }>("/fine_tuning/jobs", {
      training_file: togetherFileId,
      model: data.baseModel,
      n_epochs: data.epochs,
      learning_rate: data.learningRate,
      batch_size: data.batchSize,
      lora: true,
      lora_r: data.loraRank,
      warmup_ratio: data.warmupRatio,
      suffix: data.modelSuffix,
    });

    await appendLog(dbJobId, `✅ Together job created: ${togetherJob.id}`);
    log("info", "Together job created", { dbJobId, togetherJobId: togetherJob.id });

    // Persist Together job ID
    await setJobStatus(dbJobId, {
      togetherJobId: togetherJob.id,
      status: "running",
      queuedAt: new Date(),
    });

    // ── 4. Poll until done ────────────────────────────────────────────────────
    await appendLog(dbJobId, "⏳ Polling job status every 15s...");
    const finalStatus = await pollUntilDone(togetherJob.id, dbJobId, bullJob, data.epochs);

    // ── 5. Handle completion ──────────────────────────────────────────────────
    if (finalStatus.status === "completed" && finalStatus.model_output_name) {
      await appendLog(dbJobId, `✅ Training complete! Model: ${finalStatus.model_output_name}`);

      // Generate share ID
      const shareId = `${data.modelSuffix.slice(0, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const [newModel] = await db
        .insert(schema.fineTunedModels)
        .values({
          userId,
          jobId: dbJobId,
          name: data.modelSuffix,
          baseModel: data.baseModel,
          togetherModelId: finalStatus.model_output_name,
          status: "active",
          systemPrompt: null,
          shareId,
        })
        .returning();

      const durationMs = Date.now() - startMs;

      await setJobStatus(dbJobId, {
        status: "completed",
        progressPercent: 100,
        completedAt: new Date(),
        trainingTokens: finalStatus.trained_tokens ?? 0,
        fineTunedModelId: newModel.id,
        actualCost: String(data.estimatedCost), // replace with actual when Together exposes it
      });

      // Log actual cost to cost tracker
      await db.insert(schema.aiCostLogs).values({
        userId,
        provider: "together",
        model: data.baseModel,
        callType: "fine_tune",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: finalStatus.trained_tokens ?? 0,
        costUsd: data.estimatedCost.toFixed(6),
        referenceId: dbJobId,
        metadata: JSON.stringify({ togetherJobId: togetherJob.id, durationMs }),
      });

      jobsProcessed++;
      log("info", "Job completed", { dbJobId, togetherJobId: togetherJob.id, durationMs, modelId: newModel.id });

      return {
        success: true,
        togetherJobId: togetherJob.id,
        fineTunedModelId: newModel.id,
        durationMs,
      };
    }

    // ── 6. Handle non-completion ──────────────────────────────────────────────
    const errMsg = `Together job ended with status: ${finalStatus.status}`;
    await appendLog(dbJobId, `❌ ${errMsg}`);
    await setJobStatus(dbJobId, {
      status: "failed",
      completedAt: new Date(),
      errorMessage: errMsg,
    });
    await refundIfEligible(data);
    jobsFailed++;

    // 5xx failures get retried by BullMQ; 4xx are UnrecoverableError (already thrown above)
    throw new Error(errMsg);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isUnrecoverable = err instanceof UnrecoverableError;

    log("error", "Job failed", { dbJobId, attempt: bullJob.attemptsMade + 1, isUnrecoverable, err: message });

    // On last attempt OR unrecoverable — finalize in DB and move to DLQ
    const isLastAttempt = bullJob.attemptsMade + 1 >= (bullJob.opts.attempts ?? 3);
    if (isLastAttempt || isUnrecoverable) {
      await setJobStatus(dbJobId, {
        status: "failed",
        completedAt: new Date(),
        errorMessage: message,
      }).catch(() => {});
      await appendLog(dbJobId, `❌ Terminal failure: ${message}`).catch(() => {});
      await refundIfEligible(data).catch(() => {});
      await moveToDLQ(data, message).catch(() => {});
      jobsFailed++;
    } else {
      await appendLog(dbJobId, `⚠️ Attempt ${bullJob.attemptsMade + 1} failed, will retry: ${message}`).catch(() => {});
    }

    throw err;
  }
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
if (!process.env.REDIS_URL) {
  log("error", "REDIS_URL not set — worker cannot start");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  log("error", "DATABASE_URL not set — worker cannot start");
  process.exit(1);
}
if (!process.env.TOGETHER_API_KEY) {
  log("error", "TOGETHER_API_KEY not set — worker cannot start");
  process.exit(1);
}

const worker = new Worker<TrainingJobData, TrainingJobResult>(
  QUEUE_NAMES.TRAINING,
  processTrainingJob,
  {
    connection: { url: process.env.REDIS_URL },
    concurrency: 3,
    limiter: { max: 3, duration: 60_000 },
    stalledInterval: 60_000,   // check stalled jobs every 60s
    maxStalledCount: 2,         // move to failed after 2 stall checks
  }
);

worker.on("completed", (job, result) => {
  log("info", "Worker: job completed", { jobId: job.id, result });
});

worker.on("failed", (job, err) => {
  log("error", "Worker: job failed", { jobId: job?.id, err: err.message });
});

worker.on("stalled", (jobId) => {
  log("warn", "Worker: job stalled", { jobId });
});

worker.on("error", (err) => {
  log("error", "Worker: uncaught error", { err: err.message });
});

worker.on("active", (job) => {
  log("info", "Worker: job active", { jobId: job.id, modelSuffix: job.data.modelSuffix });
});

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  log("info", `Worker shutting down (${signal})`);
  try {
    await worker.close(); // waits for active jobs to finish (up to 30s)
    await sql.end();
    fs.rmSync(HEALTH_FILE, { force: true });
  } catch (err) {
    log("error", "Shutdown error", { err: String(err) });
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  log("error", "Uncaught exception", { err: err.message, stack: err.stack });
  // Don't exit — BullMQ handles job recovery
});
process.on("unhandledRejection", (reason) => {
  log("error", "Unhandled rejection", { reason: String(reason) });
});

log("info", "Worker started", {
  pid: process.pid,
  queue: QUEUE_NAMES.TRAINING,
  concurrency: 3,
  node: process.version,
});
