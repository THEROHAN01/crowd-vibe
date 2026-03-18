# PERF-003: Unbounded database queries with no pagination limits

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| **Severity**     | P0 CRITICAL                                    |
| **Category**     | Performance / API                              |
| **Files**        | `packages/api/src/routers/queue.ts` (lines 25-41), `packages/api/src/routers/venue.ts` (lines 82-93) |
| **Discovered**   | 2026-03-18                                     |
| **Status**       | Open                                           |

---

## Summary

Two critical API endpoints return **unbounded result sets** with no `take` (LIMIT) parameter. As data accumulates during venue sessions, every queue refresh and venue listing fetches the entire dataset, leading to ballooning payload sizes, network saturation, Vercel function timeouts, and a degraded user experience.

---

## Problem 1: `queue.list` -- All queued songs, no limit

### Current Code

**File: `packages/api/src/routers/queue.ts`, lines 25-41**

```typescript
return prisma.song.findMany({
	where: { sessionId: input.sessionId, status: "queued" },
	orderBy: [{ score: "desc" }, { addedAt: "asc" }],
	select: {
		id: true,
		providerId: true,
		provider: true,
		title: true,
		artist: true,
		thumbnailUrl: true,
		durationMs: true,
		status: true,
		score: true,
		addedAt: true,
		suggestedBy: { select: { displayName: true } },
	},
});
```

### Why this is critical

1. **No `take` parameter.** `findMany()` with no `take` returns ALL matching rows. If a venue runs for 4 hours with active guests, it can easily accumulate 200-500+ queued songs.

2. **Payload size grows linearly.** Each song in the select has ~12 fields. Serialized to JSON, each song is approximately 200-300 bytes. At scale:

   | Songs in queue | Payload size | Transfer time (3G) | Transfer time (4G) |
   | -------------- | ------------ | ------------------- | ------------------- |
   | 50             | ~12 KB       | 0.3s                | 0.1s                |
   | 200            | ~50 KB       | 1.2s                | 0.3s                |
   | 500            | ~125 KB      | 3.1s                | 0.8s                |
   | 1000           | ~250 KB      | 6.2s                | 1.6s                |

3. **This endpoint is called on EVERY real-time event.** The session dashboard component (`apps/web/src/components/venue/session-dashboard.tsx`, lines 79-87) refetches the queue on every SSE event:

   ```typescript
   useSessionEvents(sessionId, {
   	onVoteChanged: () => queue.refetch(),
   	onSongAdded: () => queue.refetch(),
   	onSongRemoved: () => queue.refetch(),
   	onNowPlaying: () => {
   		nowPlaying.refetch();
   		queue.refetch();
   	},
   });
   ```

   And the guest search component (`apps/web/src/components/session/song-search.tsx`, line 41) does a blanket invalidation on every suggestion:

   ```typescript
   onSuccess: () => {
   	toast.success("Song added to queue!");
   	queryClient.invalidateQueries(); // Invalidates EVERYTHING, including queue.list
   	setQuery("");
   	setOpen(false);
   },
   ```

4. **Cascade amplification.** Consider a session with 50 active guests and 300 songs:
   - Guest A votes -> SSE broadcasts `vote_changed` to 50 clients
   - All 50 clients call `queue.list` -> 50 queries returning 300 songs each
   - Total data transferred: 50 * 75KB = **3.75 MB** from a single vote
   - Total DB load: 50 sequential `findMany` queries scanning 300 rows each

5. **Vercel function timeout risk.** Vercel serverless functions have a 10-second timeout (free tier) or 60-second timeout (Pro). At 1000+ songs, the combined query + serialization + network transfer can approach this limit, especially under concurrent load when the DB connection pool is contended.

---

## Problem 2: `venue.listMine` -- All venues with nested sessions, no limit

### Current Code

**File: `packages/api/src/routers/venue.ts`, lines 82-93**

```typescript
listMine: protectedProcedure.query(async ({ ctx }) => {
	return prisma.venue.findMany({
		where: { ownerId: ctx.user.id },
		include: {
			sessions: {
				where: { isActive: true },
				select: { id: true, joinCode: true, name: true, startedAt: true },
			},
		},
		orderBy: { createdAt: "desc" },
	});
}),
```

### Why this is problematic

1. **No `take` parameter.** Returns all venues owned by the user. While most users will have 1-5 venues, there's no architectural limit preventing a power user from creating hundreds.

2. **Nested `include` with sessions.** Each venue includes its active sessions. While the `where: { isActive: true }` filter limits session data, the lack of a `take` on the outer query means all venues are fetched.

3. **No cursor-based pagination.** For future scalability (marketplace, franchise features), this endpoint needs pagination from the start.

---

## Impact Assessment

| Metric                     | Current (unbounded)              | With limits                     |
| -------------------------- | -------------------------------- | ------------------------------- |
| Queue payload (300 songs)  | ~75 KB                           | ~25 KB (100 song limit)        |
| Queue fetch per vote event | 50 clients * 75 KB = 3.75 MB    | 50 clients * 25 KB = 1.25 MB   |
| Vercel bandwidth/month     | Potentially 10+ GB              | ~3 GB                           |
| DB query time (300 songs)  | ~15-30ms                         | ~5-10ms (with LIMIT)           |
| UI responsiveness          | Jank at 200+ songs              | Consistent at any count         |

