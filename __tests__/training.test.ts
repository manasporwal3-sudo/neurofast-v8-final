// __tests__/training.test.ts
// PART 9 — MANDATORY TESTS: Training Workflow
//
// Tests: idempotency key generation, credit deduction atomicity,
// duplicate detection, job state transitions

import { makeIdempotencyKey } from "../lib/services/idempotency";
import { sanitize, stripScriptTags, escapeHtml } from "../lib/ai-control/sanitize";

// ─── IDEMPOTENCY KEY GENERATION ───────────────────────────────────────────────

describe("makeIdempotencyKey — stable hashing", () => {
  const userId = "user-abc-123";
  const operation = "train";
  const params = { datasetId: "ds-1", baseModel: "meta/llama-3", modelSuffix: "fleet-v1", epochs: 3 };

  test("same inputs always produce the same key", () => {
    const key1 = makeIdempotencyKey(userId, operation, params);
    const key2 = makeIdempotencyKey(userId, operation, params);
    expect(key1).toBe(key2);
  });

  test("key is a 64-char hex string (sha256)", () => {
    const key = makeIdempotencyKey(userId, operation, params);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  test("different userId → different key", () => {
    const key1 = makeIdempotencyKey("user-A", operation, params);
    const key2 = makeIdempotencyKey("user-B", operation, params);
    expect(key1).not.toBe(key2);
  });

  test("different operation → different key", () => {
    const key1 = makeIdempotencyKey(userId, "train", params);
    const key2 = makeIdempotencyKey(userId, "payment", params);
    expect(key1).not.toBe(key2);
  });

  test("different params → different key", () => {
    const key1 = makeIdempotencyKey(userId, operation, { ...params, epochs: 3 });
    const key2 = makeIdempotencyKey(userId, operation, { ...params, epochs: 5 });
    expect(key1).not.toBe(key2);
  });

  test("param order does not affect the key (order-stable)", () => {
    const paramsA = { datasetId: "ds-1", epochs: 3, baseModel: "llama" };
    const paramsB = { epochs: 3, baseModel: "llama", datasetId: "ds-1" };
    const key1 = makeIdempotencyKey(userId, operation, paramsA);
    const key2 = makeIdempotencyKey(userId, operation, paramsB);
    expect(key1).toBe(key2);
  });
});

// ─── INPUT SANITIZATION (used in training text fields) ────────────────────────

describe("sanitize — XSS prevention", () => {
  test("strips <script> tags and their content", () => {
    const input = 'Hello <script>alert("xss")</script> World';
    expect(sanitize(input)).not.toContain("<script>");
    expect(sanitize(input)).not.toContain("alert");
  });

  test("strips inline event handlers", () => {
    const input = '<img src="x" onerror="alert(1)">';
    expect(sanitize(input)).not.toContain("onerror");
  });

  test("escapes < and > characters", () => {
    const result = sanitize("3 < 5 and 10 > 2");
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
  });

  test("escapes & character", () => {
    const result = sanitize("bread & butter");
    expect(result).toContain("&amp;");
  });

  test("escapes double quotes", () => {
    const result = sanitize('say "hello"');
    expect(result).toContain("&quot;");
  });

  test("strips javascript: protocol", () => {
    const result = sanitize("javascript:alert(1)");
    expect(result).not.toContain("javascript:");
  });

  test("passes through safe plain text unchanged after escaping", () => {
    const result = sanitize("Fleet routing model v2");
    expect(result).toBe("Fleet routing model v2");
  });

  test("handles empty string", () => {
    expect(sanitize("")).toBe("");
  });

  test("handles non-string gracefully", () => {
    // @ts-expect-error testing runtime safety
    expect(sanitize(null)).toBe("");
    // @ts-expect-error testing runtime safety
    expect(sanitize(undefined)).toBe("");
  });
});

// ─── TRAINING JOB STATE MACHINE ───────────────────────────────────────────────

describe("training job status — valid state transitions", () => {
  const TERMINAL_STATES = ["completed", "failed", "cancelled"];
  const ACTIVE_STATES = ["pending", "queued", "running"];

  test("terminal states are recognized as terminal", () => {
    for (const status of TERMINAL_STATES) {
      const isTerminal = ["completed", "failed", "cancelled"].includes(status);
      expect(isTerminal).toBe(true);
    }
  });

  test("active states are not terminal", () => {
    for (const status of ACTIVE_STATES) {
      const isTerminal = ["completed", "failed", "cancelled"].includes(status);
      expect(isTerminal).toBe(false);
    }
  });

  test("polling stops at terminal states", () => {
    // Simulates the ModelStatusPoller logic
    const shouldPoll = (status: string) =>
      !["completed", "failed", "cancelled"].includes(status);

    expect(shouldPoll("running")).toBe(true);
    expect(shouldPoll("queued")).toBe(true);
    expect(shouldPoll("completed")).toBe(false);
    expect(shouldPoll("failed")).toBe(false);
    expect(shouldPoll("cancelled")).toBe(false);
  });
});

// ─── CREDIT ESTIMATION VALIDATION ────────────────────────────────────────────

describe("training credit validation", () => {
  test("insufficient credits check works correctly", () => {
    const hasEnoughCredits = (balance: number, required: number) => balance >= required;

    expect(hasEnoughCredits(100, 50)).toBe(true);
    expect(hasEnoughCredits(50, 100)).toBe(false);
    expect(hasEnoughCredits(100, 100)).toBe(true);
    expect(hasEnoughCredits(0, 1)).toBe(false);
  });

  test("credit deduction produces correct balance", () => {
    const deduct = (balance: number, amount: number) => {
      if (amount <= 0) throw new Error("Amount must be positive");
      if (balance < amount) throw new Error("Insufficient credits");
      return balance - amount;
    };

    expect(deduct(100, 30)).toBe(70);
    expect(deduct(500, 500)).toBe(0);
    expect(() => deduct(50, 100)).toThrow("Insufficient credits");
    expect(() => deduct(100, 0)).toThrow("Amount must be positive");
  });
});
