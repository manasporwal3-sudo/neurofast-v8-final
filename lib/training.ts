// lib/training.ts
// NeuroFast AI Trainer — Core Training Brain
// All Together AI interactions: fine-tuning, inference, job management

import { db } from "./db";
import {
  trainingJobs,
  fineTunedModels,
  users,
  creditTransactions,
  datasets,
} from "./db/schema";
import { eq, and } from "drizzle-orm";
import { prepareDataset, estimateTrainingCost } from "./training-utils";

const TOGETHER_BASE = "https://api.together.xyz/v1";

// ─── TOGETHER API CLIENT ──────────────────────────────────────────────────────
function togetherHeaders() {
  return {
    Authorization: `Bearer ${process.env.TOGETHER_API_KEY!}`,
    "Content-Type": "application/json",
  };
}

async function togetherFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${TOGETHER_BASE}${path}`, {
    ...options,
    headers: {
      ...togetherHeaders(),
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Together API error ${res.status}: ${error}`);
  }

  return res.json() as Promise<T>;
}

// ─── SUPPORTED BASE MODELS ────────────────────────────────────────────────────
export const SUPPORTED_MODELS = [
  {
    id: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    name: "Llama 3.1 8B Instruct",
    description: "Best for most logistics tasks. Fast inference, cost-effective.",
    paramCount: "8B",
    costPerMToken: 0.2, // USD per 1M training tokens
    maxContextLength: 8192,
    recommended: true,
  },
  {
    id: "Qwen/Qwen2.5-7B-Instruct-Turbo",
    name: "Qwen 2.5 7B Instruct",
    description: "Strong multilingual model. Great for Hindi-English logistics.",
    paramCount: "7B",
    costPerMToken: 0.2,
    maxContextLength: 8192,
    recommended: false,
  },
  {
    id: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    name: "Llama 3.1 70B Instruct",
    description: "Maximum capability for complex fleet & routing tasks.",
    paramCount: "70B",
    costPerMToken: 0.9,
    maxContextLength: 8192,
    recommended: false,
  },
  {
    id: "mistralai/Mistral-7B-Instruct-v0.3",
    name: "Mistral 7B Instruct v0.3",
    description: "Efficient European model, strong reasoning.",
    paramCount: "7B",
    costPerMToken: 0.2,
    maxContextLength: 8192,
    recommended: false,
  },
  {
    id: "Qwen/Qwen2.5-72B-Instruct-Turbo",
    name: "Qwen 2.5 72B Instruct",
    description: "Enterprise-grade. Best accuracy for large logistics networks.",
    paramCount: "72B",
    costPerMToken: 0.9,
    maxContextLength: 8192,
    recommended: false,
  },
] as const;

