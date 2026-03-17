# Task 10: Frontend Hooks — Code Review

**Date:** 2026-03-17
**Commit:** `e4bfaa3`
**Files created:** `apps/web/src/hooks/use-session-events.ts`, `apps/web/src/hooks/use-guest.ts`

---

## Issues

### ISSUE-01: `QueuedSong` type is duplicated — defined in both SSE types and this hook

**File:** `apps/web/src/hooks/use-session-events.ts:5-17`
**Severity:** LOW
**Description:** The `QueuedSong` interface is defined identically in `packages/api/src/sse/types.ts` and here in the hook. If the SSE type evolves (e.g., a new field is added), the hook's local copy will be stale and the handler callbacks will have an incomplete type.

**Recommendation:** Import from the shared package: `import type { QueuedSong } from "@crowd-vibe/api/sse/types"`. The `@crowd-vibe/api` package already exports `./sse/*` paths.

---

## Improvements Over Plan

1. **`safeParse` wrapper around `JSON.parse`** — the plan used bare `JSON.parse(e.data)` which would throw on malformed SSE data. The implementation wraps it in a try/catch and validates the shape before calling handlers. Good defensive coding.

2. **`onReconnect` handler** — the plan didn't include reconnection handling. The implementation adds an `onerror` handler that checks `EventSource.CONNECTING` state and notifies via `onReconnect` callback, so consumers can refetch full queue state after a reconnection. Matches the spec's requirement: "On reconnect, fetches full queue state via queue.list to catch up on missed events."

3. **Shape validation before calling handlers** — each event listener checks `typeof data === "object" && "songId" in data` (or similar) before casting. This prevents runtime errors if the server sends unexpected data.

---

## Verification

- `use-session-events.ts`: `"use client"` directive present. `useRef` for handlers (avoids stale closure). `useEffect` cleanup calls `eventSource.close()`. Dependency array is `[sessionId]`. All correct.
- `use-guest.ts`: `"use client"` directive present. Loads FingerprintJS, calls join API with credentials, handles errors. `useCallback` with empty deps. Correct.
- `use-guest.ts`: `credentials: "include"` on fetch ensures the `cv_guest` cookie is sent back on subsequent requests. Correct.

**Verdict:** Clean commit with three solid improvements over the plan. The type duplication is minor and non-blocking.
