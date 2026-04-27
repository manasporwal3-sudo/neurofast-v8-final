# NeuroFast v8 — Bug Fix & Completion Release

**Date:** 2025-01-11  
**Type:** Production Hardening — Bug Fixes + Remaining Feature Completion  
**Zero breaking changes — all fixes are backwards compatible**

---

## 🐛 Bug Fixes (15 fixes)

### Fix 1 — `package.json` version mismatch
- **File:** `package.json`
- **Problem:** Version was `5.0.0` even though codebase was v7
- **Fix:** Bumped to `7.0.0`

### Fix 2 — Missing `ANTHROPIC_API_KEY` in `.env.example`
- **File:** `.env.example`
- **Problem:** The AI Brain route calls Anthropic API but the env var was not documented
- **Fix:** Added `ANTHROPIC_API_KEY=sk-ant-...` to `.env.example`

### Fix 3 — Prompt length mismatch between guard and route
- **File:** `app/api/admin/ai-brain/route.ts`
- **Problem:** `parseHandler` rejected prompts > 500 chars, but `promptGuard` allows up to 800
- **Fix:** Aligned route limit to 800 to match `promptGuard.ts`

### Fix 4 — Missing Anthropic API auth headers (CRITICAL)
- **File:** `app/api/admin/ai-brain/route.ts`
- **Problem:** Claude API fetch was missing `x-api-key` and `anthropic-version` headers — every call returned 401
- **Fix:** Added `"x-api-key": process.env.ANTHROPIC_API_KEY` and `"anthropic-version": "2023-06-01"` to headers

### Fix 5 — `warnings` field stripped by Zod schema
- **File:** `lib/schemas/index.ts`
- **Problem:** `ParsedIntentSchema` had no `warnings` field, so Claude's `warnings` array was silently dropped by `safeParse`
- **Fix:** Added `warnings: z.array(z.string()).optional().default([])` to schema

### Fix 6 — Admin layout active nav broken (always shows no active)
- **File:** `middleware.ts`
- **Problem:** `app/admin/layout.tsx` reads `x-pathname` from headers to highlight active nav, but middleware never set it
- **Fix:** Added `response.headers.set("x-pathname", req.nextUrl.pathname)` to middleware

### Fix 7 — Wrong audit action on rollback
- **File:** `app/api/admin/rollback/route.ts`
- **Problem:** Rollback POST used `action: "admin.config_update"` — incorrect, makes it indistinguishable from config saves
- **Fix:** Changed to `action: "admin.rollback_executed"` (already defined in AuditAction type)

### Fix 8 — Role change audit severity never reaches DB
- **File:** `app/api/admin/users/route.ts`
- **Problem:** `auditInfo()` always sets severity to `"info"`, ignoring the `severity: "critical"` passed in
- **Fix:** Changed to `auditCritical()` which correctly persists `severity: "critical"`

### Fix 9 — Wrong audit action for credit adjustments
- **File:** `app/api/admin/users/route.ts`
- **Problem:** Credit adjustment audit used `action: "admin.config_update"` — wrong category
- **Fix:** Changed to `action: "admin.user_role_change"` (reused for all user mutations) + added `invalidateDashboard(userId)` call after credit change so user sees updated balance immediately

### Fix 10 — Double `JSON.stringify` on jsonb column (CRITICAL DATA BUG)
- **File:** `lib/services/config.ts`
- **Problem:** `setConfig()` called `JSON.stringify(value)` before inserting into a `jsonb` column. Drizzle-ORM already handles JS→JSON for jsonb. This caused boolean `true` to be stored as `'"true"'` (string), breaking all feature flag reads
- **Fix:** Removed `JSON.stringify()` wrapper — pass raw JS value to Drizzle

### Fix 11 — `next.config.js` empty string in `allowedOrigins`
- **File:** `next.config.js`
- **Problem:** When `NEXT_PUBLIC_APP_URL` is not set, an empty string `""` was added to `allowedOrigins`, which could allow unexpected origins in some Next.js versions
- **Fix:** Added `.filter(Boolean)` to remove empty strings

### Fix 12 — `DATABASE_URL` missing gives cryptic postgres error
- **File:** `lib/db/index.ts`
- **Problem:** Missing `DATABASE_URL` caused an unreadable postgres internal error
- **Fix:** Added explicit guard with clear message: `"DATABASE_URL environment variable is not set"`. Also removed `!` non-null assertion.

### Fix 13 — Supabase non-null assertions fail silently in production
- **File:** `lib/supabase.ts`
- **Problem:** `process.env.SUPABASE_URL!` crashes with non-descriptive error if env var missing
- **Fix:** Replaced all `!` assertions with explicit guards and clear error messages

### Fix 14 — `void-black` Tailwind color used but undefined
- **File:** `tailwind.config.js`
- **Problem:** `app/layout.tsx` uses `bg-void-black` but `void.black` was not in Tailwind config — fallback to transparent in production builds
- **Fix:** Added `void: { black: "#0a0a0a", ... }` to config

### Fix 15 — Google Fonts `@import` missing from `globals.css`
- **File:** `app/globals.css`
- **Problem:** `globals.css` references Orbitron, Rajdhani, JetBrains Mono in CSS rules but had no `@import`. Fonts only loaded if `<head>` links were present. Added `@import` as backup/fallback.
- **Fix:** Added `@import url('https://fonts.googleapis.com/...')` as first line

---

## ✅ Remaining Features Implemented (from PDF roadmap)

### Feature 1 — Demo analytics tracking endpoint
- **File:** `app/api/demo/track/route.ts` *(NEW)*
- Tracks: `demo_started`, `chat_message_sent`, `train_step_viewed`, `conversion_modal_shown`, `signup_cta_clicked`
- Rate limited (20 events/hour per IP), non-blocking write, stores in `audit_logs`

### Feature 2 — Demo banner in app TopBar
- **File:** `components/layout/TopBar.tsx`
- Added `isDemo?: boolean` prop — when true, shows yellow banner: "DEMO MODE — Data is simulated"
- Includes link to `/sign-up` conversion CTA

---

## ⚠️ Known Remaining Items (v9 scope)

These were identified as remaining but are **non-blocking for launch**:

1. **Admin notifications component** — Real-time bell icon with push notifications. Marked as non-critical. The notification store from v6 (`lib/notifications/store.ts`) needs wiring to a persistent backend (Supabase Realtime or polling endpoint).

2. **Rate limits from DB config** — Currently `ratelimit.ts` uses hardcoded values (10 chat/min, 3 train/min). These match the v6 spec but are not dynamically read from `system_config`. Adding dynamic rate limits requires replacing the module-level singleton pattern with per-request config reads.

3. **`updatedAt` auto-refresh on users** — Several `db.update(users)` calls in `rollback.ts` set `updatedAt: new Date()` but the schema lacks a DB-level trigger. This is fine but means the app is responsible for keeping it fresh.

---

## 📊 v8 Summary

| Category | Count |
|----------|-------|
| Bug fixes | 15 |
| New features | 2 |
| Files modified | 14 |
| Files created | 1 |
| Breaking changes | 0 |