// ─── DATASET UPLOAD TO TOGETHER ───────────────────────────────────────────────
export async function uploadDatasetToTogether(
  jsonlContent: string,
  fileName: string
): Promise<string> {
  // Together API accepts multipart form data for file upload
  const formData = new FormData();
  const blob = new Blob([jsonlContent], { type: "application/octet-stream" });
  formData.append("file", blob, fileName);
  formData.append("purpose", "fine-tune");

  const res = await fetch(`${TOGETHER_BASE}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY!}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to upload dataset to Together: ${error}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

// ─── CREATE FINE-TUNE JOB ─────────────────────────────────────────────────────
export interface CreateJobParams {
  userId: string;
  datasetId: string;
  baseModel: string;
  modelSuffix: string;
  epochs: number;
  learningRate: number;
  loraRank: number;
  warmupRatio: number;
  batchSize: number;
}

export async function createFineTuneJob(params: CreateJobParams): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    // 1. Get user and check credits
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, params.userId));

    if (!user) return { success: false, error: "User not found" };

    // 2. Get dataset
    const [dataset] = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, params.datasetId), eq(datasets.userId, params.userId)));

    if (!dataset) return { success: false, error: "Dataset not found" };

    // 3. Estimate cost
    const estimatedCost = estimateTrainingCost({
      baseModel: params.baseModel,
      rowCount: dataset.rowCount,
      epochs: params.epochs,
    });

    // Convert cost to credits: 1 credit = $0.01
    const creditsRequired = Math.ceil(estimatedCost.totalCost * 100);

    // 4. Check rate limiting (max 3 concurrent jobs)
    const activeJobs = await db
      .select()
      .from(trainingJobs)
      .where(and(
        eq(trainingJobs.userId, params.userId),
        eq(trainingJobs.status, "running")
      ));

    if (activeJobs.length >= 3) {
      return { success: false, error: "Maximum 3 concurrent training jobs allowed. Wait for a job to complete." };
    }

    // 5. Check free tier limits
    if (user.plan === "free" && user.monthlyJobsUsed >= 1) {
      return {
        success: false,
        error: "Free tier limited to 1 training job per month. Upgrade to continue.",
      };
    }

    // 6. Check credit balance
    if (user.creditsBalance < creditsRequired) {
      return {
        success: false,
        error: `Insufficient credits. Required: ${creditsRequired}, Balance: ${user.creditsBalance}. Please top up.`,
      };
    }

    // 7. Upload dataset to Together if not already uploaded
    let togetherFileId = dataset.togetherFileId;
    if (!togetherFileId) {
      // Fetch dataset content from Supabase
      const fileRes = await fetch(dataset.fileUrl);
      const jsonlContent = await fileRes.text();
      togetherFileId = await uploadDatasetToTogether(jsonlContent, dataset.fileName);

      // Save Together file ID
      await db
        .update(datasets)
        .set({ togetherFileId })
        .where(eq(datasets.id, params.datasetId));
    }

    // 8. Create Together fine-tuning job
    const togetherJob = await togetherFetch<{
      id: string;
      status: string;
    }>("/fine_tuning/jobs", {
      method: "POST",
      body: JSON.stringify({
        training_file: togetherFileId,
        model: params.baseModel,
        n_epochs: params.epochs,
        learning_rate: params.learningRate,
        batch_size: params.batchSize,
        lora: true,
        lora_r: params.loraRank,
        warmup_ratio: params.warmupRatio,
        suffix: params.modelSuffix,
      }),
    });

    // 9. Deduct credits atomically
    await db.transaction(async (tx) => {
      // Deduct from user balance
      await tx
        .update(users)
        .set({
          creditsBalance: user.creditsBalance - creditsRequired,
          monthlyJobsUsed: user.monthlyJobsUsed + 1,
          totalJobsRun: user.totalJobsRun + 1,
          updatedAt: new Date(),
        })
        .where(eq(users.id, params.userId));

      // Log credit transaction
      await tx.insert(creditTransactions).values({
        userId: params.userId,
        type: "deduction",
        amount: -creditsRequired,
        balanceAfter: user.creditsBalance - creditsRequired,
        description: `Training job: ${params.modelSuffix} on ${params.baseModel.split("/")[1]}`,
        referenceId: togetherJob.id,
        metadata: { jobId: togetherJob.id, estimatedCost },
      });

      // Create job record
      await tx.insert(trainingJobs).values({
        userId: params.userId,
        datasetId: params.datasetId,
        togetherJobId: togetherJob.id,
        status: "queued",
        baseModel: params.baseModel,
        modelSuffix: params.modelSuffix,
        epochs: params.epochs,
        learningRate: String(params.learningRate),
        loraRank: params.loraRank,
        warmupRatio: String(params.warmupRatio),
        batchSize: params.batchSize,
        estimatedCost: String(estimatedCost.totalCost),
        creditsDeducted: creditsRequired,
        logs: JSON.stringify([
          `[${new Date().toISOString()}] Job created. Together Job ID: ${togetherJob.id}`,
          `[${new Date().toISOString()}] Estimated cost: $${estimatedCost.totalCost.toFixed(4)} (${creditsRequired} credits)`,
          `[${new Date().toISOString()}] Dataset: ${dataset.name} (${dataset.rowCount} examples)`,
          `[${new Date().toISOString()}] Base model: ${params.baseModel}`,
          `[${new Date().toISOString()}] Config: epochs=${params.epochs}, lr=${params.learningRate}, LoRA rank=${params.loraRank}`,
        ]),
        queuedAt: new Date(),
      });
    });

    return { success: true, jobId: togetherJob.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ─── POLL JOB STATUS ─────────────────────────────────────────────────────────
export interface TogetherJobStatus {
  id: string;
  status: "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
  model_output_name?: string;
  trained_tokens?: number;
  epochs_completed?: number;
  created_at?: number;
  updated_at?: number;
  events?: Array<{ message: string; created_at: number; level: string }>;
}

export async function pollJobStatus(togetherJobId: string): Promise<TogetherJobStatus> {
  return togetherFetch<TogetherJobStatus>(`/fine_tuning/jobs/${togetherJobId}`);
}

// ─── SYNC JOB STATUS TO DB ────────────────────────────────────────────────────
export async function syncJobStatus(togetherJobId: string): Promise<void> {
  // Get current job from DB
  const [job] = await db
    .select()
    .from(trainingJobs)
    .where(eq(trainingJobs.togetherJobId, togetherJobId));

  if (!job) return;

  // Fetch status from Together
  const status = await pollJobStatus(togetherJobId);

  // Build log entries from events
  const newLogs = (status.events ?? []).map(
    (e) =>
      `[${new Date(e.created_at * 1000).toISOString()}] [${e.level.toUpperCase()}] ${e.message}`
  );

  const existingLogs = (job.logs as string[]) ?? [];
  const allLogs = [...existingLogs, ...newLogs.filter((l) => !existingLogs.includes(l))];

  // Map Together status to our status
  const mappedStatus = status.status === "pending" ? "queued" : status.status;

  const updateData: Partial<typeof trainingJobs.$inferInsert> = {
    status: mappedStatus,
    logs: JSON.stringify(allLogs),
    trainingTokens: status.trained_tokens ?? job.trainingTokens,
    currentEpoch: status.epochs_completed ?? job.currentEpoch,
    updatedAt: new Date(),
  };

  // Calculate progress
  if (status.epochs_completed && job.epochs) {
    updateData.progressPercent = Math.round((status.epochs_completed / job.epochs) * 100);
  }

  // Handle completion
  if (status.status === "completed" && status.model_output_name) {
    updateData.completedAt = new Date();
    updateData.progressPercent = 100;

    // Create fine-tuned model record
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
        shareId: generateShareId(),
        templateType: null,
      })
      .returning();

    updateData.fineTunedModelId = newModel.id;
    allLogs.push(`[${new Date().toISOString()}] ✅ Training completed! Model: ${status.model_output_name}`);
    updateData.logs = JSON.stringify(allLogs);
  }

  // Handle failure — refund credits if < 2 min
  if (status.status === "failed") {
    updateData.completedAt = new Date();
    updateData.errorMessage = "Training job failed on Together AI servers.";
    allLogs.push(`[${new Date().toISOString()}] ❌ Training failed.`);
    updateData.logs = JSON.stringify(allLogs);

    // Refund if failed within 2 minutes of creation
    const createdAt = new Date(job.createdAt).getTime();
    const now = Date.now();
    if (now - createdAt < 2 * 60 * 1000 && job.creditsDeducted > 0) {
      const [user] = await db.select().from(users).where(eq(users.id, job.userId));
      if (user) {
        await db.transaction(async (tx) => {
          await tx
            .update(users)
            .set({ creditsBalance: user.creditsBalance + job.creditsDeducted })
            .where(eq(users.id, job.userId));

          await tx.insert(creditTransactions).values({
            userId: job.userId,
            type: "refund",
            amount: job.creditsDeducted,
            balanceAfter: user.creditsBalance + job.creditsDeducted,
            description: `Refund for failed job: ${job.modelSuffix}`,
            referenceId: job.togetherJobId,
          });
        });
        updateData.creditsRefunded = job.creditsDeducted;
        allLogs.push(`[${new Date().toISOString()}] 💰 ${job.creditsDeducted} credits refunded.`);
        updateData.logs = JSON.stringify(allLogs);
      }
    }
  }

  await db
    .update(trainingJobs)
    .set(updateData)
    .where(eq(trainingJobs.togetherJobId, togetherJobId));
}

// ─── STREAMING INFERENCE ──────────────────────────────────────────────────────
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function streamInference(
  togetherModelId: string,
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<ReadableStream<Uint8Array>> {
  const fullMessages: ChatMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const res = await fetch(`${TOGETHER_BASE}/chat/completions`, {
    method: "POST",
    headers: togetherHeaders(),
    body: JSON.stringify({
      model: togetherModelId,
      messages: fullMessages,
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.9,
    }),
  });

  if (!res.ok) {
    throw new Error(`Together inference error: ${await res.text()}`);
  }

  return res.body!;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function generateShareId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function getDefaultSystemPrompt(modelSuffix: string): string {
  const suffix = modelSuffix.toLowerCase();
  if (suffix.includes("fleet") || suffix.includes("routing")) {
    return `You are NeuroFast Fleet AI, a specialized logistics assistant for fleet routing and vehicle management. You help optimize routes, predict delivery times, manage driver assignments, and resolve fleet operational issues. Be precise, use logistics terminology, and always prioritize delivery efficiency.`;
  }
  if (suffix.includes("sku") || suffix.includes("inventory")) {
    return `You are NeuroFast Inventory AI, a dark-store specialist for SKU management and inventory optimization. You help manage stock levels, predict demand, optimize warehouse layouts, and handle replenishment cycles. Focus on accuracy and speed in dark-store operations.`;
  }
  return `You are NeuroFast AI, a sovereign logistics intelligence system specialized for Indian supply chain operations. You help optimize dark-store operations, fleet management, inventory prediction, and last-mile delivery. Be concise, data-driven, and operationally focused.`;
}

// ─── CANCEL JOB ───────────────────────────────────────────────────────────────
export async function cancelJob(togetherJobId: string): Promise<void> {
  await togetherFetch(`/fine_tuning/jobs/${togetherJobId}/cancel`, {
    method: "POST",
  });
}

// ─── LIST USER JOBS FROM TOGETHER ─────────────────────────────────────────────
export async function listTogetherJobs(): Promise<TogetherJobStatus[]> {
  const data = await togetherFetch<{ data: TogetherJobStatus[] }>("/fine_tuning/jobs");
  return data.data ?? [];
}
