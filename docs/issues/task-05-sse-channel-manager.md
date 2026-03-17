# Task 5: SSE Channel Manager — Code Review

**Date:** 2026-03-17
**Commit:** `0a98f7a`
**Files created:** `packages/api/src/sse/types.ts`, `packages/api/src/sse/channel-manager.ts`, `apps/web/src/app/api/sse/[sessionId]/route.ts`

---

## Issues

### ISSUE-01: SSE route calls `auth.api.getSession()` even when guest cookie already authorizes

**File:** `apps/web/src/app/api/sse/[sessionId]/route.ts:32`
**Severity:** LOW
**Description:** The auth check does guest cookie verification first (lines 36-44), then unconditionally calls `auth.api.getSession()` (line 32) — but `getSession()` is called on line 32 BEFORE the guest check on line 36. Both execute every time regardless of which succeeds. The `auth.api.getSession()` call likely involves a DB query to validate the auth session.

The code structure is:
```
const guestCookie = ...    // cheap: reads cookie
const authSession = ...    // expensive: DB query
if (guestCookie) { ... }   // check guest first
if (!authorized && authSession) { ... }  // fallback to owner
```

Both DB operations run in parallel (they're both awaited at declaration). For guests (the majority of SSE connections), the `auth.api.getSession()` call is wasted.

**Recommendation:** Check guest cookie first, only call `auth.api.getSession()` if guest auth fails. This is a performance optimization, not a correctness issue. Fine for MVP.

---

### ISSUE-02: `Connection: keep-alive` header is redundant for HTTP/2

**File:** `apps/web/src/app/api/sse/[sessionId]/route.ts:103`
**Severity:** INFO
**Description:** The `Connection: keep-alive` response header is an HTTP/1.1 concept. Under HTTP/2 (which Next.js dev server and most production deployments use), this header is ignored. Not harmful, just unnecessary.

---

## Verification

- `types.ts`: `QueuedSong` interface and `SSEEvent` discriminated union with 6 event types. Matches plan and spec.
- `channel-manager.ts`: `SSEChannelManager` class with subscribe/unsubscribe/broadcast/getListenerCount. `globalThis` singleton pattern for HMR survival. Broadcast catches write errors and removes dead writers. Correct.
- SSE route:
  - `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"` — required for long-lived connections. Present.
  - `params` is `Promise<{ sessionId: string }>` with `await params` — Next.js 16 async params pattern. Correct.
  - Session existence + `isActive` check before auth. Returns 404/410 appropriately.
  - Heartbeat every 30 seconds. Cleanup on `req.signal` abort event. Correct lifecycle management.

**Verdict:** Solid implementation. The auth ordering is a minor perf concern but not a bug.
