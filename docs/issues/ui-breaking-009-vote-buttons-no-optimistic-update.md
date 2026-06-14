# UI-BREAKING-009: Vote Buttons Have No Optimistic Update — Lag Makes UI Feel Broken

**Severity:** P2 — MEDIUM  
**Status:** ✅ RESOLVED — commits `bd26d30` (sessionId threading) + `76b6e8c` (optimistic update + rollback in VoteButton)  
**Area:** UI / Guest Session  
**File:** `apps/web/src/components/session/song-queue.tsx`

---

## Problem

When a guest taps an upvote or downvote button, the UI waits for the full round-trip (client → tRPC → DB → SSE broadcast → `setQueryData`) before the button appears active and the score updates. On mobile networks or high-latency connections, this round-trip can take 300–800ms.

During this window:
- The vote button shows no pressed/active state
- The score does not change
- The guest cannot tell if their tap registered
- Guests often tap again, which toggles the vote off (because the first vote landed)

This is the most frequently touched interaction in the app — every guest votes multiple times per session.

## Impact

- Core voting interaction feels laggy and broken on mobile
- Double-tap bug causes accidental vote toggles
- Reduces perceived quality of the real-time experience the product is built around

## Fix

Apply optimistic updates via React Query:

```tsx
const castVote = trpc.vote.cast.useMutation({
  onMutate: async ({ songId, value }) => {
    await queryClient.cancelQueries({ queryKey: [["queue", "list"]] })
    const prev = queryClient.getQueryData([["queue", "list"]])
    queryClient.setQueryData([["queue", "list"]], (old) =>
      old?.map((s) => s.id === songId ? { ...s, score: s.score + value } : s)
    )
    return { prev }
  },
  onError: (_, __, ctx) => queryClient.setQueryData([["queue", "list"]], ctx?.prev),
})
```
