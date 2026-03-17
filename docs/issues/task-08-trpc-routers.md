# Task 8: tRPC Routers — Code Review

**Date:** 2026-03-17
**Commit:** `f8ec939`
**Files created:** `packages/api/src/routers/venue.ts`, `session.ts`, `guest.ts`, `queue.ts`, `song.ts`, `vote.ts`
**Files modified:** `packages/api/src/routers/index.ts`, `packages/api/src/index.ts`, `packages/api/src/lib/join-code.ts`

---

## Issues

### ISSUE-01: `song.remove` calls `advanceQueue` after deleting the playing song — double broadcast

**File:** `packages/api/src/routers/song.ts:275-287`
**Severity:** MEDIUM
**Description:** When removing a currently playing song, the code:
1. Deletes the song (`prisma.song.delete`)
2. Broadcasts `song_removed`
3. Calls `advanceQueue(sessionId, musicProvider, "skipped")`

`advanceQueue` internally does `updateMany({ where: { status: "playing" }, data: { status: "skipped" } })` — but the playing song was already deleted, so this matches 0 rows (harmless). Then `advanceQueue` picks the next queued song and broadcasts `now_playing`.

The functional behavior is correct. However, `advanceQueue` also broadcasts `now_playing: { song: null }` if there are no queued songs remaining. This means clients get both `song_removed` AND `now_playing: null`, which is redundant but not harmful — clients handle both events.

**Recommendation:** Fine as-is. Just noting the double-broadcast behavior.

---

### ISSUE-02: `session.getByJoinCode` returns `session.id` in the select but doesn't expose it in the response

**File:** `packages/api/src/routers/session.ts:87-88`
**Severity:** INFO
**Description:** The Prisma select includes `id: true`, but the return object on lines 99-103 only returns `venueName`, `sessionName`, and `listenerCount`. The `id` is used internally for `channelManager.getListenerCount(session.id)` but not exposed to the client. This is correct — the spec says not to leak the session ID before the guest joins. The ID is obtained via the guest join route instead.

---

### ISSUE-03: `appRouter` replaces old `healthCheck` and `privateData` routes

**File:** `packages/api/src/routers/index.ts`
**Severity:** INFO
**Description:** The old `appRouter` had `healthCheck` (public) and `privateData` (protected) routes from the initial scaffolding. These are now gone, replaced entirely by the 6 new domain routers. The home page (`apps/web/src/app/page.tsx`) may reference `trpc.healthCheck` — this would be a build error when the frontend is compiled.

**Recommendation:** Verify `apps/web/src/app/page.tsx` doesn't call `trpc.healthCheck`. If it does, it'll need to be updated in a later task (Task 13/14 covers layout updates).

---

## Improvements Over Plan

Several changes improve on the plan — noting them for the record:

1. **`join-code.ts` upgraded to `randomInt` from `node:crypto`** — replaces `Math.random()` with cryptographically secure randomness. Good improvement.

2. **`authenticatedProcedure` now narrows context type** — adds `ctx as Exclude<Context, { type: "anonymous" }>` so downstream routes can access `ctx.user` or `ctx.guestId` without TypeScript errors. Necessary fix.

3. **`session.start` collision retry uses `for` loop with `taken` variable** — fixes the variable shadowing issue (`existing` used twice) that was in the plan. Also throws an explicit error after 10 failed attempts instead of silently using a potentially-colliding code.

4. **`vote.cast` re-reads song status before auto-skip** — adds `prisma.song.findUnique` to get fresh status after the vote transaction completes, avoiding stale data issues.

5. **`song.remove` auto-advances when removing a playing song** — the plan didn't handle this edge case. If the owner removes the currently playing song, the queue now auto-advances to the next song.

---

## Verification

- **venue.ts**: `create` catches P2002 for slug uniqueness. `listMine` includes active sessions. `update` verifies ownership. All correct.
- **session.ts**: `start` prevents multiple active sessions per venue. `end` broadcasts `session_ended`. `getByJoinCode` doesn't leak session ID. `stats` returns listener/guest/song counts. All correct.
- **guest.ts**: `me` filters votes to queued/playing songs. Includes `_count.suggestions`. Correct.
- **queue.ts**: `list`/`nowPlaying` validate access for both owner and guest. `next`/`skip` check `isActive`. Both use `advanceQueue`. Correct.
- **song.ts**: `search` uses server-side cache, rate limits guests. `suggest` enforces suggestion count + cooldown + duplicate checks, creates song + auto-upvote in transaction. `add` (owner) has duplicate check. `remove` has ownership check + auto-advance. All correct.
- **vote.ts**: `cast` handles toggle-off (same value = remove), direction change, and new vote. Score recalculated atomically via `aggregate`. Auto-skip at threshold. Correct.
- **index.ts (router)**: All 6 routers composed. `AppRouter` type exported. Correct.

**Verdict:** Solid implementation with several improvements over the plan. No blocking issues. The old healthCheck route removal should be verified against the home page.
