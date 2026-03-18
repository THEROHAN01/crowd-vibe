# PERF-006: Blanket `queryClient.invalidateQueries()` Wipes Entire React Query Cache

**Severity:** P1 HIGH
**Category:** Performance / Network
**Date identified:** 2026-03-18

---

## Affected Files

| # | File | Line | Trigger |
|---|------|------|---------|
| 1 | `apps/web/src/components/session/vote-button.tsx` | 21 | Every vote cast |
| 2 | `apps/web/src/components/session/song-search.tsx` | 41 | Every song suggestion |
| 3 | `apps/web/src/components/venue/session-dashboard.tsx` | 56 | On next song / session start |
| 4 | `apps/web/src/components/venue/session-dashboard.tsx` | 63 | On skip / session end |
| 5 | `apps/web/src/components/venue/session-dashboard.tsx` | 74 | On song add by owner |

---

## Problem Description

All five mutation `onSuccess` callbacks call `queryClient.invalidateQueries()` with **no arguments**. When called without arguments, React Query invalidates every single cached query across the entire application. This means a single user action (e.g., casting a vote) triggers a refetch of every active query.

### Current Code at Each Call Site

**Call site 1 -- `vote-button.tsx:18-24`**
```typescript
const castVote = useMutation(
    trpc.vote.cast.mutationOptions({
        onSuccess: () => {
            queryClient.invalidateQueries(); // <-- invalidates ALL queries
        },
    }),
);
```

**Call site 2 -- `song-search.tsx:37-49`**
```typescript
const suggestSong = useMutation(
    trpc.song.suggest.mutationOptions({
        onSuccess: () => {
            toast.success("Song added to queue!");
            queryClient.invalidateQueries(); // <-- invalidates ALL queries
            setQuery("");
            setOpen(false);
        },
        onError: (err) => {
            toast.error(err.message);
        },
    }),
);
```

**Call site 3 -- `session-dashboard.tsx:53-58`**
```typescript
const nextSong = useMutation(
    trpc.queue.next.mutationOptions({
        onSuccess: () => {
            queryClient.invalidateQueries(); // <-- invalidates ALL queries
        },
    }),
);
```

**Call site 4 -- `session-dashboard.tsx:60-65`**
```typescript
const skipSong = useMutation(
    trpc.queue.skip.mutationOptions({
        onSuccess: () => {
            queryClient.invalidateQueries(); // <-- invalidates ALL queries
        },
    }),
);
```

**Call site 5 -- `session-dashboard.tsx:72-75`**
```typescript
const addSong = useMutation(
    trpc.song.add.mutationOptions({
        onSuccess: () => queryClient.invalidateQueries(), // <-- invalidates ALL queries
    }),
);
```

---

## The Invalidation Cascade

When a guest casts a single vote, here is what happens:

```
Guest clicks "upvote"
  -> vote.cast mutation fires
  -> onSuccess: queryClient.invalidateQueries()
  -> React Query marks ALL cached queries as stale
  -> Every active query observer triggers a refetch:
       1. queue.list({ sessionId })        -- fetches entire queue (unbounded, see PERF-003)
       2. queue.nowPlaying({ sessionId })   -- fetches currently playing song
       3. guest.me()                        -- fetches guest info + votes
       4. song.search({ query })            -- re-runs search if sheet is open
       5. session.stats({ sessionId })      -- fetches session stats (owner dashboard)
       6. venue.list()                      -- re-fetches venue list (if cached from navigation)
```

That is **6 network requests** triggered by a single vote.

### Thundering Herd Scenario

With 50 guests in a session, each voting roughly once every 5 seconds:

- Votes per second: ~10
- Refetches per vote per guest: 3-4 active queries on the session view
- Combined with SSE refetch triggers (which ALSO call `queue.refetch()`): effectively doubled
- **Worst case: 10 votes/s x 6 refetches = 60 unnecessary API calls/second**
- If `queue.list` is unbounded (see PERF-003) and returns 500 songs, that is 500 x 60 = **30,000 song records transferred per second**

### Impact

1. **Excessive network requests**: 5-6x more API calls than necessary per mutation
2. **Slow UI updates**: React Query refetches are asynchronous; UI feels sluggish as multiple queries resolve
3. **High server load**: Vercel function invocations scale linearly with unnecessary requests
4. **Increased Vercel costs**: Each function invocation is billed; blanket invalidation multiplies cost
5. **Database pressure**: Each refetch hits the database (no server-side caching -- see PERF-009)
6. **Mobile data waste**: Unnecessary data transfer on cellular connections

---

## Root Cause Analysis

The developer likely used `queryClient.invalidateQueries()` as a quick way to ensure UI consistency after mutations. This is a common anti-pattern in React Query codebases, especially during rapid prototyping. The React Query docs even warn against this:

> "Calling `invalidateQueries` without any arguments will invalidate ALL queries in the cache."
> -- TanStack Query v5 documentation

The correct approach is to specify **query key predicates** so only related queries are invalidated.

---

## Fix: Targeted Invalidation with Query Key Predicates

tRPC v11 with `@trpc/tanstack-react-query` uses query keys in the format `[["routerName", "procedureName"], { input, type }]`. To invalidate all queries under a router, pass the router name as part of the key array.

### Fix for Call Site 1: `vote-button.tsx` (vote cast)