### Vercel billing impact

Vercel charges $40/100GB of bandwidth on Pro. Unbounded queries with 50 concurrent users can consume 3.75MB per vote event. At 500 votes per hour * 3.75MB = **1.8 GB/hour**. A 4-hour session = **7.2 GB**. Multiple venues running concurrently can push monthly bandwidth well past free tier limits.

---

## Fix

### Step 1: Add `take` parameter to `queue.list`

**File: `packages/api/src/routers/queue.ts`**

Update the input schema and query:

```typescript
list: authenticatedProcedure
	.input(
		z.object({
			sessionId: z.string(),
			limit: z.number().min(1).max(200).default(100),
			cursor: z.string().optional(), // song ID for cursor-based pagination
		}),
	)
	.query(async ({ ctx, input }) => {
		// Validate access (unchanged)
		if (ctx.type === "guest" && ctx.guestSessionId !== input.sessionId) {
			throw new TRPCError({ code: "FORBIDDEN" });
		}
		if (ctx.type === "owner") {
			const session = await prisma.venueSession.findUnique({
				where: { id: input.sessionId },
				select: { venue: { select: { ownerId: true } } },
			});
			if (!session || session.venue.ownerId !== ctx.user.id) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
		}

		const songs = await prisma.song.findMany({
			where: { sessionId: input.sessionId, status: "queued" },
			orderBy: [{ score: "desc" }, { addedAt: "asc" }],
			take: input.limit + 1, // Fetch one extra to determine if there are more
			...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
			select: {
				id: true,
				providerId: true,
				provider: true,
				title: true,
				artist: true,
				thumbnailUrl: true,
				durationMs: true,
				status: true,
				score: true,
				addedAt: true,
				suggestedBy: { select: { displayName: true } },
			},
		});

		let nextCursor: string | undefined;
		if (songs.length > input.limit) {
			const nextItem = songs.pop();
			nextCursor = nextItem?.id;
		}

		return { songs, nextCursor };
	}),
```

### Step 2: Add `take` parameter to `venue.listMine`

**File: `packages/api/src/routers/venue.ts`**

```typescript
listMine: protectedProcedure
	.input(
		z
			.object({
				limit: z.number().min(1).max(100).default(50),
				cursor: z.string().optional(),
			})
			.optional()
			.default({}),
	)
	.query(async ({ ctx, input }) => {
		const venues = await prisma.venue.findMany({
			where: { ownerId: ctx.user.id },
			include: {
				sessions: {
					where: { isActive: true },
					select: { id: true, joinCode: true, name: true, startedAt: true },
				},
			},
			orderBy: { createdAt: "desc" },
			take: input.limit + 1,
			...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
		});

		let nextCursor: string | undefined;
		if (venues.length > input.limit) {
			const nextItem = venues.pop();
			nextCursor = nextItem?.id;
		}

		return { venues, nextCursor };
	}),
```

### Step 3: Update frontend to handle paginated response

**File: `apps/web/src/components/venue/session-dashboard.tsx`**

The queue query result shape changes from `Song[]` to `{ songs: Song[], nextCursor?: string }`:

```typescript
// Before:
const queue = useQuery(trpc.queue.list.queryOptions({ sessionId }));
// Usage: queue.data?.length, queue.data ?? []

// After:
const queue = useQuery(trpc.queue.list.queryOptions({ sessionId, limit: 100 }));
// Usage: queue.data?.songs.length, queue.data?.songs ?? []
```

Update all references to `queue.data` to access `queue.data?.songs` instead.

### Step 4: (Recommended) Add total count for UI

If the UI needs to show "X songs in queue" (e.g., for a badge), add a lightweight count query:

```typescript
queueCount: authenticatedProcedure
	.input(z.object({ sessionId: z.string() }))
	.query(async ({ ctx, input }) => {
		// Access validation omitted for brevity
		return prisma.song.count({
			where: { sessionId: input.sessionId, status: "queued" },
		});
	}),
```

This is much cheaper than fetching all songs just to count them.

---

## Verification

1. **Before fix:** Open a session with 200+ songs. Open DevTools Network tab. Trigger a vote. Observe the `queue.list` response size.

2. **After fix:** Same setup. Response should contain at most 100 songs + a `nextCursor`. Response size should be capped at ~25KB.

3. **Pagination test:** Verify that scrolling/loading more songs works by passing `cursor` parameter:
   ```typescript
   // First page
   const page1 = await trpc.queue.list.query({ sessionId, limit: 50 });
   // Second page
   const page2 = await trpc.queue.list.query({ sessionId, limit: 50, cursor: page1.nextCursor });
   ```

---

## Related Files

- `packages/api/src/routers/queue.ts` -- Unbounded queue.list (lines 25-41)
- `packages/api/src/routers/venue.ts` -- Unbounded venue.listMine (lines 82-93)
- `apps/web/src/components/venue/session-dashboard.tsx` -- Consumes queue.list, refetches on every SSE event (lines 42, 79-87)
- `apps/web/src/components/session/song-queue.tsx` -- Renders the full song list from queue.list
- `apps/web/src/components/session/song-search.tsx` -- Blanket `queryClient.invalidateQueries()` triggers queue refetch (line 41)
- `apps/web/src/components/venue/queue-manager.tsx` -- Owner queue view, also renders full list
