# UI-BREAKING-002: Owner Dashboard Queue, Stats, and Now-Playing Queries Have No Error Handling

**Severity:** P1 — HIGH  
**Area:** UI / Owner Dashboard  
**File:** `apps/web/src/components/venue/session-dashboard.tsx` (lines 44–48)

---

## Problem

Three critical queries have no `.isError` checks and no user-visible error messages:

- `queue` (line 44) — on failure, renders an empty queue silently
- `nowPlaying` (lines 45–47) — on failure, shows "No song playing" as if nothing is queued
- `stats` (line 48) — on failure, shows "0 listeners, 0 played" as if the session is dead

The global `QueryCache.onError` in `utils/trpc.ts` shows a toast after the error hits, but while a query is loading there is no indicator at all. An owner cannot distinguish between:

- Queue is genuinely empty
- Data is still loading
- Query failed due to a network error

## Impact

- Owner sees a blank dashboard and cannot tell if the session is working
- Failed stats look identical to a zero-activity session
- No path for the owner to understand or recover from an error state

## Fix

Add `isLoading` and `isError` guards to each section rendering:

```tsx
{queue.isError && (
  <p className="text-destructive text-sm">Failed to load queue. Refresh to retry.</p>
)}
{queue.isLoading && <QueueSkeleton />}
{!queue.isLoading && !queue.isError && (
  <QueueManager songs={queue.data ?? []} sessionId={sessionId} />
)}
```

Apply the same pattern to `nowPlaying` and `stats`.
