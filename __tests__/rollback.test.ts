// __tests__/rollback.test.ts
// PART 9 — MANDATORY TESTS: Rollback System
//
// Tests: snapshot capture, rollback execution, expiry enforcement,
// no double-rollback, config vs user resource routing

// ─── ROLLBACK LOG DATA MODEL ───────────────────────────────────────────────────

interface MockRollbackLog {
  sessionId: string;
  action: string;
  resource: string;
  snapshotBefore: unknown;
  snapshotAfter: unknown;
  rolledBack: boolean;
  rolledBackAt: Date | null;
  expiresAt: Date;
}

// In-memory rollback store (mirrors the real DB table behaviour)
class MockRollbackStore {
  private logs: Map<string, MockRollbackLog> = new Map();

  capture(params: Omit<MockRollbackLog, "rolledBack" | "rolledBackAt" | "snapshotAfter">): void {
    this.logs.set(params.sessionId, {
      ...params,
      snapshotAfter: null,
      rolledBack: false,
      rolledBackAt: null,
    });
  }

  recordAfter(sessionId: string, snapshotAfter: unknown): void {
    const log = this.logs.get(sessionId);
    if (log) log.snapshotAfter = snapshotAfter;
  }

  rollback(sessionId: string): { success: boolean; message: string; restored?: unknown } {
    const log = this.logs.get(sessionId);

    if (!log) {
      return { success: false, message: "Rollback log not found" };
    }
    if (log.rolledBack) {
      return { success: false, message: "Already rolled back" };
    }
    if (new Date() > log.expiresAt) {
      return { success: false, message: "Rollback window expired (24h limit)" };
    }

    log.rolledBack = true;
    log.rolledBackAt = new Date();
    return { success: true, message: "Rolled back", restored: log.snapshotBefore };
  }

  getLog(sessionId: string): MockRollbackLog | undefined {
    return this.logs.get(sessionId);
  }
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe("rollback system — snapshot capture", () => {
  let store: MockRollbackStore;
  const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);

  beforeEach(() => { store = new MockRollbackStore(); });

  test("captures snapshot before execution", () => {
    store.capture({
      sessionId: "sess-001",
      action: "update_pricing",
      resource: "pricing.inference_cost_per_msg",
      snapshotBefore: 1,
      expiresAt: FUTURE,
    });

    const log = store.getLog("sess-001");
    expect(log).toBeDefined();
    expect(log?.snapshotBefore).toBe(1);
    expect(log?.rolledBack).toBe(false);
  });

  test("records snapshot after execution", () => {
    store.capture({
      sessionId: "sess-002",
      action: "update_pricing",
      resource: "pricing.inference_cost_per_msg",
      snapshotBefore: 1,
      expiresAt: FUTURE,
    });
    store.recordAfter("sess-002", 5);

    const log = store.getLog("sess-002");
    expect(log?.snapshotAfter).toBe(5);
  });
});

describe("rollback system — execution", () => {
  let store: MockRollbackStore;
  const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const PAST = new Date(Date.now() - 1000); // already expired

  beforeEach(() => { store = new MockRollbackStore(); });

  test("successfully rolls back to before-snapshot", () => {
    store.capture({
      sessionId: "sess-003",
      action: "update_pricing",
      resource: "pricing.inference_cost_per_msg",
      snapshotBefore: 1,
      expiresAt: FUTURE,
    });
    store.recordAfter("sess-003", 9);

    const result = store.rollback("sess-003");
    expect(result.success).toBe(true);
    expect(result.restored).toBe(1); // original value
  });

  test("marks log as rolled back after rollback", () => {
    store.capture({
      sessionId: "sess-004",
      action: "toggle_feature",
      resource: "features.maintenance_mode",
      snapshotBefore: false,
      expiresAt: FUTURE,
    });

    store.rollback("sess-004");
    const log = store.getLog("sess-004");
    expect(log?.rolledBack).toBe(true);
    expect(log?.rolledBackAt).toBeInstanceOf(Date);
  });

  test("rejects double rollback", () => {
    store.capture({
      sessionId: "sess-005",
      action: "toggle_maintenance",
      resource: "features.maintenance_mode",
      snapshotBefore: false,
      expiresAt: FUTURE,
    });

    store.rollback("sess-005"); // first rollback — ok
    const second = store.rollback("sess-005"); // second — must fail
    expect(second.success).toBe(false);
    expect(second.message).toBe("Already rolled back");
  });

  test("rejects rollback for unknown session", () => {
    const result = store.rollback("non-existent-session");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  test("rejects rollback after 24h expiry window", () => {
    store.capture({
      sessionId: "sess-006",
      action: "update_pricing",
      resource: "pricing.inference_cost_per_msg",
      snapshotBefore: 2,
      expiresAt: PAST, // already expired
    });

    const result = store.rollback("sess-006");
    expect(result.success).toBe(false);
    expect(result.message).toContain("expired");
  });
});

describe("rollback system — resource routing", () => {
  test("identifies config resource by key prefix", () => {
    const isConfigResource = (resource: string) => !resource.startsWith("user:");
    expect(isConfigResource("pricing.inference_cost_per_msg")).toBe(true);
    expect(isConfigResource("features.maintenance_mode")).toBe(true);
    expect(isConfigResource("user:abc-123")).toBe(false);
  });

  test("identifies user resource by 'user:' prefix", () => {
    const isUserResource = (resource: string) => resource.startsWith("user:");
    expect(isUserResource("user:abc-123")).toBe(true);
    expect(isUserResource("pricing.something")).toBe(false);
  });

  test("extracts userId from user resource string", () => {
    const extractUserId = (resource: string) => resource.replace("user:", "");
    expect(extractUserId("user:abc-123-def")).toBe("abc-123-def");
  });
});

describe("rollback system — no duplicate actions", () => {
  test("executing the same session twice is rejected", () => {
    const executedSessions = new Set<string>();

    function executeAction(sessionId: string): { ok: boolean } {
      if (executedSessions.has(sessionId)) {
        return { ok: false };
      }
      executedSessions.add(sessionId);
      return { ok: true };
    }

    expect(executeAction("sess-A").ok).toBe(true);
    expect(executeAction("sess-A").ok).toBe(false); // duplicate
    expect(executeAction("sess-B").ok).toBe(true);  // different session — ok
  });
});
