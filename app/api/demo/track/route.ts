// app/api/demo/track/route.ts — v8 NEW
// POST: Track demo engagement events (anonymous — no auth required)
// Used by the demo page to record conversion funnel steps
// Data is stored in audit_logs with action "demo.chat_message" or "demo.conversion"

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { withSentry } from "@/lib/services/sentry";
import { applyRateLimit, getClientIp } from "@/lib/services/ratelimit";
import { z } from "zod";

const TrackSchema = z.object({
  event: z.enum([
    "demo_started",
    "chat_message_sent",
    "train_step_viewed",
    "conversion_modal_shown",
    "signup_cta_clicked",
  ]),
  metadata: z.record(z.unknown()).optional().default({}),
});

async function handler(req: NextRequest): Promise<NextResponse> {
  // Rate limit by IP — 30 events per hour per IP
  const ip = getClientIp(req);
  const rl = await applyRateLimit(req, ip, "demo");
  if (rl) return rl;

  const body = await req.json().catch(() => null);
  const parsed = TrackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const { event, metadata } = parsed.data;

  // Map to audit action
  const action =
    event === "signup_cta_clicked" || event === "conversion_modal_shown"
      ? ("demo.conversion" as const)
      : ("demo.chat_message" as const);

  // Non-blocking audit write
  db.insert(auditLogs)
    .values({
      userId: null,
      actorEmail: null,
      action,
      resource: "demo",
      metadata: JSON.stringify({ event, ...metadata }),
      ipAddress: ip,
      severity: "info",
    })
    .catch(() => {}); // never fail a tracking call

  return NextResponse.json({ tracked: true });
}

export const POST = withSentry(handler);
