# NeuroFast v5 — Full Upgrade Changelog

## Summary
v5 is a hardening, safety, and reliability upgrade. Zero breaking changes. All existing logic preserved.

---

## PART 1 — AI CONTROL BRAIN (SAFE + DETERMINISTIC)

### STEP 1: Fallback Parser
**File:** `lib/ai-control/fallbackParser.ts` *(NEW)*
- Created deterministic keyword-based parser
- Maps: `price` → `update_pricing`, `enable/disable` → `toggle_feature`, `maintenance` → `toggle_maintenance`
- If no pattern matches → returns `{ success: false, error: "Command not recognized..." }` — never guesses
- Called in `app/api/admin/ai-brain/route.ts` when: (a) Claude API is unreachable, (b) Claude returns invalid JSON, (c) confidence < 0.7

### STEP 2: Confidence Enforcement
**File:** `app/api/admin/ai-brain/route.ts` *(MODIFIED)*
- Existing `confidence < 0.7` gate now first tries fallback parser before returning error
- If fallback parser succeeds → returns intent with `source: "fallback_parser"` + warning
- If fallback also fails → returns `{ success: false, error: "..." }` — never executes

### STEP 3: Prompt Injection Protection
**File:** `lib/ai-control/promptGuard.ts` *(NEW)*
- Checks 10 injection patterns: `ignore previous instructions`, `bypass`, `override system`, `give admin access`, `jailbreak`, `sudo`, etc.
- Called as **first check** in `parseHandler` before any AI API call
- Returns `{ safe: false, reason: "Unsafe command detected" }` on match → route returns 400 immediately
- Case-insensitive matching

### STEP 4: Strict Action Validation
**File:** `lib/schemas/index.ts` *(UNCHANGED — already had Zod)*
- `ParsedIntentSchema` and `ExecuteIntentSchema` already validate all fields with Zod
- `ExecuteIntentSchema` requires `adminConfirmed: true` literal — rejects unknown fields
- No change needed — already complete

### STEP 5: Safe Execution Engine
**File:** `app/api/admin/ai-brain/route.ts` *(UNCHANGED — already implemented)*
- Sequence: validate → check admin role → capture snapshot → execute → save state → audit log
- Already in place from v4

### STEP 6: Multi-Step Execution Handling
**File:** `app/api/admin/ai-brain/route.ts` *(UNCHANGED — already implemented)*
- Sequential execution with stop-on-fail already in `multiExecuteHandler`
- Rollback suggestion already returned on partial failure

---

## PART 2 — DATABASE HARDENING

### STEP 1: Add Indexes
**File:** `lib/db/schema.ts` *(MODIFIED)*
- Added `createdAtIdx: index("jobs_created_at_idx").on(t.createdAt)` to `trainingJobs`
- Existing indexes already present: `users(userId)`, `jobs(status)`, `jobs(togetherJobId)`
- **Why:** Dashboard query uses `ORDER BY createdAt DESC` — index prevents full table scan

### STEP 2: Data Consistency / Transactions
**File:** `app/api/admin/ai-brain/route.ts` *(UNCHANGED — already implemented)*
- `add_credits` case already uses `db.transaction()` — credit deduction + transaction log are atomic
- `app/api/train/route.ts` queue path already uses `db.transaction()` for credit deduction

---

## PART 3 — CACHING

### STEP 1 & 2: Redis Cache Implementation
**File:** `lib/cache/redis.ts` *(NEW)*
- Wraps Upstash Redis (same credentials already in `.env`)
- Keys: `config:{key}` (TTL 60s), `dashboard:{userId}` (TTL 30s)
- Graceful degradation: returns `null` if Redis unavailable — caller falls through to DB

### STEP 3: Cache Invalidation
**File:** `lib/services/config.ts` *(MODIFIED)*
- Replaced in-memory `Map` cache (process-local, lost on cold start, not shared across instances) with Redis cache
- `getConfig()` → checks Redis first → DB on miss → writes to Redis
- `setConfig()` → writes DB → calls `invalidateConfig(key)` to bust Redis

