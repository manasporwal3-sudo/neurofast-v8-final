// lib/db/schema.ts
// NeuroFast AI Trainer — Complete Database Schema
// All tables for users, models, jobs, credits, datasets, payments

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── USERS ──────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  role: varchar("role", { length: 20 }).notNull().default("user"), // user | admin
  plan: varchar("plan", { length: 20 }).notNull().default("free"), // free | starter | pro | enterprise
  creditsBalance: integer("credits_balance").notNull().default(100), // Free 100 credits
  totalJobsRun: integer("total_jobs_run").notNull().default(0),
  monthlyJobsUsed: integer("monthly_jobs_used").notNull().default(0),
  monthlyJobsResetAt: timestamp("monthly_jobs_reset_at").defaultNow(),
  apiKey: text("api_key"), // User's personal API key for their deployed models
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── DATASETS ───────────────────────────────────────────────────────────────
export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(), // Supabase Storage URL
    fileSizeBytes: integer("file_size_bytes").notNull().default(0),
    format: varchar("format", { length: 20 }).notNull().default("jsonl"), // jsonl | csv
    rowCount: integer("row_count").notNull().default(0),
    templateType: text("template_type"), // null if custom | sku | fleet | inventory | cyber
    isValidated: boolean("is_validated").notNull().default(false),
    validationErrors: jsonb("validation_errors"),
    togetherFileId: text("together_file_id"), // File ID from Together AI upload
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index("datasets_user_id_idx").on(t.userId),
  })
);

// ─── TRAINING JOBS ──────────────────────────────────────────────────────────
export const trainingJobs = pgTable(
  "training_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    datasetId: uuid("dataset_id").references(() => datasets.id),

    // Together AI job details
    togetherJobId: text("together_job_id").unique(),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    // pending | queued | running | completed | failed | cancelled

    // Model config
    baseModel: text("base_model").notNull(),
    modelSuffix: text("model_suffix").notNull(), // e.g. "neurofast-fleet-v1"
    loraRank: integer("lora_rank").notNull().default(8),
    epochs: integer("epochs").notNull().default(3),
    learningRate: decimal("learning_rate", { precision: 10, scale: 8 }).notNull().default("0.00002"),
    warmupRatio: decimal("warmup_ratio", { precision: 5, scale: 4 }).notNull().default("0.1"),
    batchSize: integer("batch_size").notNull().default(4),

    // Cost & credits
    estimatedCost: decimal("estimated_cost", { precision: 10, scale: 4 }),
    actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),
    creditsDeducted: integer("credits_deducted").notNull().default(0),
    creditsRefunded: integer("credits_refunded").notNull().default(0),

    // Progress
    progressPercent: integer("progress_percent").notNull().default(0),
    currentEpoch: integer("current_epoch").notNull().default(0),
    trainingTokens: integer("training_tokens").notNull().default(0),
    logs: jsonb("logs").default("[]"), // Array of log strings

    // Result
    fineTunedModelId: uuid("fine_tuned_model_id"),
    errorMessage: text("error_message"),

    // Timing
    queuedAt: timestamp("queued_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index("jobs_user_id_idx").on(t.userId),
    statusIdx: index("jobs_status_idx").on(t.status),
    togetherJobIdIdx: index("jobs_together_id_idx").on(t.togetherJobId),
    // v5 PART 2: Add createdAt index — speeds up date-range dashboard queries
    createdAtIdx: index("jobs_created_at_idx").on(t.createdAt),
  })
);