A vote only affects the queue order (scores change) and the guest's own vote state. It does NOT affect nowPlaying, search results, or venue list.

```typescript
// apps/web/src/components/session/vote-button.tsx
const castVote = useMutation(
    trpc.vote.cast.mutationOptions({
        onSuccess: () => {
            // Only invalidate queue (scores changed) and guest info (vote recorded)
            queryClient.invalidateQueries({ queryKey: [["queue"]] });
            queryClient.invalidateQueries({ queryKey: [["guest"]] });
        },
    }),
);
```

### Fix for Call Site 2: `song-search.tsx` (song suggested)

A suggestion adds a song to the queue and decrements the guest's remaining suggestions.

```typescript
// apps/web/src/components/session/song-search.tsx
const suggestSong = useMutation(
    trpc.song.suggest.mutationOptions({
        onSuccess: () => {
            toast.success("Song added to queue!");
            // Invalidate queue (new song added) and guest info (suggestion count changed)
            queryClient.invalidateQueries({ queryKey: [["queue"]] });
            queryClient.invalidateQueries({ queryKey: [["guest"]] });
            queryClient.invalidateQueries({ queryKey: [["session", "stats"]] });
            setQuery("");
            setOpen(false);
        },
        onError: (err) => {
            toast.error(err.message);
        },
    }),
);
```

### Fix for Call Site 3: `session-dashboard.tsx` (next song)

Playing the next song changes both the queue and nowPlaying state.

```typescript
// apps/web/src/components/venue/session-dashboard.tsx
const nextSong = useMutation(
    trpc.queue.next.mutationOptions({
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [["queue"]] });
            queryClient.invalidateQueries({ queryKey: [["session", "stats"]] });
        },
    }),
);
```

### Fix for Call Site 4: `session-dashboard.tsx` (skip song)

Skipping is functionally identical to next song.

```typescript
// apps/web/src/components/venue/session-dashboard.tsx
const skipSong = useMutation(
    trpc.queue.skip.mutationOptions({
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [["queue"]] });
            queryClient.invalidateQueries({ queryKey: [["session", "stats"]] });
        },
    }),
);
```

### Fix for Call Site 5: `session-dashboard.tsx` (owner adds song)

Owner adding a song only affects the queue.

```typescript
// apps/web/src/components/venue/session-dashboard.tsx
const addSong = useMutation(
    trpc.song.add.mutationOptions({
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [["queue"]] });
            queryClient.invalidateQueries({ queryKey: [["session", "stats"]] });
        },
    }),
);
```

---

## Advanced Improvement: Optimistic Updates

For the vote button specifically, an optimistic update would make the UI feel instant:

```typescript
// apps/web/src/components/session/vote-button.tsx
const castVote = useMutation(
    trpc.vote.cast.mutationOptions({
        onMutate: async ({ songId, value }) => {
            // Cancel outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: [["queue"]] });

            // Snapshot the previous queue
            const previousQueue = queryClient.getQueryData([["queue", "list"]]);

            // Optimistically update the score in the queue
            queryClient.setQueriesData(
                { queryKey: [["queue", "list"]] },
                (old: any) => {
                    if (!old) return old;
                    return old.map((song: any) =>
                        song.id === songId
                            ? { ...song, score: song.score + value }
                            : song,
                    );
                },
            );

            return { previousQueue };
        },
        onError: (_err, _vars, context) => {
            // Revert to the previous queue on error
            if (context?.previousQueue) {
                queryClient.setQueriesData(
                    { queryKey: [["queue", "list"]] },
                    context.previousQueue,
                );
            }
        },
        onSettled: () => {
            // Always refetch after error or success to ensure consistency
            queryClient.invalidateQueries({ queryKey: [["queue"]] });
            queryClient.invalidateQueries({ queryKey: [["guest"]] });
        },
    }),
);
```

This pattern:
1. Immediately updates the UI (no loading state visible)
2. Reverts the change if the server rejects it
3. Re-syncs with the server regardless of outcome

---

## Query Key Reference

For this codebase, tRPC query keys follow this structure based on the router definition in `packages/api/src/routers/index.ts`:

| Router | Key prefix | Procedures |
|--------|-----------|------------|
| `venue` | `[["venue"]]` | `list`, `create`, etc. |
| `session` | `[["session"]]` | `stats`, `end`, etc. |
| `guest` | `[["guest"]]` | `me` |
| `queue` | `[["queue"]]` | `list`, `nowPlaying`, `next`, `skip` |
| `song` | `[["song"]]` | `search`, `suggest`, `add` |
| `vote` | `[["vote"]]` | `cast` |

Using `{ queryKey: [["queue"]] }` invalidates all queries under the `queue` router (both `queue.list` and `queue.nowPlaying`).

---

## Verification

After applying the fix, verify with React Query DevTools:

1. Install `@tanstack/react-query-devtools` (dev dependency)
2. Open the devtools panel in the browser
3. Cast a vote and observe that only `queue.*` and `guest.*` queries are refetched
4. Confirm `song.search`, `venue.list`, and other unrelated queries remain in their cached state
5. Monitor the Network tab to confirm reduced API calls

---

## Related Issues

- **PERF-003**: Unbounded queue queries (amplifies the damage from blanket invalidation)
- **PERF-007**: No staleTime defaults (all invalidated queries are immediately stale and refetch)
- **PERF-009**: No auth caching (every refetch triggers full auth validation)