**File:** `app/api/dashboard/route.ts` *(MODIFIED)*
- `GET /api/dashboard` now checks `getCachedDashboard(userId)` first (30s TTL)
- On DB fetch → stores result with `cacheDashboard(userId, data)`
- Response format standardized: `{ success, data, error, meta: { cached } }`

**File:** `app/api/train/route.ts` *(MODIFIED)*
- Both direct path and queue path call `invalidateDashboard(userId)` after job creation
- Ensures new job appears immediately on dashboard refresh

**File:** `app/api/admin/ai-brain/route.ts` *(MODIFIED)*
- `add_credits` execution calls `invalidateDashboard(userId)` after crediting
- User sees updated balance immediately

---

## PART 4 — POLLING OPTIMIZATION

**File:** `components/models/ModelStatusPoller.tsx` *(MODIFIED)*
- **Before:** Fixed 8s interval, slows to 20s after 3 errors
- **After (v5):**
  - Polls 1–3: every **5 seconds** (fast feedback on job start)
  - Polls 4+: every **15 seconds** (reduces server load)
  - 3+ consecutive errors: **20 seconds**
  - After **20 total polls** with no terminal state: **stops automatically**
  - After **5 consecutive errors**: **stops automatically**
  - Added **POLLING STOPPED** badge + **RETRY** button in UI
- **Why:** Reduces server load by ~47% (15s vs 8s), prevents infinite polling for stuck jobs

---

## PART 5 — API STANDARDIZATION

**File:** `lib/api-response.ts` *(NEW)*
- Helper functions: `apiOk()`, `apiCreated()`, `apiError()`, `apiUnauthorized()`, `apiForbidden()`, `apiNotFound()`, `apiConflict()`, `apiRateLimit()`, `apiMaintenance()`, `apiUpstreamError()`
- Standard shape: `{ success: boolean, data: T | null, error: string | null, meta?: object }`
- **File:** `app/api/dashboard/route.ts` — updated to return standardized format

---

## PART 6 — WORKER RELIABILITY

**File:** `lib/queue/definitions.ts` *(MODIFIED)*
- Changed backoff delay from `120_000ms (2 min)` to `2_000ms (2 sec)` with exponential
- Sequence: attempt 1 immediately → attempt 2 after 2s → attempt 3 after 4s
- After 3 failures → worker calls `moveToDLQ()` — already implemented
- **Why:** 2-minute initial delay was too slow for transient network errors; 2s is more responsive

---

## PART 7 — SECURITY

### Input Sanitization
**File:** `lib/ai-control/sanitize.ts` *(NEW)*
- `stripScriptTags()` — removes `<script>`, `<iframe>`, `<object>`, `<embed>`, inline `on*` handlers, `javascript:` protocol
- `escapeHtml()` — escapes `& < > " '` to HTML entities
- `sanitize()` — combines both: strip then escape
- `sanitizeObject()` — recursively sanitizes all string fields in an object

**File:** `app/api/chat/[modelId]/route.ts` *(MODIFIED)*
- User messages sanitized with `sanitize()` before being sent to Together AI
- System prompt (from model config) is not sanitized — it's admin-controlled, not user input

### Access Control
**File:** `lib/services/rbac.ts` *(UNCHANGED — already complete)*
- `requireAdmin()` + `isAdminUser()` guards on all admin routes
- Role hierarchy: `user(0) < admin(1) < superadmin(2)`

---

## PART 8 — FRONTEND IMPROVEMENTS

### State Management
- React Query not installed — existing `useState` + `useCallback` pattern is sufficient for this app's data needs
- `ModelStatusPoller.tsx` polling improvements (Part 4) handle the main UX concern

### UX Improvements
**File:** `components/models/ModelStatusPoller.tsx` *(MODIFIED)*
- Added `POLLING STOPPED` orange badge when polling halts
- Added `RETRY` button to resume polling manually
- Existing loading states, error toasts, and cancel button preserved

