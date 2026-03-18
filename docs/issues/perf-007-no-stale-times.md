# PERF-007: React Query `staleTime` Defaults to 0ms -- Excessive Refetching on Every Render

**Severity:** P1 HIGH
**Category:** Performance / Network
**Date identified:** 2026-03-18

---

## Affected File

| File | Lines | Description |
|------|-------|-------------|
| `apps/web/src/utils/trpc.ts` | 7-18 | `QueryClient` configuration -- no `staleTime` set |

---

## Problem Description

The `QueryClient` in `apps/web/src/utils/trpc.ts` is configured without any `defaultOptions.queries.staleTime`. React Query's default `staleTime` is `0`, meaning every cached query is considered stale immediately after being fetched. This triggers aggressive refetching behavior in multiple scenarios that users encounter constantly.

### Current Code

```typescript
// apps/web/src/utils/trpc.ts:7-18
export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error, query) => {
            toast.error(error.message, {
                action: {
                    label: "retry",
                    onClick: query.invalidate,
                },
            });
        },
    }),
    // NOTE: No defaultOptions configured at all
    // staleTime defaults to 0ms
    // gcTime defaults to 5 minutes
    // retry defaults to 3
    // refetchOnWindowFocus defaults to true
});
```

### What This Means

With `staleTime: 0`, React Query considers data "stale" the instant it arrives. Stale data is automatically refetched when:

1. **Component mount/re-mount**: Any component that calls `useQuery()` triggers a refetch if the data is stale (which it always is at 0ms)
2. **Window focus**: Switching tabs or clicking back into the browser window triggers a refetch of ALL active queries
3. **Network reconnect**: Coming back online triggers refetches
4. **Parent re-render**: If a parent component re-renders and the child mounts a query hook, the query refetches

### Only Exception in the Codebase

The only query with an explicit `staleTime` is `song.search` in two places:

```typescript
// apps/web/src/components/session/song-search.tsx:27-31
const searchResults = useQuery({
    ...trpc.song.search.queryOptions({ sessionId, query: debouncedQuery }),
    enabled: debouncedQuery.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes -- correctly set
});

// apps/web/src/components/venue/session-dashboard.tsx:47-51
const searchResults = useQuery({
    ...trpc.song.search.queryOptions({ sessionId, query: debouncedSearch }),
    enabled: debouncedSearch.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes -- correctly set
});
```

Every other query uses the default `staleTime: 0`:

| Query | File | Line | staleTime | Should Be |
|-------|------|------|-----------|-----------|
| `queue.list` | `session-view.tsx` | 17 | 0ms | 5-10s (SSE handles real-time) |
| `queue.nowPlaying` | `session-view.tsx` | 18-20 | 0ms | 5-10s (SSE handles real-time) |
| `guest.me` | `session-view.tsx` | 21 | 0ms | 30s (rarely changes) |
| `queue.list` | `session-dashboard.tsx` | 42 | 0ms | 5-10s (SSE handles real-time) |
| `queue.nowPlaying` | `session-dashboard.tsx` | 43-45 | 0ms | 5-10s (SSE handles real-time) |
| `session.stats` | `session-dashboard.tsx` | 46 | 0ms | 15-30s (increments slowly) |
| `song.search` | `song-search.tsx` | 27-31 | 5m | 5m (correct) |
| `song.search` | `session-dashboard.tsx` | 47-51 | 5m | 5m (correct) |

---

## Refetch Triggers in Normal Usage

### Scenario 1: Tab Switch

A guest is on the session view (`session-view.tsx`) with 3 active queries: `queue.list`, `queue.nowPlaying`, `guest.me`.

1. Guest switches to another tab (e.g., to check a text message)
2. Guest switches back to the CrowdVibe tab
3. `refetchOnWindowFocus` is `true` (default)
4. All 3 queries have `staleTime: 0`, so all are stale
5. **3 network requests fire immediately**

With 50 guests who each switch tabs once:
- 50 guests x 3 queries = **150 unnecessary API requests**

### Scenario 2: React Re-render Cascade

The session view has nested components. When SSE pushes a `vote_changed` event:

1. `useSessionEvents` callback fires `queue.refetch()`
2. Queue data updates, causing `SessionView` to re-render
3. `SongQueue` re-renders with new data
4. Each `VoteButton` re-renders
5. If any component unmounts/remounts during this (e.g., list reorder via key change), the query hook re-subscribes
6. React Query sees stale data and fires **another** refetch

### Scenario 3: Default Retry Behavior

React Query defaults to `retry: 3` with exponential backoff. If the server is under load and returns a 500 error:

1. First attempt fails
2. Retry 1 after ~1s
3. Retry 2 after ~2s
4. Retry 3 after ~4s
5. That is **4 requests** for a single failed query
6. With 5 active queries failing simultaneously: **20 requests** before giving up
7. The `onError` handler shows a toast for each -- 5 error toasts

---

## Impact Assessment

### Network Traffic

| Scenario | Queries Fired | With staleTime Fix | Reduction |
|----------|--------------|-------------------|-----------|
| Single tab switch | 3-5 per user | 0 (data fresh) | 100% |
| 50 users tab switch | 150-250 | 0 | 100% |
| Vote cast (with PERF-006) | 6 per user | 2 (targeted) | 67% |
| Page navigation back | 3-5 | 0 (data fresh) | 100% |
| SSE reconnect refetch | 3 | 3 (intentional) | 0% |

