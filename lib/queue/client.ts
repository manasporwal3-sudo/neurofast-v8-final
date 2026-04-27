// lib/queue/client.ts
// BullMQ Queue CLIENT — only used to ADD jobs to the queue.
// Features:
//   - Idempotency: jobId = makeJobId(dbJobId), BullMQ rejects duplicates
//   - DLQ routing: jobs that exhaust retries are moved to the DLQ queue
//   - Graceful no-op when REDIS_URL is not set (dev without Redis)
//   - Health check endpoint used by admin dashboard

import { Queue } from "bullmq";
import type { TrainingJobData, TrainingJobResult } from "./definitions";
import { QUEUE_NAMES, TRAINING_JOB_OPTIONS, DLQ_JOB_OPTIONS, makeJobId } from "./definitions";

// ─── REDIS CONNECTION CONFIG ──────────────────────────────────────────────────
function getRedisConnection(): { url: string } | null {
  if (!process.env.REDIS_URL) return null;
  return { url: process.env.REDIS_URL };
}

// ─── SINGLETON QUEUES ─────────────────────────────────────────────────────────
let _trainingQueue: Queue<TrainingJobData, TrainingJobResult> | null = null;
let _dlqQueue: Queue<TrainingJobData, TrainingJobResult> | null = null;

export function getTrainingQueue(): Queue<TrainingJobData, TrainingJobResult> | null {
  const conn = getRedisConnection();
  if (!conn) return null;
  if (!_trainingQueue) {
    _trainingQueue = new Queue<TrainingJobData, TrainingJobResult>(
      QUEUE_NAMES.TRAINING,
      { connection: conn, defaultJobOptions: TRAINING_JOB_OPTIONS }
    );
  }
  return _trainingQueue;
}

export function getDLQQueue(): Queue<TrainingJobData, TrainingJobResult> | null {
  const conn = getRedisConnection();
  if (!conn) return null;
  if (!_dlqQueue) {
    _dlqQueue = new Queue<TrainingJobData, TrainingJobResult>(
      QUEUE_NAMES.TRAINING_DLQ,
      { connection: conn, defaultJobOptions: DLQ_JOB_OPTIONS }
    );
  }
  return _dlqQueue;
}

// ─── ENQUEUE WITH IDEMPOTENCY ─────────────────────────────────────────────────
// Returns the BullMQ job.id or null when Redis unavailable.
// BullMQ deduplicates by jobId — sending the same dbJobId twice is safe.
export async function enqueueTrainingJob(
  data: TrainingJobData
): Promise<{ bullJobId: string | undefined; queued: boolean }> {
  const queue = getTrainingQueue();
  if (!queue) {
    return { bullJobId: undefined, queued: false };
  }

  const jobId = makeJobId(data.dbJobId);

  // Check if already exists (idempotency guard)
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (!["failed", "completed"].includes(state)) {
      // Job is already active — return existing ID without re-enqueue
      return { bullJobId: existing.id, queued: false };
    }
  }

  const job = await queue.add(
    `train:${data.modelSuffix}`,
    data,
    { ...TRAINING_JOB_OPTIONS, jobId }
  );

  return { bullJobId: job.id, queued: true };
}

// ─── MOVE FAILED JOB TO DLQ ───────────────────────────────────────────────────
export async function moveToDLQ(data: TrainingJobData, reason: string): Promise<void> {
  const dlq = getDLQQueue();
  if (!dlq) return;
  await dlq.add(`dlq:${data.modelSuffix}`, { ...data }, {
    ...DLQ_JOB_OPTIONS,
    jobId: `dlq:${data.dbJobId}`,
  });
  console.error(`[DLQ] Job ${data.dbJobId} moved to DLQ. Reason: ${reason}`);
}

// ─── QUEUE HEALTH CHECK ───────────────────────────────────────────────────────
export async function getQueueStats(): Promise<{
  training: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  dlq: { waiting: number; failed: number };
  redisAvailable: boolean;
} | null> {
  const queue = getTrainingQueue();
  const dlq = getDLQQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  const dlqWaiting = dlq ? await dlq.getWaitingCount() : 0;
  const dlqFailed = dlq ? await dlq.getFailedCount() : 0;

  return {
    training: { waiting, active, completed, failed, delayed },
    dlq: { waiting: dlqWaiting, failed: dlqFailed },
    redisAvailable: true,
  };
}

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
export async function closeQueues(): Promise<void> {
  await Promise.all([
    _trainingQueue?.close(),
    _dlqQueue?.close(),
  ]);
  _trainingQueue = null;
  _dlqQueue = null;
}

