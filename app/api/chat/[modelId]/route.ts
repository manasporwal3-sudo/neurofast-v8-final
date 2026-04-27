// app/api/chat/[modelId]/route.ts
// POST: Streaming inference using fine-tuned model via Together AI
//
// UPGRADE LOG (v2):
//   + withSentry()     — catches unhandled errors
//   + applyRateLimit() — 20 msgs/min per user (chat limiter)
//   + trackCost()      — logs token usage + USD cost after stream
//   + auditInfo()      — logs each inference call
//   Existing streaming logic: 100% unchanged

import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { fineTunedModels, users, creditTransactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { applyRateLimit } from "@/lib/services/ratelimit";
import { auditInfo } from "@/lib/services/audit";
import { trackCost } from "@/lib/services/cost-tracker";
import { withSentry } from "@/lib/services/sentry";
import { getConfig } from "@/lib/services/config";
import { ChatRequestSchema } from "@/lib/schemas";
// v5 PART 7: Input sanitization — strips script tags from user messages before AI processing
import { sanitize } from "@/lib/ai-control/sanitize";

async function handler(
  req: NextRequest,
  context?: unknown
): Promise<NextResponse> {
  const { modelId } = (context as { params: { modelId: string } }).params;

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const user = await getUserForApi();
  if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

  // ── 2. Rate limit ─────────────────────────────────────────────────────────
  const rateLimitResult = await applyRateLimit(req, user.id, "chat");
  if (rateLimitResult) return rateLimitResult;

  // ── 3. Validate messages ──────────────────────────────────────────────────
  const body = await req.json() as unknown;
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid messages format" }, { status: 400 });
  }

  // v5 PART 7: Sanitize user message content — strips XSS / script injection
  const sanitizedMessages = parsed.data.messages.map((msg) => ({
    ...msg,
    content: msg.role === "user" ? sanitize(msg.content) : msg.content,
  }));

  // ── 4. Get model ──────────────────────────────────────────────────────────
  const [model] = await db
    .select()
    .from(fineTunedModels)
    .where(eq(fineTunedModels.id, modelId));

  if (!model) return NextResponse.json({ error: "Model not found" }, { status: 404 });
  if (model.userId !== user.id && !model.isPublic) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 5. Check credits ──────────────────────────────────────────────────────
  const inferenceCost = await getConfig<number>("pricing.inference_cost_per_msg");
  const INFERENCE_CREDIT_COST = inferenceCost ?? 1;

  const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
  if (!dbUser || dbUser.creditsBalance < INFERENCE_CREDIT_COST) {
    return NextResponse.json(
      { error: "Insufficient credits for inference. Top up in Billing." },
      { status: 402 }
    );
  }

  // ── 6. Build messages with system prompt (unchanged) ──────────────────────
  const systemMessage = model.systemPrompt
    ? { role: "system" as const, content: model.systemPrompt }
    : null;

  const allMessages = [
    ...(systemMessage ? [systemMessage] : []),
    ...sanitizedMessages,
  ];

  // ── 7. Call Together AI (unchanged) ───────────────────────────────────────
  const togetherRes = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TOGETHER_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model.togetherModelId,
      messages: allMessages,
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.9,
    }),
  });

  if (!togetherRes.ok) {
    const error = await togetherRes.text();
    console.error("[Chat inference error]", error);
    return NextResponse.json(
      { error: "Inference failed. Model may still be training." },
      { status: 502 }
    );
  }

  // ── 8. Deduct credit + log cost + audit (async — don't block stream) ──────
  const promptTokenEst = allMessages.reduce(
    (sum, m) => sum + Math.ceil(m.content.length / 4), 0
  );

  db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ creditsBalance: dbUser.creditsBalance - INFERENCE_CREDIT_COST })
      .where(eq(users.id, user.id));

    await tx.insert(creditTransactions).values({
      userId: user.id,
      type: "deduction",
      amount: -INFERENCE_CREDIT_COST,
      balanceAfter: dbUser.creditsBalance - INFERENCE_CREDIT_COST,
      description: `Inference: ${model.name}`,
      referenceId: model.id,
    });

    await tx
      .update(fineTunedModels)
      .set({ totalChats: model.totalChats + 1 })
      .where(eq(fineTunedModels.id, model.id));
  }).catch(console.error);

  // Track cost (non-blocking)
  trackCost({
    userId: user.id,
    model: model.togetherModelId,
    callType: "inference",
    promptTokens: promptTokenEst,
    completionTokens: 256, // estimate; exact count not available in streaming mode
    referenceId: model.id,
  }).catch(console.error);

  // Audit (non-blocking)
  auditInfo({
    userId: user.id,
    actorEmail: user.email,
    action: "inference.chat",
    resource: "fine_tuned_model",
    resourceId: model.id,
    metadata: { modelName: model.name, messageCount: parsed.data.messages.length },
    req,
  }).catch(console.error);

  // ── 9. Stream response to client (unchanged) ──────────────────────────────
  return new NextResponse(togetherRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// withSentry wraps the handler — params are passed through context arg
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ modelId: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  return withSentry(handler)(req, { params });
}
