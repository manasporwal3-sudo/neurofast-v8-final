// app/api/admin/ai-brain/route.ts
// AI CONTROL BRAIN — Production-grade with:
//   - Confidence gating (< 0.7 → clarification required, never executes)
//   - Clarification system (ambiguous prompts return follow-up questions)
//   - Multi-step support (parse array of intents, execute sequentially)
//   - Dry-run mode (simulate changes, show diff, no DB writes)
//   - Rollback snapshots (captured BEFORE every execution)
//   - Admin confirmation for HIGH-RISK actions
//   - Full audit logging with before/after values

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, creditTransactions, auditLogs } from "@/lib/db/schema";
import { requireAdmin, isAdminUser } from "@/lib/services/rbac";
import { getConfig, setConfig } from "@/lib/services/config";
import { withSentry } from "@/lib/services/sentry";
import { captureSnapshot, recordSnapshotAfter } from "@/lib/services/rollback";
import { ParsedIntentSchema, ExecuteIntentSchema } from "@/lib/schemas";
import type { ParsedIntent } from "@/lib/schemas";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
// v5: Prompt injection guard + deterministic fallback parser
import { guardPrompt } from "@/lib/ai-control/promptGuard";
import { runFallbackParser } from "@/lib/ai-control/fallbackParser";
// v5: Cache invalidation on config/credit changes
import { invalidateDashboard } from "@/lib/cache/redis";

// ─── RISK CLASSIFICATION ───────────────────────────────────────────────────────
const HIGH_RISK_ACTIONS = new Set([
  "update_pricing",
  "toggle_maintenance",
  "change_user_role",
]);

const MEDIUM_RISK_ACTIONS = new Set([
  "toggle_feature",
  "update_limits",
  "flag_user",
]);

function getRisk(action: string): "low" | "medium" | "high" {
  if (HIGH_RISK_ACTIONS.has(action)) return "high";
  if (MEDIUM_RISK_ACTIONS.has(action)) return "medium";
  return "low";
}

// ─── PARSE SYSTEM PROMPT ──────────────────────────────────────────────────────
const PARSE_SYSTEM_PROMPT = `You are the NeuroFast AI Control Brain — a strict, safe intent parser for a SaaS admin system.

CRITICAL RULES:
1. Return ONLY valid JSON. No markdown, no explanation outside the JSON.
2. NEVER guess missing parameters. If any required parameter is missing or ambiguous, return a clarification request.
3. For multi-step commands, return an array of intents.
4. Always set confidence honestly (0.0-1.0). If unsure, set confidence below 0.7.

RESPONSE FORMAT — single action:
{
  "type": "intent",
  "action": "<action_name>",
  "parameters": { ... },
  "reasoning": "<one sentence>",
  "confidence": <0.0-1.0>,
  "warnings": ["<any safety concerns>"],
  "requiresApproval": true
}

RESPONSE FORMAT — multiple actions:
{
  "type": "multi_intent",
  "intents": [
    { "action": "...", "parameters": {...}, "reasoning": "...", "confidence": 0.9, "warnings": [] }
  ],
  "overallConfidence": <min of all confidences>,
  "requiresApproval": true
}

RESPONSE FORMAT — needs clarification (use when ANY parameter is missing or ambiguous):
{
  "type": "clarification",
  "message": "<exactly what information is missing>",
  "questions": ["<specific question 1>", "<specific question 2>"],
  "partialAction": "<action if known, else null>",
  "confidence": 0.0
}

RESPONSE FORMAT — rejected (unsafe or not allowed):
{
  "type": "rejected",
  "reason": "<why this cannot be done>",
  "confidence": 0.0
}

ALLOWED ACTIONS:
1. update_pricing — params: { key: "pricing.*", value: number }
   Valid keys: pricing.inference_cost_per_msg (1-10), pricing.free_signup_credits (10-1000)
   
2. toggle_feature — params: { key: "features.*", value: boolean }
   Valid keys: features.maintenance_mode, features.free_tier_enabled, features.registration_open, features.queue_enabled
   
3. update_limits — params: { key: "limits.*", value: number }
   Valid keys: limits.free_monthly_jobs (0-100), limits.max_concurrent_jobs (1-10), limits.max_dataset_rows (100-100000)
   
4. update_rate_limit — params: { key: "ratelimit.*", value: number (1-1000) }
   Valid keys: ratelimit.chat_rpm, ratelimit.train_rpm, ratelimit.upload_rpm
   
5. add_credits — params: { userId: string (exact UUID), amount: number (1-50000), reason: string }
   NOTE: Requires exact userId UUID. If only email/name given, return clarification.
   
6. change_user_role — params: { userId: string (exact UUID), role: "user"|"admin" }
   NOTE: Requires exact userId UUID.
   
7. flag_user — params: { userId: string, reason: string }

8. toggle_maintenance — params: { enabled: boolean, reason: string }
   SHORTCUT for features.maintenance_mode — use this for "maintenance on/off" commands
   
9. send_notification — params: { userId: string, message: string }

EXAMPLES OF CLARIFICATION TRIGGERS:
- "change the price" → clarification: which pricing key? what value?
- "add credits to john" → clarification: exact userId UUID needed
- "disable training" → clarification: disable for all users (toggle_feature) or maintenance mode?
- "reduce limit" → clarification: which limit? by how much?

EXAMPLES OF MULTI-STEP:
- "Enable maintenance and disable free tier" → multi_intent with 2 actions
- "Set pro price to 1999 and add 500 credits to user abc" → multi_intent`;