### Server Load

At 50 concurrent users with default behavior:
- Tab switch events: ~2 per minute per user = 100/min x 3 queries = **300 req/min from tab switches alone**
- With `staleTime: 10s` and `refetchOnWindowFocus: false`: **0 req/min from tab switches**

---

## Root Cause Analysis

The `QueryClient` was created with only an error handler in `queryCache`, and no `defaultOptions` were configured. This is the default React Query setup from their getting-started guide, which works fine for simple apps but creates severe performance issues in real-time applications like CrowdVibe where:

1. Many queries are active simultaneously (3-6 per view)
2. Multiple users share the same data (queue, nowPlaying)
3. SSE already provides real-time updates, making polling unnecessary
4. Mobile users frequently switch tabs

---

## Fix: Configure Default `staleTime` and Related Options

### Step 1: Update QueryClient Defaults

```typescript
// apps/web/src/utils/trpc.ts
export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error, query) => {
            toast.error(error.message, {
                action: {
                    label: "retry",
                    onClick: query.invalidate,
                },
            });
        },
    }),
    defaultOptions: {
        queries: {
            staleTime: 10 * 1000,       // 10 seconds -- data is "fresh" for 10s after fetch
            gcTime: 5 * 60 * 1000,      // 5 minutes  -- unused data stays in cache for 5m
            retry: 1,                    // 1 retry instead of 3 -- fail faster, show error
            refetchOnWindowFocus: false, // SSE handles real-time updates, no need for focus refetch
        },
    },
});
```

### Step 2: Per-Query staleTime Overrides

For queries that need different stale times, set them at the query level:

```typescript
// apps/web/src/app/session/[id]/session-view.tsx

// Real-time data -- SSE pushes updates, so staleTime can be longer
// The SSE handler calls refetch() when events arrive, bypassing staleTime
const queue = useQuery({
    ...trpc.queue.list.queryOptions({ sessionId }),
    staleTime: 30 * 1000, // 30 seconds -- SSE handles real-time, this is just a safety net
});

const nowPlaying = useQuery({
    ...trpc.queue.nowPlaying.queryOptions({ sessionId }),
    staleTime: 30 * 1000,
});

// Guest info changes only when the guest votes or suggests a song
// Mutations handle invalidation, so this can be quite long
const guestInfo = useQuery({
    ...trpc.guest.me.queryOptions(),
    staleTime: 60 * 1000, // 60 seconds
});
```

```typescript
// apps/web/src/components/venue/session-dashboard.tsx

// Stats update slowly (new listeners, songs played)
const stats = useQuery({
    ...trpc.session.stats.queryOptions({ sessionId }),
    staleTime: 30 * 1000, // 30 seconds
});

// Search results already have staleTime: 5m -- no change needed
```

### Recommended staleTime Values by Data Category

| Data Category | Queries | Recommended staleTime | Rationale |
|---------------|---------|----------------------|-----------|
| Real-time (SSE-backed) | `queue.list`, `queue.nowPlaying` | 30s | SSE pushes updates via `refetch()`, which bypasses staleTime. The staleTime only prevents unnecessary refetches on mount/focus. |
| User state | `guest.me` | 60s | Only changes on vote/suggest, which trigger targeted invalidation (PERF-006 fix). |
| Session metadata | `session.stats` | 30s | Increments slowly (listener count, songs played). |
| Search results | `song.search` | 5m | Already correctly set. YouTube results don't change. |
| Reference data | `venue.list` | 60s | Venue list rarely changes during a session. |

---

## Why `refetchOnWindowFocus: false` Is Safe Here

CrowdVibe uses SSE (Server-Sent Events) for real-time updates. The `useSessionEvents` hook in both `session-view.tsx` and `session-dashboard.tsx` handles:

- `vote_changed` -> `queue.refetch()`
- `song_added` -> `queue.refetch()`
- `song_removed` -> `queue.refetch()`
- `now_playing` -> `nowPlaying.refetch()` + `queue.refetch()`
- `session_ended` -> state update

These SSE-triggered refetches call `refetch()` directly, which **ignores staleTime** and always hits the network. This means:

1. Real-time data stays current via SSE
2. Window focus refetching is redundant and wasteful
3. Disabling it eliminates the largest source of unnecessary requests

If SSE disconnects and the user returns to the tab, the `onReconnect` handler already calls `refetch()` on all relevant queries (see `session-view.tsx:32-37`), so data will be re-synced.

---

## Verification

1. Open React Query DevTools in the browser
2. Cast a vote and observe the `queue.list` query's `dataUpdatedAt` timestamp
3. Switch to another tab and back within 10 seconds
4. Confirm that the query was NOT refetched (check `fetchStatus` remains `idle`)
5. Wait 10 seconds, then navigate to a new page and back
6. Confirm the query refetches (data is now stale)
7. Monitor the Network tab to confirm reduced API calls during normal usage

---

## Related Issues

- **PERF-006**: Blanket cache invalidation (staleTime: 0 means invalidated queries refetch immediately)
- **PERF-009**: Auth validation on every request (each refetch triggers full auth cycle)
- **PERF-003**: Unbounded queue queries (each unnecessary refetch fetches the entire queue)
