# Task 3: Shared Utilities — Code Review

**Date:** 2026-03-17
**Commit:** `695fa21`
**Files created:** `packages/api/src/lib/cookie.ts`, `packages/api/src/lib/rate-limiter.ts`, `packages/api/src/lib/join-code.ts`, `packages/api/src/lib/settings.ts`, `packages/api/src/lib/queue-helpers.ts`

---

## Issues

### ISSUE-01: `queue-helpers.ts` imports from files that don't exist yet at this commit

**File:** `packages/api/src/lib/queue-helpers.ts:2-3`
**Severity:** MEDIUM
**Description:** `queue-helpers.ts` imports from `../sse/channel-manager` and `../music/index`, but these files are created in Task 5 (SSE) and Task 6 (Music) respectively. At commit `695fa21`, these imports resolve to non-existent modules. This means:
- TypeScript compilation fails at this commit
- `git bisect` through this range would give false positives
- CI would fail if run against this commit

This is a plan ordering issue — the plan puts `queue-helpers.ts` in Task 3 but its dependencies aren't available until Tasks 5-6.

**Recommendation:** For future plans, `queue-helpers.ts` should be created after its dependencies (Task 6+). For the current codebase, this resolves itself once Task 6 is committed and is not a blocking issue going forward. No action needed now.

---

### ISSUE-02: `RateLimiter.cleanupTimer` is stored but never used to clear the interval

**File:** `packages/api/src/lib/rate-limiter.ts:8`
**Severity:** LOW
**Description:** The `cleanupTimer` field stores the interval ID but the class has no `destroy()` or `dispose()` method to call `clearInterval`. Since `RateLimiter` instances are module-level singletons (created at import time, live for the process lifetime), this is not a memory leak — the interval is intentionally permanent. However, the stored `cleanupTimer` field is dead code.

**Recommendation:** Either remove the field (just call `setInterval` without storing it) or add a `destroy()` method for testability. Not urgent.

---

## Verification

- `cookie.ts`: Constant-time HMAC comparison using manual XOR loop. Uses `node:crypto`. Correct.
- `rate-limiter.ts`: Fixed-window rate limiter with sweep(). Matches updated plan.
- `join-code.ts`: 6-char code from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. Uses `Math.random()` — not cryptographically secure, but sufficient for short-lived join codes.
- `settings.ts`: Zod schema with `.parse()` and fallback to defaults. Correct.
- `queue-helpers.ts`: Transaction wraps mark+pick+update. Broadcast outside tx. Includes `suggestedBy` via Prisma `include`. All matches plan.

**Verdict:** Core utilities are correct. The import ordering issue is a plan-level problem, not a code bug — resolves once all tasks are committed.