// ─── FINE-TUNED MODELS ──────────────────────────────────────────────────────
export const fineTunedModels = pgTable(
  "fine_tuned_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => trainingJobs.id),

    name: text("name").notNull(),
    description: text("description"),
    baseModel: text("base_model").notNull(),
    togetherModelId: text("together_model_id").notNull().unique(), // e.g. "user123/neurofast-fleet-v1"
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | archived | deleted

    // Model behavior customization
    systemPrompt: text("system_prompt"),
    safetyFiltersEnabled: boolean("safety_filters_enabled").notNull().default(true),
    customFilters: jsonb("custom_filters").default("[]"),

    // Stats
    totalInferenceTokens: integer("total_inference_tokens").notNull().default(0),
    totalChats: integer("total_chats").notNull().default(0),
    avgRating: decimal("avg_rating", { precision: 3, scale: 2 }),

    // Sharing
    shareId: text("share_id").unique(), // Short ID for public share link
    isPublic: boolean("is_public").notNull().default(false),

    // Metadata
    templateType: text("template_type"),
    tags: jsonb("tags").default("[]"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index("models_user_id_idx").on(t.userId),
    shareIdIdx: index("models_share_id_idx").on(t.shareId),
  })
);

// ─── CREDITS TRANSACTIONS ───────────────────────────────────────────────────
export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull(),
    // purchase | deduction | refund | bonus | signup_bonus | referral
    amount: integer("amount").notNull(), // positive = credit, negative = debit
    balanceAfter: integer("balance_after").notNull(),
    description: text("description").notNull(),
    referenceId: text("reference_id"), // job_id or payment_id
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index("credits_user_id_idx").on(t.userId),
  })
);

// ─── PAYMENTS ───────────────────────────────────────────────────────────────
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    razorpayOrderId: text("razorpay_order_id").unique(),
    razorpayPaymentId: text("razorpay_payment_id").unique(),
    razorpaySignature: text("razorpay_signature"),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // INR
    currency: varchar("currency", { length: 5 }).notNull().default("INR"),
    status: varchar("status", { length: 20 }).notNull().default("created"),
    // created | paid | failed | refunded
    creditsGranted: integer("credits_granted").notNull().default(0),
    planUpgradedTo: text("plan_upgraded_to"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index("payments_user_id_idx").on(t.userId),
    razorpayOrderIdx: index("payments_razorpay_order_idx").on(t.razorpayOrderId),
  })
);

// ─── CHAT SESSIONS ──────────────────────────────────────────────────────────
export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modelId: uuid("model_id")
      .notNull()
      .references(() => fineTunedModels.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New Chat"),
    messages: jsonb("messages").notNull().default("[]"),
    tokensUsed: integer("tokens_used").notNull().default(0),
    shareId: text("share_id").unique(),
    isShared: boolean("is_shared").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index("sessions_user_id_idx").on(t.userId),
    modelIdIdx: index("sessions_model_id_idx").on(t.modelId),
  })
);

// ─── PREFERENCE PAIRS (DPO) ──────────────────────────────────────────────────
export const preferencePairs = pgTable(
  "preference_pairs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modelId: uuid("model_id").references(() => fineTunedModels.id, {
      onDelete: "cascade",
    }),
    prompt: text("prompt").notNull(),
    chosenResponse: text("chosen_response").notNull(),
    rejectedResponse: text("rejected_response").notNull(),
    category: text("category"), // safety | accuracy | tone | logistics
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    modelIdIdx: index("prefs_model_id_idx").on(t.modelId),
  })
);

// ─── RELATIONS ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  datasets: many(datasets),
  trainingJobs: many(trainingJobs),
  fineTunedModels: many(fineTunedModels),
  creditTransactions: many(creditTransactions),
  payments: many(payments),
  chatSessions: many(chatSessions),
}));

export const trainingJobsRelations = relations(trainingJobs, ({ one }) => ({
  user: one(users, { fields: [trainingJobs.userId], references: [users.id] }),
  dataset: one(datasets, { fields: [trainingJobs.datasetId], references: [datasets.id] }),
  fineTunedModel: one(fineTunedModels, {
    fields: [trainingJobs.fineTunedModelId],
    references: [fineTunedModels.id],
  }),
}));

