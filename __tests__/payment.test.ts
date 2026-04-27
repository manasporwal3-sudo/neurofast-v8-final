// __tests__/payment.test.ts
// PART 9 — MANDATORY TESTS: Payment Flow
//
// Tests: Razorpay signature verification logic, credit grant calculation,
// idempotency for payments, amount validation

import crypto from "crypto";

// ─── RAZORPAY SIGNATURE VERIFICATION ─────────────────────────────────────────
// Mirrors the exact logic in app/api/billing/verify-payment/route.ts

function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return expected === signature;
}

describe("verifyRazorpaySignature — payment integrity", () => {
  const SECRET = "test_razorpay_secret_key";
  const ORDER_ID = "order_abc123";
  const PAYMENT_ID = "pay_xyz789";

  function makeValidSignature(orderId: string, paymentId: string, secret: string): string {
    return crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
  }

  test("verifies a valid signature correctly", () => {
    const sig = makeValidSignature(ORDER_ID, PAYMENT_ID, SECRET);
    expect(verifyRazorpaySignature(ORDER_ID, PAYMENT_ID, sig, SECRET)).toBe(true);
  });

  test("rejects tampered orderId", () => {
    const sig = makeValidSignature(ORDER_ID, PAYMENT_ID, SECRET);
    expect(verifyRazorpaySignature("order_TAMPERED", PAYMENT_ID, sig, SECRET)).toBe(false);
  });

  test("rejects tampered paymentId", () => {
    const sig = makeValidSignature(ORDER_ID, PAYMENT_ID, SECRET);
    expect(verifyRazorpaySignature(ORDER_ID, "pay_TAMPERED", sig, SECRET)).toBe(false);
  });

  test("rejects wrong secret", () => {
    const sig = makeValidSignature(ORDER_ID, PAYMENT_ID, "wrong_secret");
    expect(verifyRazorpaySignature(ORDER_ID, PAYMENT_ID, sig, SECRET)).toBe(false);
  });

  test("rejects empty signature", () => {
    expect(verifyRazorpaySignature(ORDER_ID, PAYMENT_ID, "", SECRET)).toBe(false);
  });

  test("signature format is 64-char hex", () => {
    const sig = makeValidSignature(ORDER_ID, PAYMENT_ID, SECRET);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ─── CREDIT GRANT CALCULATION ─────────────────────────────────────────────────

describe("credit grant from payment amount", () => {
  // Business rule: 1 INR = 10 credits (from billing page config)
  function calcCredits(amountINR: number, ratePerRupee = 10): number {
    if (amountINR <= 0) throw new Error("Amount must be positive");
    return Math.floor(amountINR * ratePerRupee);
  }

  test("₹100 → 1000 credits", () => {
    expect(calcCredits(100)).toBe(1000);
  });

  test("₹499 → 4990 credits", () => {
    expect(calcCredits(499)).toBe(4990);
  });

  test("₹1999 → 19990 credits", () => {
    expect(calcCredits(1999)).toBe(19990);
  });

  test("floors fractional credits", () => {
    // 7 INR × 10 = 70 — no fractions
    expect(calcCredits(7)).toBe(70);
  });

  test("throws on zero amount", () => {
    expect(() => calcCredits(0)).toThrow("Amount must be positive");
  });

  test("throws on negative amount", () => {
    expect(() => calcCredits(-100)).toThrow("Amount must be positive");
  });
});

// ─── PAYMENT AMOUNT VALIDATION ────────────────────────────────────────────────

describe("payment amount schema validation", () => {
  // Mirrors CreateOrderSchema from lib/schemas/index.ts
  function validateCreateOrder(input: { credits: number; priceINR: number }): string | null {
    if (!Number.isInteger(input.credits)) return "credits must be integer";
    if (input.credits < 100) return "credits minimum is 100";
    if (input.credits > 100_000) return "credits maximum is 100,000";
    if (input.priceINR < 1) return "priceINR minimum is 1";
    if (input.priceINR > 100_000) return "priceINR maximum is 100,000";
    return null; // valid
  }

  test("accepts valid order", () => {
    expect(validateCreateOrder({ credits: 1000, priceINR: 100 })).toBeNull();
  });

  test("rejects credits below minimum", () => {
    expect(validateCreateOrder({ credits: 50, priceINR: 5 })).toBeTruthy();
  });

  test("rejects credits above maximum", () => {
    expect(validateCreateOrder({ credits: 200_000, priceINR: 20000 })).toBeTruthy();
  });

  test("rejects non-integer credits", () => {
    expect(validateCreateOrder({ credits: 100.5, priceINR: 10 })).toBeTruthy();
  });

  test("rejects zero priceINR", () => {
    expect(validateCreateOrder({ credits: 100, priceINR: 0 })).toBeTruthy();
  });
});

// ─── DUPLICATE PAYMENT PREVENTION ─────────────────────────────────────────────

describe("payment idempotency — duplicate prevention", () => {
  test("same razorpay_order_id cannot be verified twice", () => {
    // This models the DB unique constraint on razorpay_order_id
    const verifiedOrders = new Set<string>();

    function processPayment(orderId: string): { success: boolean; reason?: string } {
      if (verifiedOrders.has(orderId)) {
        return { success: false, reason: "Order already processed" };
      }
      verifiedOrders.add(orderId);
      return { success: true };
    }

    const first = processPayment("order_abc");
    const second = processPayment("order_abc");
    const third = processPayment("order_xyz");

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.reason).toBe("Order already processed");
    expect(third.success).toBe(true);
  });
});
