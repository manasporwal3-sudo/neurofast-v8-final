// lib/services/cost-tracker.ts
// Hook into every Together AI call and log tokens + USD cost
// Called AFTER successful API responses — never blocks the main flow

import { db } from "@/lib/db";
import { aiCostLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Together AI pricing (USD per 1M tokens) — update when pricing changes
const TOGETHER_INFERENCE_PRICES: Record<string, { input: number; output: number }> = {
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": { input: 0.18, output: 0.18 },
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": { input: 0.88, output: 0.88 },
  "Qwen/Qwen2.5-7B-Instruct-Turbo": { input: 0.18, output: 0.18 },
  "Qwen/Qwen2.5-72B-Instruct-Turbo": { input: 0.88, output: 0.88 },
  "mistralai/Mistral-7B-Instruct-v0.3": { input: 0.2, output: 0.2 },
};

const TOGETHER_FINETUNE_PRICES: Record<string, number> = {
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": 0.2,
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": 0.9,
  "Qwen/Qwen2.5-7B-Instruct-Turbo": 0.2,
  "Qwen/Qwen2.5-72B-Instruct-Turbo": 0.9,
  "mistralai/Mistral-7B-Instruct-v0.3": 0.2,
};

export function calcInferenceCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const prices = TOGETHER_INFERENCE_PRICES[model] ?? { input: 0.3, output: 0.3 };
  return (
    (promptTokens / 1_000_000) * prices.input +
    (completionTokens / 1_000_000) * prices.output
  );
}

export function calcFinetuneCost(model: string, totalTokens: number): number {
  const pricePerM = TOGETHER_FINETUNE_PRICES[model] ?? 0.3;
  return (totalTokens / 1_000_000) * pricePerM;
}

export interface TrackCostParams {
  userId: string;
  provider?: string;
  model: string;
  callType: "inference" | "fine_tune";
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export async function trackCost(params: TrackCostParams): Promise<void> {
  try {
    const promptTokens = params.promptTokens ?? 0;
    const completionTokens = params.completionTokens ?? 0;
    const totalTokens = params.totalTokens ?? promptTokens + completionTokens;

    const costUsd =
      params.callType === "inference"
        ? calcInferenceCost(params.model, promptTokens, completionTokens)
        : calcFinetuneCost(params.model, totalTokens);

    await db.insert(aiCostLogs).values({
      userId: params.userId,
      provider: params.provider ?? "together",
      model: params.model,
      callType: params.callType,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd: costUsd.toFixed(6),
      referenceId: params.referenceId ?? null,
      metadata: JSON.stringify(params.metadata ?? {}),
    });
  } catch (err) {
    // Non-fatal — cost tracking must never break user flows
    console.error("[CostTracker] Failed to log cost:", err);
  }
}

// Get total spend for a user (USD)
export async function getUserTotalCost(userId: string): Promise<number> {
  const rows = await db
    .select({ costUsd: aiCostLogs.costUsd })
    .from(aiCostLogs)
    .where(eq(aiCostLogs.userId, userId));

  return rows.reduce((sum, r) => sum + parseFloat(String(r.costUsd)), 0);
}
