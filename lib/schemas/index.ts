// lib/schemas/index.ts
// All Zod validation schemas — single source of truth for every API route

import { z } from "zod";

// ─── TRAINING ─────────────────────────────────────────────────────────────────
export const LaunchTrainSchema = z.object({
  datasetId: z.string().uuid("Invalid dataset ID"),
  baseModel: z.string().min(1, "Base model required"),
  modelSuffix: z
    .string()
    .min(2).max(40)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  epochs: z.number().int().min(1).max(10).default(3),
  learningRate: z.number().min(1e-6).max(1e-3).default(0.00002),
  loraRank: z.number().int().min(4).max(64).default(8),
  warmupRatio: z.number().min(0).max(0.5).default(0.1),
  batchSize: z.number().int().min(1).max(32).default(4),
});
export type LaunchTrainInput = z.infer<typeof LaunchTrainSchema>;

// ─── CHAT ─────────────────────────────────────────────────────────────────────
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});
export const ChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(50),
});
export type ChatRequestInput = z.infer<typeof ChatRequestSchema>;

// ─── BILLING ──────────────────────────────────────────────────────────────────
export const CreateOrderSchema = z.object({
  credits: z.number().int().min(100).max(100_000),
  priceINR: z.number().min(1).max(100_000),
});
export const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  credits: z.number().int().min(1),
  priceINR: z.number().min(1),
});

// ─── MODELS ───────────────────────────────────────────────────────────────────
export const PatchModelSchema = z.object({
  systemPrompt: z.string().max(4000).optional(),
  safetyFiltersEnabled: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(500).optional(),
});

// ─── ADMIN CONFIG ─────────────────────────────────────────────────────────────
export const UpdateConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
  reason: z.string().min(1).max(200).optional(),
});
export const BulkUpdateConfigSchema = z.object({
  updates: z.array(UpdateConfigSchema).min(1).max(20),
});

// ─── ADMIN USER ───────────────────────────────────────────────────────────────
export const ChangeUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "admin"]),
  reason: z.string().min(1).max(200).optional(),
});
export const AdjustCreditsSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(-10000).max(100000),
  reason: z.string().min(1).max(200),
});

// ─── AI BRAIN — INTENT PARSING ────────────────────────────────────────────────
// Step 1: NL prompt → parsed intent (returned by Claude)
export const ParsedIntentSchema = z.object({
  action: z.enum([
    // Pricing
    "update_pricing",
    // Feature flags
    "toggle_feature",
    // Limits/rate-limits
    "update_limits",
    // User management
    "add_credits",
    "change_user_role",
    "flag_user",
    // System control
    "toggle_maintenance",
    "update_rate_limit",
    // Notification
    "send_notification",
  ]),
  parameters: z.record(z.unknown()),
  reasoning: z.string().min(5).max(600),
  confidence: z.number().min(0).max(1).default(1),
  requiresApproval: z.boolean().default(true),
  // v8 fix: warnings was missing — Claude returns this field but Zod was stripping it
  warnings: z.array(z.string()).optional().default([]),
});
export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

// Step 2: After admin approves — execution request
export const ExecuteIntentSchema = z.object({
  intent: ParsedIntentSchema,
  adminConfirmed: z.literal(true),
  sessionId: z.string().min(1), // ties execution to parse session
});
export type ExecuteIntentInput = z.infer<typeof ExecuteIntentSchema>;

// ─── LEGACY SAFE AI ACTIONS (backwards compat) ───────────────────────────────
export const SafeAiActions = z.enum([
  "send_notification",
  "update_feature_flag",
  "update_rate_limit",
  "add_credits_bonus",
  "flag_user_for_review",
]);
export const AiActionSchema = z.object({
  action: SafeAiActions,
  parameters: z.record(z.unknown()),
  reasoning: z.string().min(10).max(500),
  requiresApproval: z.boolean().default(true),
});
export type SafeAiAction = z.infer<typeof AiActionSchema>;

