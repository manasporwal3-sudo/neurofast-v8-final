// lib/queue/definitions.ts
// Shared type definitions for BullMQ queues.
// Imported by both the API (to enqueue) and the worker (to process).

// ─── QUEUE NAMES ─────────────────────────────────────────────────────────────
export const QUEUE_NAMES = {
  TRAINING: "neurofast:training",
  TRAINING_DLQ: "neurofast:training:dlq", // dead-letter queue — jobs that exhausted retries
} as const;

// ─── IDEMPOTENCY ──────────────────────────────────────────────────────────────
// Every job is keyed by dbJobId so duplicate enqueues are rejected by BullMQ
export function makeJobId(dbJobId: string): string {
  return `train:${dbJobId}`;
}

// ─── JOB DATA TYPES ──────────────────────────────────────────────────────────
export interface TrainingJobData {
  dbJobId: string;        // trainingJobs.id — idempotency key
  userId: string;
  datasetId: string;
  baseModel: string;
  modelSuffix: string;
  epochs: number;
  learningRate: number;
  loraRank: number;
  warmupRatio: number;
  batchSize: number;
  estimatedCost: number;
  creditsDeducted: number;
  enqueuedAt: string;     // ISO — refund eligibility window
  idempotencyKey: string; // sha256(userId+datasetId+modelSuffix+timestamp)
}

export interface TrainingJobResult {
  success: boolean;
  togetherJobId?: string;
  fineTunedModelId?: string;
  error?: string;
  durationMs?: number;
}

export type JobStatus =
  | "pending"    // DB created, not yet queued
  | "queued"     // in BullMQ, waiting for worker slot
  | "running"    // worker active, Together job in progress
  | "completed"  // model ready
  | "failed"     // exhausted retries, moved to DLQ
  | "cancelled"; // user or admin cancelled

// ─── PRODUCTION JOB OPTIONS ───────────────────────────────────────────────────
// PART 6 — WORKER RELIABILITY
// 3 attempts: 2s → 4s → 8s (exponential backoff starting at 2000ms)
// After 3 failures → job marked failed, worker calls moveToDLQ()
export const TRAINING_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2_000 }, // 2s, 4s, 8s
  removeOnComplete: { count: 200, age: 7 * 24 * 3600 },   // 200 jobs OR 7 days
  removeOnFail: false,                                       // keep ALL failed for DLQ routing
};

// DLQ options — keep indefinitely for manual review
export const DLQ_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: false,
  removeOnFail: false,
};

