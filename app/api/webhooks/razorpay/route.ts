// app/api/webhooks/razorpay/route.ts
// Razorpay webhook endpoint for server-side payment confirmation
// This is a backup to the client-side verification — handles edge cases

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments, users, creditTransactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createHmac } from "crypto";

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        status: string;
      };
    };
  };
}

function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET!;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    // Verify webhook authenticity
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body) as RazorpayWebhookPayload;

    if (event.event === "payment.captured") {
      const payment = event.payload.payment?.entity;
      if (!payment) return NextResponse.json({ ok: true });

      const { id: paymentId, order_id: orderId } = payment;

      // Find the pending payment record
      const [pendingPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.razorpayOrderId, orderId));

      if (!pendingPayment || pendingPayment.status === "paid") {
        // Already processed or not found
        return NextResponse.json({ ok: true });
      }

      const credits = pendingPayment.creditsGranted;

      await db.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, pendingPayment.userId));

        if (!user) return;

        const newBalance = user.creditsBalance + credits;

        await tx
          .update(users)
          .set({ creditsBalance: newBalance })
          .where(eq(users.id, user.id));

        await tx
          .update(payments)
          .set({
            status: "paid",
            razorpayPaymentId: paymentId,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, pendingPayment.id));

        await tx.insert(creditTransactions).values({
          userId: user.id,
          type: "purchase",
          amount: credits,
          balanceAfter: newBalance,
          description: `Webhook: ${credits} credits added via Razorpay`,
          referenceId: paymentId,
        });
      });
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment?.entity;
      if (!payment) return NextResponse.json({ ok: true });

      await db
        .update(payments)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(payments.razorpayOrderId, payment.order_id));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Razorpay webhook]", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
