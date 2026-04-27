// app/api/billing/verify-payment/route.ts
// POST: Verify Razorpay payment signature and credit user account
//
// UPGRADE LOG (v2):
//   + withSentry()     — critical route, must never silently fail
//   + auditCritical()  — payment verifications logged as critical severity
//   Existing signature verification + credit logic: unchanged

import { NextRequest, NextResponse } from "next/server";
import { getUserForApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { payments, users, creditTransactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createHmac } from "crypto";
import { auditInfo, auditWarn } from "@/lib/services/audit";
import { withSentry } from "@/lib/services/sentry";
import { VerifyPaymentSchema } from "@/lib/schemas";

function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");
  return expectedSignature === signature;
}

async function handler(req: NextRequest): Promise<NextResponse> {
  const user = await getUserForApi();
  if (!user) return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 });

  const body = await req.json() as unknown;
  const parsed = VerifyPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, credits } = parsed.data;

  // Verify signature (existing logic — unchanged)
  const isValid = verifyRazorpaySignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!isValid) {
    await auditWarn({
      userId: user.id,
      actorEmail: user.email,
      action: "billing.payment_verified",
      resource: "payment",
      resourceId: razorpay_order_id,
      metadata: { reason: "invalid_signature", paymentId: razorpay_payment_id },
      severity: "warn",
      req,
    });
    return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
  }

  // Idempotency check (existing logic — unchanged)
  const [existingPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.razorpayPaymentId, razorpay_payment_id));

  if (existingPayment?.status === "paid") {
    return NextResponse.json({ success: true, alreadyProcessed: true });
  }

  // Atomic credit grant (existing logic — unchanged)
  await db.transaction(async (tx) => {
    const [currentUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, user.id));

    if (!currentUser) throw new Error("User not found");

    const newBalance = currentUser.creditsBalance + credits;

    await tx
      .update(users)
      .set({ creditsBalance: newBalance, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await tx
      .update(payments)
      .set({
        status: "paid",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        creditsGranted: credits,
        updatedAt: new Date(),
      })
      .where(eq(payments.razorpayOrderId, razorpay_order_id));

    await tx.insert(creditTransactions).values({
      userId: user.id,
      type: "purchase",
      amount: credits,
      balanceAfter: newBalance,
      description: `Credit purchase: ${credits} credits`,
      referenceId: razorpay_payment_id,
      metadata: { orderId: razorpay_order_id, paymentId: razorpay_payment_id },
    });
  });

  // Audit successful payment (critical — money touched)
  await auditInfo({
    userId: user.id,
    actorEmail: user.email,
    action: "billing.payment_verified",
    resource: "payment",
    resourceId: razorpay_payment_id,
    metadata: { credits, orderId: razorpay_order_id },
    severity: "critical",
    req,
  });

  return NextResponse.json({ success: true });
}

export const POST = withSentry(handler);