---

## PART 9 — TESTING

**Files:** `__tests__/ai-parsing.test.ts`, `__tests__/training.test.ts`, `__tests__/payment.test.ts`, `__tests__/rollback.test.ts` *(ALL NEW)*

### ai-parsing.test.ts
- `guardPrompt` — 9 tests covering safe prompts, all injection patterns, case-insensitivity, length limit
- `runFallbackParser` — 9 tests covering feature toggles, maintenance, pricing, no-match error, injection in fallback, source tag

### training.test.ts
- `makeIdempotencyKey` — 6 tests: same inputs = same key, hex format, userId/operation/param differentiation, order-stability
- `sanitize` — 9 tests: script tags, event handlers, `<>&"'` escaping, `javascript:`, empty, non-string inputs
- Job state machine — 3 tests: terminal/active state classification, polling stop logic
- Credit validation — 2 tests: insufficient check, deduction math

### payment.test.ts
- Razorpay signature — 6 tests: valid sig, tampered orderId/paymentId, wrong secret, empty sig, format
- Credit grant calculation — 6 tests: standard amounts, floor rounding, zero/negative rejection
- Amount validation — 5 tests: valid order, min/max credits, non-integer, zero price
- Duplicate prevention — 1 test: same orderId rejected on second verification

### rollback.test.ts
- Snapshot capture — 2 tests: captures before value, records after value
- Rollback execution — 5 tests: successful restore, marks as rolled back, rejects double-rollback, unknown session, expired window
- Resource routing — 3 tests: config vs user resource identification, userId extraction
- No duplicate actions — 1 test: same session rejected on re-execution

**File:** `package.json` *(MODIFIED)*
- Added `jest`, `ts-jest`, `@types/jest` to devDependencies
- Added `"test"`, `"test:watch"`, `"test:coverage"` scripts
- Added `"jest"` config block with `ts-jest` preset, path alias support

---

## Files Changed Summary

| File | Status | Part |
|------|--------|------|
| `lib/ai-control/fallbackParser.ts` | NEW | 1 |
| `lib/ai-control/promptGuard.ts` | NEW | 1 |
| `lib/ai-control/sanitize.ts` | NEW | 7 |
| `lib/cache/redis.ts` | NEW | 3 |
| `lib/api-response.ts` | NEW | 5 |
| `__tests__/ai-parsing.test.ts` | NEW | 9 |
| `__tests__/training.test.ts` | NEW | 9 |
| `__tests__/payment.test.ts` | NEW | 9 |
| `__tests__/rollback.test.ts` | NEW | 9 |
| `lib/services/config.ts` | MODIFIED | 3 |
| `lib/db/schema.ts` | MODIFIED | 2 |
| `lib/queue/definitions.ts` | MODIFIED | 6 |
| `app/api/admin/ai-brain/route.ts` | MODIFIED | 1, 3 |
| `app/api/dashboard/route.ts` | MODIFIED | 3, 5 |
| `app/api/train/route.ts` | MODIFIED | 3 |
| `app/api/chat/[modelId]/route.ts` | MODIFIED | 7 |
| `components/models/ModelStatusPoller.tsx` | MODIFIED | 4, 8 |
| `package.json` | MODIFIED | 9 |

## Files NOT Changed (already correct in v4)
- `lib/services/rollback.ts` — snapshot/restore already complete
- `lib/services/rbac.ts` — admin guards already complete
- `lib/services/audit.ts` — audit logging already complete
- `lib/services/idempotency.ts` — idempotency already complete
- `lib/services/ratelimit.ts` — rate limiting already complete
- `lib/schemas/index.ts` — Zod validation already complete
- `lib/queue/client.ts` — DLQ already implemented
- `lib/queue/worker.ts` — retry/DLQ already implemented
- `lib/db/schema.ts` — all other indexes already present
- All admin pages and other API routes — no issues found