export const fineTunedModelsRelations = relations(fineTunedModels, ({ one, many }) => ({
  user: one(users, { fields: [fineTunedModels.userId], references: [users.id] }),
  job: one(trainingJobs, { fields: [fineTunedModels.jobId], references: [trainingJobs.id] }),
  chatSessions: many(chatSessions),
  preferencePairs: many(preferencePairs),
}));

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
// Immutable log of every sensitive action in the system
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"), // denormalized for fast display
    action: text("action").notNull(),   // e.g. "train.create", "billing.purchase", "admin.config_update"
    resource: text("resource"),         // e.g. "training_job", "payment"
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").default("{}"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    severity: varchar("severity", { length: 10 }).notNull().default("info"), // info | warn | error | critical
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("audit_user_idx").on(t.userId),
    actionIdx: index("audit_action_idx").on(t.action),
    createdIdx: index("audit_created_idx").on(t.createdAt),
  })
);

// ─── SYSTEM CONFIG ─────────────────────────────────────────────────────────────
// AI-controllable platform settings — read by API routes at runtime
export const systemConfig = pgTable("system_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),      // e.g. "free_tier_job_limit"
  value: jsonb("value").notNull(),           // any JSON value
  description: text("description"),
  category: varchar("category", { length: 30 }).notNull().default("general"),
  // general | pricing | limits | features | ai
  isEditable: boolean("is_editable").notNull().default(true),
  lastUpdatedBy: text("last_updated_by"),   // "admin" | "ai_system" | user email
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── COST TRACKING ─────────────────────────────────────────────────────────────
// Per-call AI usage tracking for Together AI calls
export const aiCostLogs = pgTable(
  "ai_cost_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 30 }).notNull().default("together"),
    model: text("model").notNull(),
    callType: varchar("call_type", { length: 20 }).notNull(), // "inference" | "fine_tune"
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    costUsd: decimal("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
    referenceId: text("reference_id"), // job_id or chat_session_id
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("cost_user_idx").on(t.userId),
    createdIdx: index("cost_created_idx").on(t.createdAt),
    callTypeIdx: index("cost_calltype_idx").on(t.callType),
  })
);

// ─── ROLLBACK LOGS ────────────────────────────────────────────────────────────
// Stores pre-execution snapshots for every AI brain action
// Allows full rollback via POST /api/admin/rollback
export const rollbackLogs = pgTable(
  "rollback_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id").notNull().unique(), // ties to AI brain session
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    adminEmail: text("admin_email").notNull(),
    action: text("action").notNull(),                 // e.g. "update_pricing"
    resource: text("resource").notNull(),             // config key or "user:{id}"
    snapshotBefore: jsonb("snapshot_before").notNull(), // exact value before change
    snapshotAfter: jsonb("snapshot_after"),            // value after (set on execution)
    rolledBack: boolean("rolled_back").notNull().default(false),
    rolledBackAt: timestamp("rolled_back_at"),
    rolledBackBy: text("rolled_back_by"),
    rollbackError: text("rollback_error"),
    expiresAt: timestamp("expires_at").notNull(),     // rollbacks expire after 24h
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("rollback_session_idx").on(t.sessionId),
    adminIdx: index("rollback_admin_idx").on(t.adminId),
    createdIdx: index("rollback_created_idx").on(t.createdAt),
  })
);

// ─── IDEMPOTENCY KEYS ─────────────────────────────────────────────────────────
// Prevents duplicate training jobs and payment operations
// Key = sha256(userId + operationType + uniqueParams)
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    operation: varchar("operation", { length: 50 }).notNull(), // "train" | "payment"
    resultId: text("result_id"),                     // job_id or payment_id
    status: varchar("status", { length: 20 }).notNull().default("processing"),
    // processing | completed | failed
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),    // 24h TTL
  },
  (t) => ({
    keyIdx: index("idempotency_key_idx").on(t.key),
    userIdx: index("idempotency_user_idx").on(t.userId),
    expiresIdx: index("idempotency_expires_idx").on(t.expiresAt),
  })
);

// ─── TYPE EXPORTS ─────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Dataset = typeof datasets.$inferSelect;
export type TrainingJob = typeof trainingJobs.$inferSelect;
export type FineTunedModel = typeof fineTunedModels.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type PreferencePair = typeof preferencePairs.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type SystemConfig = typeof systemConfig.$inferSelect;
export type AiCostLog = typeof aiCostLogs.$inferSelect;
export type RollbackLog = typeof rollbackLogs.$inferSelect;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
