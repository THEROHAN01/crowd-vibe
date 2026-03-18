# PERF-015: Vote Casting Has No Rate Limit — Vulnerable to Spam

| Field        | Value                                                       |
|--------------|-------------------------------------------------------------|
| **Severity** | P2 MEDIUM                                                   |
| **Category** | Security / Abuse Prevention                                 |
| **File**     | `packages/api/src/routers/vote.ts`                          |
| **Status**   | Open                                                        |
| **Date**     | 2026-03-18                                                  |

---

## Problem Statement

The `vote.cast` mutation is a `guestProcedure` with **no rate limiting**. Any guest can call this endpoint as fast as their network allows. While the song search endpoint has a rate limiter (`10 per minute` via `searchRateLimiter`), the vote endpoint has none.

### Current Vote Router

**File: `packages/api/src/routers/vote.ts`** (lines 9-17)

```typescript
export const voteRouter = router({
    cast: guestProcedure
        .input(
            z.object({
                songId: z.string(),
                value: z.union([z.literal(1), z.literal(-1)]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // ... no rate limit check here
```

Compare with the song search router which includes rate limiting:

**File: `packages/api/src/routers/song.ts`** (lines 18, 34-42)

```typescript
const searchRateLimiter = new RateLimiter(10, 60_000); // 10 per minute

// Inside the search handler:
if (ctx.type === "guest") {
    const rateKey = ctx.guestId;
    const { allowed } = searchRateLimiter.check(rateKey);
    if (!allowed) {
        throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many searches. Try again in a moment.",
        });
    }
}
```

### Attack Scenarios

#### Scenario 1: Vote Spam via Toggle

The vote handler supports toggling (lines 47-53): if a guest votes the same direction twice, it removes the vote. A malicious guest can exploit this:

```typescript
// Attacker script
while (true) {
    await trpc.vote.cast.mutate({ songId: "target-song", value: 1 });  // upvote
    await trpc.vote.cast.mutate({ songId: "target-song", value: 1 });  // toggle off
    // Net effect: 0, but generates 2 DB transactions + 2 SSE broadcasts per loop
}
```

Each iteration triggers:
- 2 Prisma transactions (each with 3 queries: find, delete/create, aggregate + update)
- 2 SSE broadcast events (`vote_changed`) sent to all connected clients
- 12 total database operations per loop iteration

At 50 iterations/second, that is **600 database operations/second** and **100 SSE events/second** from a single attacker.

#### Scenario 2: Queue Manipulation

A guest could write a script to rapidly upvote their preferred song and downvote competitors, manipulating the queue order in real-time. Since the auto-skip threshold check runs on every vote (lines 94-121), rapid downvoting could also trigger unintended song skips.

**Relevant auto-skip code (lines 94-108):**

```typescript
// Auto-skip if below threshold -- re-read song status to avoid stale data
if (newScore <= settings.downvoteSkipThreshold) {
    const currentSong = await prisma.song.findUnique({
        where: { id: input.songId },
        select: { status: true },
    });

    if (currentSong?.status === "queued") {
        await prisma.song.update({
            where: { id: input.songId },
            data: { status: "skipped" },
        });
        channelManager.broadcast(song.sessionId, {
            type: "song_removed",
            data: { songId: input.songId },
        });
    }
```

#### Scenario 3: SSE Flood

Every vote broadcasts a `vote_changed` event to all subscribers. Vote spamming floods the SSE channel, causing unnecessary re-renders on every connected guest's device. With 100 guests connected, each spam vote triggers 100 DOM updates.

---

## Root Cause

Rate limiting was applied to the search endpoint but not to the vote endpoint. The vote endpoint was likely considered low-risk because votes are idempotent (upvoting twice toggles), but the resource cost per call (database transaction + SSE broadcast) makes it a significant abuse vector.

---

## Impact Assessment

| Dimension               | Impact                                                                 |
|--------------------------|------------------------------------------------------------------------|
| **Database load**        | 6+ DB queries per vote call, unbounded requests/second per guest       |
| **SSE channel flooding** | Every vote broadcasts to all connected clients                         |
| **Queue fairness**       | Automated voting gives one guest disproportionate influence             |
| **Auto-skip abuse**      | Rapid downvoting can trigger song skips before organic votes happen     |
| **Server costs**         | Wasted DB writes and compute for toggle spam                           |
| **User experience**      | SSE flood causes flickering score updates on all guest devices          |