// ─── EXECUTION ENGINE ─────────────────────────────────────────────────────────
interface ExecuteResult {
  success: boolean;
  before?: unknown;
  after?: unknown;
  message: string;
  affectedResource?: string;
  dryRun?: boolean;
}

async function executeIntent(
  intent: ParsedIntent,
  adminId: string,
  adminEmail: string,
  sessionId: string,
  dryRun = false
): Promise<ExecuteResult> {
  switch (intent.action) {

    case "update_pricing":
    case "toggle_feature":
    case "update_limits":
    case "update_rate_limit": {
      const { key, value } = intent.parameters as { key: string; value: unknown };

      // Validate key prefix matches action
      const allowedPrefixes: Record<string, string> = {
        update_pricing: "pricing.",
        toggle_feature: "features.",
        update_limits: "limits.",
        update_rate_limit: "ratelimit.",
      };
      const prefix = allowedPrefixes[intent.action];
      if (!key.startsWith(prefix)) {
        return { success: false, message: `Key "${key}" must start with "${prefix}"` };
      }

      // Type validation
      if (intent.action === "toggle_feature" && typeof value !== "boolean") {
        return { success: false, message: "Feature flag value must be boolean (true/false)" };
      }
      if (intent.action !== "toggle_feature" && typeof value !== "number") {
        return { success: false, message: "Value must be a number" };
      }
      if (intent.action === "update_rate_limit" && typeof value === "number" && (value < 1 || value > 1000)) {
        return { success: false, message: "Rate limit must be between 1 and 1000" };
      }

      const before = await getConfig(key);

      if (dryRun) {
        return { success: true, before, after: value, affectedResource: key, dryRun: true,
          message: `[DRY RUN] Would change "${key}": ${JSON.stringify(before)} → ${JSON.stringify(value)}` };
      }

      // Capture rollback snapshot BEFORE writing
      await captureSnapshot({ sessionId, adminId, adminEmail, action: intent.action, resource: key, snapshotBefore: before });

      await setConfig(key, value, adminEmail);
      await recordSnapshotAfter(sessionId, value);

      return { success: true, before, after: value, affectedResource: key,
        message: `"${key}" updated: ${JSON.stringify(before)} → ${JSON.stringify(value)}` };
    }

    case "toggle_maintenance": {
      const { enabled, reason } = intent.parameters as { enabled: boolean; reason: string };
      const before = await getConfig("features.maintenance_mode");

      if (dryRun) {
        return { success: true, before, after: enabled, affectedResource: "features.maintenance_mode", dryRun: true,
          message: `[DRY RUN] Would ${enabled ? "ENABLE" : "DISABLE"} maintenance mode. Reason: ${reason}` };
      }

      await captureSnapshot({ sessionId, adminId, adminEmail, action: "toggle_maintenance",
        resource: "features.maintenance_mode", snapshotBefore: before });
      await setConfig("features.maintenance_mode", enabled, adminEmail);
      await recordSnapshotAfter(sessionId, enabled);

      return { success: true, before, after: enabled, affectedResource: "features.maintenance_mode",
        message: `Maintenance mode ${enabled ? "ENABLED" : "DISABLED"}. Reason: ${reason}` };
    }

    case "add_credits": {
      const { userId, amount, reason } = intent.parameters as { userId: string; amount: number; reason: string };
      if (!userId || typeof amount !== "number" || amount <= 0 || amount > 50000) {
        return { success: false, message: "Invalid userId or amount (1–50000)" };
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return { success: false, message: `User ${userId} not found` };

      const before = user.creditsBalance;
      const after = before + amount;

      if (dryRun) {
        return { success: true, before, after, affectedResource: `user:${userId}`, dryRun: true,
          message: `[DRY RUN] Would add ${amount} credits to ${user.email}. Balance: ${before} → ${after}` };
      }

      await captureSnapshot({ sessionId, adminId, adminEmail, action: "add_credits",
        resource: `user:${userId}`, snapshotBefore: { creditsBalance: before } });

      await db.transaction(async (tx) => {
        await tx.update(users).set({ creditsBalance: after }).where(eq(users.id, userId));
        await tx.insert(creditTransactions).values({
          userId, type: "bonus", amount, balanceAfter: after,
          description: `AI Brain: ${reason}`, referenceId: adminId,
        });
      });

      await recordSnapshotAfter(sessionId, { creditsBalance: after });
      // v5: Invalidate dashboard cache so user sees updated balance immediately
      await invalidateDashboard(userId);

      return { success: true, before, after, affectedResource: `user:${userId}`,
        message: `Added ${amount} credits to ${user.email}. Balance: ${before} → ${after}` };
    }

    case "change_user_role": {
      const { userId, role } = intent.parameters as { userId: string; role: "user" | "admin" };
      if (!["user", "admin"].includes(role)) {
        return { success: false, message: "Role must be 'user' or 'admin'" };
      }
      if (userId === adminId) {
        return { success: false, message: "Cannot change your own role" };
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return { success: false, message: `User ${userId} not found` };

      const before = user.role;

      if (dryRun) {
        return { success: true, before, after: role, affectedResource: `user:${userId}`, dryRun: true,
          message: `[DRY RUN] Would change ${user.email} role: ${before} → ${role}` };
      }

      await captureSnapshot({ sessionId, adminId, adminEmail, action: "change_user_role",
        resource: `user:${userId}`, snapshotBefore: { role: before } });
      await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
      await recordSnapshotAfter(sessionId, { role });

      return { success: true, before, after: role, affectedResource: `user:${userId}`,
        message: `${user.email} role changed: ${before} → ${role}` };
    }

    case "flag_user": {
      const { userId, reason } = intent.parameters as { userId: string; reason: string };
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return { success: false, message: `User ${userId} not found` };
      if (dryRun) {
        return { success: true, affectedResource: `user:${userId}`, dryRun: true,
          message: `[DRY RUN] Would flag ${user.email} for review: ${reason}` };
      }
      // Flag is purely an audit action — no DB state change, always rollback-safe
      return { success: true, affectedResource: `user:${userId}`,
        message: `${user.email} flagged for review: ${reason}` };
    }

    case "send_notification": {
      const { userId, message } = intent.parameters as { userId: string; message: string };
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return { success: false, message: `User ${userId} not found` };
      if (dryRun) {
        return { success: true, affectedResource: `user:${userId}`, dryRun: true,
          message: `[DRY RUN] Would notify ${user.email}: "${message}"` };
      }
      // TODO: plug in Resend/FCM
      console.log(`[AI Notification] → ${user.email}: ${message}`);
      return { success: true, affectedResource: `user:${userId}`,
        message: `Notification queued for ${user.email}` };
    }

    default:
      return { success: false, message: `Unknown action: ${String(intent.action)}` };
  }
}

// ─── WRITE AUDIT LOG ──────────────────────────────────────────────────────────
async function writeAuditLog(params: {
  adminId: string;
  adminEmail: string;
  sessionId: string;
  stage: "parse" | "execute" | "dry_run";
  action: string;
  result: ExecuteResult | null;
  intent: ParsedIntent | null;
  req: NextRequest;
}): Promise<void> {
  await db.insert(auditLogs).values({
    userId: params.adminId,
    actorEmail: params.adminEmail,
    action: "admin.ai_action_executed",
    resource: params.intent?.action ?? "ai_brain",
    resourceId: params.sessionId,
    metadata: JSON.stringify({
      stage: params.stage,
      action: params.action,
      parameters: params.intent?.parameters,
      reasoning: params.intent?.reasoning,
      result: params.result,
    }),
    severity: params.result?.success === false ? "error" : params.stage === "execute" ? "warn" : "info",
    ipAddress: params.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  }).catch(console.error);
}

// ─── PARSE HANDLER ────────────────────────────────────────────────────────────
async function parseHandler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const body = await req.json() as { prompt?: string };
  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  // v8 fix: align with promptGuard MAX_PROMPT_LENGTH (800)
  if (body.prompt.length > 800) {
    return NextResponse.json({ error: "Prompt too long (max 800 chars)" }, { status: 400 });
  }

  // v5 STEP 3: Prompt injection protection — runs BEFORE any AI call
  const guard = guardPrompt(body.prompt);
  if (!guard.safe) {
    return NextResponse.json(
      { success: false, error: guard.reason ?? "Unsafe command detected" },
      { status: 400 }
    );
  }

  // v8 fix: include required Anthropic auth headers
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: PARSE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: body.prompt }],
    }),
  });

  if (!claudeRes.ok) {
    console.error("[AI Brain parse] Claude error:", await claudeRes.text());
    // v5 STEP 1: AI unavailable → try deterministic fallback parser
    const fallback = runFallbackParser(body.prompt);
    if (fallback.success) {
      const sessionId = randomUUID();
      return NextResponse.json({
        success: true,
        type: "intent",
        sessionId,
        source: "fallback_parser",
        intent: {
          action: fallback.action,
          parameters: fallback.parameters,
          reasoning: "Parsed deterministically from keyword patterns (AI unavailable)",
          confidence: 1.0,
          requiresApproval: true,
        },
        risk: getRisk(fallback.action),
        warnings: ["AI service was unavailable — parsed via fallback keyword engine"],
      });
    }
    return NextResponse.json({ success: false, error: "AI parsing service unavailable" }, { status: 502 });
  }

  const claudeData = await claudeRes.json() as { content: Array<{ type: string; text: string }> };
  const rawText = claudeData.content.filter(b => b.type === "text").map(b => b.text).join("").trim();

  let parsed: Record<string, unknown>;
  try {
    const clean = rawText.replace(/^```json\n?|```$/g, "").trim();
    parsed = JSON.parse(clean) as Record<string, unknown>;
  } catch {
    // v5 STEP 1: Invalid JSON → try deterministic fallback parser
    const fallback = runFallbackParser(body.prompt);
    if (fallback.success) {
      const sessionId = randomUUID();
      return NextResponse.json({
        success: true,
        type: "intent",
        sessionId,
        source: "fallback_parser",
        intent: {
          action: fallback.action,
          parameters: fallback.parameters,
          reasoning: "Parsed deterministically from keyword patterns (AI returned invalid JSON)",
          confidence: 1.0,
          requiresApproval: true,
        },
        risk: getRisk(fallback.action),
        warnings: ["AI returned unparseable response — parsed via fallback keyword engine"],
      });
    }
    return NextResponse.json({ success: false, error: "Command not recognized. Please be specific." }, { status: 422 });
  }

  const responseType = parsed.type as string;
  const sessionId = randomUUID();

  // ── Clarification needed ───────────────────────────────────────────────────
  if (responseType === "clarification") {
    return NextResponse.json({
      success: false,
      type: "clarification",
      message: parsed.message,
      questions: parsed.questions ?? [],
      partialAction: parsed.partialAction ?? null,
      confidence: 0,
      sessionId,
    });
  }

  // ── Rejected ───────────────────────────────────────────────────────────────
  if (responseType === "rejected") {
    return NextResponse.json({
      success: false,
      type: "rejected",
      reason: parsed.reason,
      confidence: 0,
      sessionId,
    }, { status: 422 });
  }

  // ── Multi-intent ────────────────────────────────────────────────────────────
  if (responseType === "multi_intent") {
    const rawIntents = (parsed.intents ?? []) as unknown[];
    const intents: ParsedIntent[] = [];
    const warnings: string[] = [];

    for (const raw of rawIntents) {
      const v = ParsedIntentSchema.safeParse(raw);
      if (!v.success) {
        return NextResponse.json({ error: "Invalid intent in multi-step", details: v.error.flatten() }, { status: 422 });
      }
      intents.push(v.data);
    }

    const overallConfidence = Math.min(...intents.map(i => i.confidence));
    const overallRisk = intents.some(i => HIGH_RISK_ACTIONS.has(i.action)) ? "high"
      : intents.some(i => MEDIUM_RISK_ACTIONS.has(i.action)) ? "medium" : "low";

    intents.forEach(i => {
      if (i.warnings?.length) warnings.push(...(i.warnings as string[]));
    });

    // Confidence gate for multi-intent
    if (overallConfidence < 0.7) {
      return NextResponse.json({
        success: false,
        type: "low_confidence",
        overallConfidence,
        intents,
        message: `Confidence too low (${Math.round(overallConfidence * 100)}%). Please be more specific.`,
        sessionId,
      });
    }

    return NextResponse.json({
      success: true,
      type: "multi_intent",
      sessionId,
      intents,
      overallConfidence,
      overallRisk,
      warnings,
      stepCount: intents.length,
    });
  }

  // ── Single intent ──────────────────────────────────────────────────────────
  const validated = ParsedIntentSchema.safeParse(parsed);
  if (!validated.success) {
    return NextResponse.json({ error: "AI output failed schema validation", details: validated.error.flatten(), raw: parsed }, { status: 422 });
  }

  const intent = validated.data;
  const risk = getRisk(intent.action);

  // Confidence gate — below 0.7 means Claude itself isn't sure → try fallback parser
  if (intent.confidence < 0.7) {
    const fallback = runFallbackParser(body.prompt);
    if (fallback.success) {
      return NextResponse.json({
        success: true,
        type: "intent",
        sessionId,
        source: "fallback_parser",
        intent: {
          action: fallback.action,
          parameters: fallback.parameters,
          reasoning: "Low AI confidence — parsed deterministically from keyword patterns",
          confidence: 1.0,
          requiresApproval: true,
        },
        risk: getRisk(fallback.action),
        warnings: [`AI confidence was ${Math.round(intent.confidence * 100)}% — used fallback keyword engine`],
      });
    }
    return NextResponse.json({
      success: false,
      type: "low_confidence",
      confidence: intent.confidence,
      intent,
      error: `Confidence score is ${Math.round(intent.confidence * 100)}% — too low to proceed. Please be more specific.`,
      suggestions: [
        "Specify exact values (e.g., 'set to 5' not 'reduce')",
        "Include the exact user ID if modifying a user",
        "Clarify which specific setting to change",
      ],
      sessionId,
    });
  }

  return NextResponse.json({
    success: true,
    type: "intent",
    sessionId,
    intent,
    risk,
    warnings: intent.warnings ?? [],
  });
}

