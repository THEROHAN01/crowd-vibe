# Task 11: Venue Owner Frontend — Dashboard & Session Management — Code Review

**Date:** 2026-03-17
**Commit:** `5cce390`
**Files created:** `(venue)/layout.tsx`, `(venue)/dashboard/page.tsx`, `(venue)/dashboard/dashboard.tsx`, `create-venue-form.tsx`, `start-session-form.tsx`, `session-dashboard.tsx`, `queue-manager.tsx`, `qr-display.tsx`, `youtube-player.tsx`
**Files deleted:** `dashboard/page.tsx`, `dashboard/dashboard.tsx`
**Files modified:** `apps/web/tsconfig.json`

---

## Issues

### ISSUE-01: `tsconfig.json` `jsx` changed from `"preserve"` to `"react-jsx"` — carried forward from Task 1

**File:** `apps/web/tsconfig.json:20`
**Severity:** MEDIUM
**Description:** This is the same uncommitted `tsconfig.json` change flagged in the Task 1 review (ISSUE-01). It was never reverted and is now committed as part of Task 11. Next.js expects `"jsx": "preserve"` — it handles JSX transformation via SWC. `"react-jsx"` can cause conflicts with the Next.js compiler and may break React Server Components.

**Recommendation:** Fix in a follow-up commit: change `"jsx"` back to `"preserve"`.

---

### ISSUE-02: `QRDisplay.copyLink` passes `joinUrl` (which is `string | null`) to `clipboard.writeText`

**File:** `apps/web/src/components/venue/qr-display.tsx:30`
**Severity:** MEDIUM
**Description:** `navigator.clipboard.writeText(joinUrl)` — but `joinUrl` is typed as `string | null`. TypeScript should flag this since `writeText` expects `string`. The component does guard against `null` in the render (line 33: `if (!joinUrl) return ...`), but the `copyLink` callback is created before that guard via `useCallback`, so TypeScript can't narrow the type.

This would be a TypeScript compile error with strict null checks.

**Recommendation:** Add a null guard inside the callback:
```typescript
const copyLink = useCallback(() => {
  if (joinUrl) navigator.clipboard.writeText(joinUrl);
}, [joinUrl]);
```

---

### ISSUE-03: `addSong` mutation has no `onSuccess` callback — no cache invalidation

**File:** `apps/web/src/components/venue/session-dashboard.tsx:61`
**Severity:** LOW
**Description:** The `addSong` mutation is created without any `onSuccess` handler:
```typescript
const addSong = useMutation(trpc.song.add.mutationOptions());
```
Other mutations (`nextSong`, `skipSong`) have `onSuccess: () => queryClient.invalidateQueries()`. The `addSong` mutation doesn't, meaning the UI won't update after adding a song unless an SSE event triggers it. Since `useSessionEvents` handles `onSongAdded: () => queue.refetch()`, this works in practice — the SSE broadcast will trigger a refetch. But if the SSE connection is momentarily down, the owner won't see their own added song until reconnection.

**Recommendation:** Add `onSuccess` for consistency:
```typescript
const addSong = useMutation(trpc.song.add.mutationOptions({
  onSuccess: () => queryClient.invalidateQueries(),
}));
```

---

### ISSUE-04: `removeSong` mutation in `QueueManager` also has no `onSuccess`

**File:** `apps/web/src/components/venue/queue-manager.tsx:23`
**Severity:** LOW
**Description:** Same pattern as ISSUE-03 — `removeSong` has no `onSuccess` handler. Relies on SSE `onSongRemoved` event. Same risk if SSE is temporarily disconnected.

---

### ISSUE-05: Double auth check — layout AND page both call `auth.api.getSession()`

**File:** `apps/web/src/app/(venue)/layout.tsx:10` and `apps/web/src/app/(venue)/dashboard/page.tsx:7`
**Severity:** LOW
**Description:** Both the `(venue)/layout.tsx` and `(venue)/dashboard/page.tsx` call `auth.api.getSession()` independently. Each call likely involves a DB query to validate the session. The layout check is sufficient for auth gating — the page check is needed to pass `userId` and `userName` to the client component.

This is 2 DB queries per page load. Not a bug — the session data is needed in both places — but worth noting. Next.js `fetch` deduplication doesn't apply here since `auth.api.getSession()` is not a `fetch` call.

**Recommendation:** Acceptable for MVP. Could be optimized later with React `cache()` wrapping `auth.api.getSession()`.

---

### ISSUE-06: Review docs committed alongside source code

**File:** `docs/issues/task-01-env-config-foundation.md` (and 10 other review files)
**Severity:** INFO
**Description:** All review files from Tasks 1-10 were committed in this Task 11 commit. These are review artifacts, not part of the feature. They should have been committed separately or excluded from the feature commit.

---

## Improvements Over Plan

1. **`QRDisplay` handles null `joinUrl` state** — shows "Loading QR code..." while `window.location.origin` is being read in `useEffect`. The plan didn't account for SSR where `window` is undefined.

2. **`session.start` collision retry improved** — already noted in Task 8, but the `for` loop with explicit error on 10 failures is used here via the router.

---

## Verification

- `(venue)/layout.tsx`: Server component, auth guard, redirects to `/login`. Correct.
- `(venue)/dashboard/page.tsx`: Server component, passes user data to client. Correct.
- `dashboard.tsx`: Three-state UI (no venue → create, no session → start, active → dashboard). Correct.
- `create-venue-form.tsx`: Auto-slugify from name, `onCreated` callback. Correct.
- `start-session-form.tsx`: Optional session name, hardcoded `youtube` provider. Correct.
- `session-dashboard.tsx`: Search debounce (300ms), SSE handlers, YouTube player with `onEnded` → `queue.next`. All correct.
- `queue-manager.tsx`: Numbered list with remove buttons. Correct.
- `qr-display.tsx`: `QRCodeCanvas`, download via `canvas.toDataURL`, copy link. Correct.
- `youtube-player.tsx`: `react-youtube` wrapper with `autoplay: 1`. Correct.
- Old `dashboard/` files deleted. Confirmed.

**Verdict:** Solid implementation. The `tsconfig.json` `jsx` issue persists from Task 1 and should be fixed. The `copyLink` null safety issue would be caught by TypeScript strict checks.

| ID | Severity | Status |
|----|----------|--------|
| ISSUE-01 | MEDIUM | `jsx: "react-jsx"` committed — needs follow-up fix |
| ISSUE-02 | MEDIUM | `copyLink` passes potentially null `joinUrl` to `writeText` |
| ISSUE-03 | LOW | `addSong` mutation missing `onSuccess` cache invalidation |
| ISSUE-04 | LOW | `removeSong` mutation missing `onSuccess` cache invalidation |
| ISSUE-05 | LOW | Double `getSession()` call in layout + page |
| ISSUE-06 | INFO | Review docs bundled in feature commit |
