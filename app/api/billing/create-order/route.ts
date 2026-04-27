// app/api/billing/create-order/route.ts
// POST: Create Razorpay order for credit purchase
//
// UPGRADE LOG (v2):
//   + withSentry()     — catches unhandled errors
//   + applyRateLimit() — uses "api" limiter (30/min)
//   + auditInfo()      — logs every order creation
//   Existing Razorpay logic: unchanged

import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { applyRateLimit } from "@/lib/services/ratelimit";
import { auditInfo, auditWarn } from "@/lib/services/audit";
import { withSentry } from "@/lib/services/sentry";
import { CreateOrderSchema } from "@/lib/schemas";

async function createRazorpayOrder(amount: number): Promise<{ id: string; amount: number }> {
  const keyId = process.env.RAZORPAY_KEY_ID!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amount * 100,
      currency: "INR",
      receipt: `neurofast_${Date.now()}`,
      notes: { product: "NeuroFast AI Credits" },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Razorpay order creation failed: ${error}`);
  }

  return res.json() as Promise<{ id: string; amount: number }>;
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const user = await getUserForApi();
  if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

  const rateLimitResult = await applyRateLimit(req, user.id, "api");
  if (rateLimitResult) return rateLimitResult;

  const body = await req.json() as unknown;
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { credits, priceINR } = parsed.data;

  const order = await createRazorpayOrder(priceINR);

  await db.insert(payments).values({
    userId: user.id,
    razorpayOrderId: order.id,
    amount: String(priceINR),
    currency: "INR",
    status: "created",
    creditsGranted: credits,
    metadata: { credits, priceINR },
  });

  // Audit: order created
  await auditInfo({
    userId: user.id,
    actorEmail: user.email,
    action: "billing.order_created",
    resource: "payment",
    resourceId: order.id,
    metadata: { credits, priceINR, orderId: order.id },
    req,
  });

  return NextResponse.json({ orderId: order.id });
}

export const POST = withSentry(handler);