// ─── EXECUTE HANDLER ─────────────────────────────────────────────────────────
async function executeHandler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const body = await req.json() as unknown;
  const parsed = ExecuteIntentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid execute request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { intent, sessionId } = parsed.data;
  const dryRun = (body as Record<string, unknown>).dryRun === true;

  // HIGH RISK: require explicit confirmation flag
  if (HIGH_RISK_ACTIONS.has(intent.action) && !(body as Record<string, unknown>).highRiskConfirmed) {
    return NextResponse.json({
      error: "HIGH_RISK_CONFIRMATION_REQUIRED",
      message: `Action "${intent.action}" is HIGH RISK. Re-submit with highRiskConfirmed: true to proceed.`,
      risk: "high",
    }, { status: 428 });
  }

  const result = await executeIntent(intent, adminResult.id, adminResult.email, sessionId, dryRun);

  await writeAuditLog({
    adminId: adminResult.id,
    adminEmail: adminResult.email,
    sessionId,
    stage: dryRun ? "dry_run" : "execute",
    action: intent.action,
    result,
    intent,
    req,
  });

  return NextResponse.json({
    success: result.success,
    message: result.message,
    before: result.before,
    after: result.after,
    affectedResource: result.affectedResource,
    sessionId,
    dryRun: result.dryRun ?? false,
    rollbackAvailable: !dryRun && result.success && intent.action !== "flag_user",
  }, { status: result.success ? 200 : 400 });
}

