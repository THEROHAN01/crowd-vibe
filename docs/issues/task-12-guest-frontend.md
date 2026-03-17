# Task 12: Guest Frontend — Join & Session View — Code Review

**Date:** 2026-03-17
**Commit:** `7e6966e`
**Files created:** `join/[joinCode]/page.tsx`, `session/[id]/page.tsx`, `session/[id]/session-view.tsx`, `now-playing.tsx`, `song-queue.tsx`, `song-search.tsx`, `vote-button.tsx`

---

## Issues

### ISSUE-01: `VoteButton` creates a new `useMutation` instance per render per song

**File:** `apps/web/src/components/session/vote-button.tsx:14-21`
**Severity:** MEDIUM
**Description:** Each `VoteButton` component instance creates its own `useMutation` hook. In a queue with 20 songs, that's 40 mutation hook instances (up + down per song). Each call to `queryClient.invalidateQueries()` on success triggers refetches which re-render all buttons, each re-creating their mutation state.

While React Query handles this efficiently internally, the `onSuccess` callback calls `queryClient.invalidateQueries()` twice (line 17-18) — once blanket and once with `{ queryKey: [["guest"]] }`. The blanket `invalidateQueries()` already covers the guest query, making the second call redundant.

**Recommendation:** Remove the duplicate invalidation:
```typescript
onSuccess: () => {
  queryClient.invalidateQueries();
},
```

---

### ISSUE-02: `SongSearch` full-screen overlay has no escape key handler

**File:** `apps/web/src/components/session/song-search.tsx:56`
**Severity:** LOW
**Description:** The search overlay uses `fixed inset-0 z-50` to cover the entire screen. The Cancel button closes it, but pressing Escape does nothing. On mobile this is fine (no Escape key), but on desktop it's a UX gap.

**Recommendation:** Add a `useEffect` with a keydown listener for Escape when `isOpen` is true. Non-blocking for MVP.

---

### ISSUE-03: `h-full` on join page and session-ended overlay requires parent height

**File:** `apps/web/src/app/join/[joinCode]/page.tsx:29,34,42` and `session-view.tsx:37`
**Severity:** LOW
**Description:** Multiple components use `h-full` for vertical centering. This only works if the parent chain all the way to `<html>` has explicit height. The root layout likely sets this via Tailwind's default styles, but if it doesn't, these pages won't center vertically. This was flagged in the original plan review as a known minor issue.

---

## Improvements Over Plan

1. **`myVotes` uses `useMemo`** — the plan used `new Map()` inline in the render body. The implementation wraps it in `useMemo` with `[guestInfo.data?.votes]` dependency, preventing unnecessary re-creations on every render. Good optimization.

2. **`onReconnect` handler in session-view** — refetches `queue`, `nowPlaying`, and `guestInfo` on SSE reconnection. The plan didn't include this. Catches up on any events missed during disconnection.

3. **`SongSearch` suggestion count from server** — uses `guestInfo.data?._count?.suggestions` instead of local state counter. Survives page reloads. Matches the plan's updated approach.

4. **`session/[id]/page.tsx` uses Next.js 16 async params** — `params: Promise<{ id: string }>` with `await params`. Correct for Next.js 16.

---

## Verification

- `join/[joinCode]/page.tsx`: Client component, queries `session.getByJoinCode`, shows venue name + listener count, join form with display name, error handling. Correct.
- `session/[id]/page.tsx`: Server component wrapper, async params, passes `sessionId` to client. Correct.
- `session-view.tsx`: Three queries (queue, nowPlaying, guestInfo), SSE handlers, session-ended overlay, `myVotes` map. Correct.
- `now-playing.tsx`: Display-only hero card, no video player (guests only see metadata). Correct per spec.
- `song-queue.tsx`: Scrollable list with vote buttons, score display, `suggestedBy` data available but not rendered (could show who suggested). Correct.
- `song-search.tsx`: Full-screen overlay, 300ms debounce, server-derived suggestion count, toast on success/error. Correct.
- `vote-button.tsx`: Toggle up/down with color state, `active:scale-90` for tactile feedback. Correct.

**Verdict:** Solid guest frontend. All core flows implemented correctly. The duplicate `invalidateQueries` is the only actionable item.

| ID | Severity | Status |
|----|----------|--------|
| ISSUE-01 | MEDIUM | Duplicate `invalidateQueries()` in VoteButton |
| ISSUE-02 | LOW | No Escape key handler for search overlay |
| ISSUE-03 | LOW | `h-full` centering depends on parent height chain |