---

## Fix Instructions

### Step 1: Add a RateLimiter for Votes

**File: `packages/api/src/routers/vote.ts`**

Add a rate limiter at the top of the file, alongside the existing imports:

```typescript
import prisma from "@crowd-vibe/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { guestProcedure, router } from "../index";
import { advanceQueue } from "../lib/queue-helpers";
import { RateLimiter } from "../lib/rate-limiter";
import { parseVenueSettings } from "../lib/settings";
import { channelManager } from "../sse/channel-manager";

const voteRateLimiter = new RateLimiter(30, 60_000); // 30 votes per minute
```

### Step 2: Add Rate Limit Check in the Mutation

Add the rate limit check at the beginning of the `cast` mutation handler, before any database queries:

```typescript
export const voteRouter = router({
    cast: guestProcedure
        .input(
            z.object({
                songId: z.string(),
                value: z.union([z.literal(1), z.literal(-1)]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // Rate limit votes to prevent spam
            const { allowed } = voteRateLimiter.check(ctx.guestId);
            if (!allowed) {
                throw new TRPCError({
                    code: "TOO_MANY_REQUESTS",
                    message: "Too many votes. Slow down!",
                });
            }

            // Verify song belongs to guest's session
            const song = await prisma.song.findUnique({
                // ... rest of existing code unchanged
```

### Step 3: Handle Rate Limit on the Frontend

**File: `apps/web/src/components/session/vote-button.tsx`**

Add error handling for the `TOO_MANY_REQUESTS` case:

```tsx
import { toast } from "sonner";

const castVote = useMutation(
    trpc.vote.cast.mutationOptions({
        onSuccess: () => {
            queryClient.invalidateQueries();
        },
        onError: (err) => {
            if (err.data?.code === "TOO_MANY_REQUESTS") {
                toast.error("Slow down! Too many votes.");
            }
        },
    }),
);
```

### Rate Limit Parameters Rationale

| Parameter       | Value  | Rationale                                                             |
|-----------------|--------|-----------------------------------------------------------------------|
| `maxRequests`   | 30     | A guest can realistically vote on ~10-15 songs per minute. 30 gives headroom for toggling while blocking automated spam. |
| `windowMs`      | 60,000 | 1-minute rolling window. Short enough to recover quickly, long enough to prevent burst abuse. |

---

## Verification

### Manual Test

1. Open a guest session view
2. Click the upvote button rapidly on the same song ~35 times within a minute
3. After 30 clicks, you should see a "Too many votes. Slow down!" toast
4. Wait 60 seconds, voting should work again

### Automated Test

```typescript
import { voteRouter } from "./vote";

describe("vote rate limiting", () => {
    it("should reject votes after 30 per minute", async () => {
        // Mock guest context
        const ctx = { guestId: "test-guest", guestSessionId: "test-session" };

        // Cast 30 votes (should all succeed)
        for (let i = 0; i < 30; i++) {
            await expect(
                caller.vote.cast({ songId: "song-1", value: 1 })
            ).resolves.toBeDefined();
        }

        // 31st vote should be rejected
        await expect(
            caller.vote.cast({ songId: "song-1", value: 1 })
        ).rejects.toThrow("TOO_MANY_REQUESTS");
    });
});
```

### Load Test

Use a script to verify the rate limiter holds under load:

```bash
# Simulate rapid voting (should get 429 after 30 requests)
for i in $(seq 1 35); do
    curl -s -o /dev/null -w "%{http_code}\n" \
        -X POST http://localhost:3000/api/trpc/vote.cast \
        -H "Content-Type: application/json" \
        -H "Cookie: cv_guest=<test-cookie>" \
        -d '{"songId":"test","value":1}'
done
```

---

## Related Issues

- [PERF-014: SearchCache has no max size](./perf-014-search-cache-no-size-limit.md) -- the `RateLimiter` Map also has no max size, though it is lower risk
- The `RateLimiter` class itself (`packages/api/src/lib/rate-limiter.ts`) could benefit from a max-entries cap for defense in depth