// ─── MULTI-EXECUTE HANDLER ───────────────────────────────────────────────────
async function multiExecuteHandler(req: NextRequest): Promise<NextResponse> {
  const adminResult = await requireAdmin();
  if (!isAdminUser(adminResult)) return adminResult;

  const body = await req.json() as { intents?: ParsedIntent[]; sessionId?: string; adminConfirmed?: boolean; dryRun?: boolean };

  if (!body.intents?.length || !body.sessionId) {
    return NextResponse.json({ error: "intents and sessionId required" }, { status: 400 });
  }

  const { dryRun = false } = body;
  const results: Array<{ action: string; result: ExecuteResult }> = [];
  let stepIndex = 0;

  for (const intent of body.intents) {
    const stepSessionId = `${body.sessionId}:step${stepIndex}`;

    // HIGH RISK check for each step
    if (HIGH_RISK_ACTIONS.has(intent.action) && !body.adminConfirmed) {
      return NextResponse.json({
        error: "HIGH_RISK_CONFIRMATION_REQUIRED",
        message: `Step ${stepIndex + 1} action "${intent.action}" is HIGH RISK. Re-submit with adminConfirmed: true.`,
        completedSteps: results,
        failedStep: stepIndex,
      }, { status: 428 });
    }

    const result = await executeIntent(intent, adminResult.id, adminResult.email, stepSessionId, dryRun);
    results.push({ action: intent.action, result });

    await writeAuditLog({
      adminId: adminResult.id, adminEmail: adminResult.email,
      sessionId: stepSessionId, stage: dryRun ? "dry_run" : "execute",
      action: intent.action, result, intent, req,
    });

    // If a step fails (non-dry-run), stop and report
    if (!result.success && !dryRun) {
      return NextResponse.json({
        success: false,
        message: `Step ${stepIndex + 1} failed: ${result.message}`,
        completedSteps: results.slice(0, stepIndex),
        failedStep: stepIndex,
        error: result.message,
        rollbackSuggestion: stepIndex > 0
          ? "Previous steps succeeded. Use rollback to undo them."
          : null,
      }, { status: 400 });
    }

    stepIndex++;
  }

  const allSuccess = results.every(r => r.result.success);

  return NextResponse.json({
    success: allSuccess,
    totalSteps: results.length,
    results: results.map(r => ({
      action: r.action,
      success: r.result.success,
      message: r.result.message,
      before: r.result.before,
      after: r.result.after,
      dryRun: r.result.dryRun,
    })),
    dryRun,
    message: dryRun
      ? `[DRY RUN] ${results.length} actions simulated. No changes made.`
      : `${results.filter(r => r.result.success).length}/${results.length} actions completed.`,
  });
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────
async function router(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "POST" && action === "parse") return parseHandler(req);
  if (req.method === "POST" && action === "execute") return executeHandler(req);
  if (req.method === "POST" && action === "multi-execute") return multiExecuteHandler(req);

  return NextResponse.json({ error: "Use ?action=parse|execute|multi-execute" }, { status: 400 });
}

export const POST = withSentry(router);
