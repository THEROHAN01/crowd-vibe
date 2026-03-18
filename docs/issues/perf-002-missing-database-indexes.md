# PERF-002: Missing composite database indexes on hot query paths

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| **Severity**     | P0 CRITICAL                                    |
| **Category**     | Performance / Database                         |
| **File**         | `packages/db/prisma/schema/domain.prisma`      |
| **Lines**        | 54-75 (Song model), 19-36 (VenueSession), 77-88 (Vote) |
| **Discovered**   | 2026-03-18                                     |
| **Status**       | Open                                           |

---

## Summary

Several high-frequency queries in the CrowdVibe API lack proper composite database indexes, forcing PostgreSQL to perform sequential scans on every invocation. These queries run on the **hot path** -- they execute on every song suggestion, every vote, and every queue refresh. As data accumulates during a venue session, query latency grows linearly, creating cascading slowness under concurrent load.

---

## Missing Indexes

### 1. Song `[sessionId, providerId, status]` -- Duplicate detection

**Query location:** `packages/api/src/routers/song.ts`, lines 112-118

```typescript
// Check duplicate
const existing = await prisma.song.findFirst({
	where: {
		sessionId,
		providerId: input.providerId,
		status: { in: ["queued", "playing"] },
	},
});
```

This same pattern is also used in the owner `add` mutation at lines 208-214:

```typescript
const existing = await prisma.song.findFirst({
	where: {
		sessionId: input.sessionId,
		providerId: input.providerId,
		status: { in: ["queued", "playing"] },
	},
});
```

**When it runs:** Every single song suggestion or add action. This is the most frequently triggered write path in the application.

**Current indexes on Song model (line 73):**
```prisma
@@index([sessionId, status, score])
```

This existing index covers `[sessionId, status, score]` but **not** `[sessionId, providerId, status]`. PostgreSQL can use the existing index to filter by `sessionId` + `status`, but then must scan all matching rows to check `providerId`. The query planner cannot efficiently use the index because `providerId` is not in the index and the columns are in a different order than needed.

**Impact:** At 500 songs in a session, PostgreSQL scans all songs with `status IN ('queued', 'playing')` for the given session, then filters by `providerId`. This takes ~20-50ms instead of ~1ms with a proper index.

---

### 2. Song `[sessionId, suggestedById]` -- Suggestion count + cooldown check

**Query location:** `packages/api/src/routers/song.ts`, lines 85-87 (count) and 96-100 (cooldown)

```typescript
// Suggestion count check (line 85-87)
const suggestionCount = await prisma.song.count({
	where: { sessionId, suggestedById: ctx.guestId },
});
```

```typescript
// Cooldown check (line 96-100)
const lastSuggestion = await prisma.song.findFirst({
	where: { sessionId, suggestedById: ctx.guestId },
	orderBy: { addedAt: "desc" },
	select: { addedAt: true },
});
```

**When it runs:** Both queries execute on every guest song suggestion. They run sequentially before the duplicate check, meaning every suggestion triggers 3 unindexed queries in sequence.

**Current indexes on Song model:**
```prisma
@@index([sessionId, status, score])
```

No index covers the `[sessionId, suggestedById]` combination. PostgreSQL must scan all songs in the session and filter by `suggestedById` for both the count and the findFirst.

**Impact:** These two queries run back-to-back. At 200 songs per session, each takes ~10-20ms. Combined with the duplicate check (index #1), a single song suggestion triggers ~60-100ms of unindexed queries before any actual write occurs.

---

### 3. VenueSession `[venueId, isActive]` -- Active session lookup

**Query location:** `packages/api/src/routers/session.ts`, line 26

```typescript
const existing = await prisma.venueSession.findFirst({
	where: { venueId: input.venueId, isActive: true },
});
```

Also used in `session.ts`, line 117 (`getActive` procedure):
```typescript
return prisma.venueSession.findFirst({
	where: { venueId: input.venueId, isActive: true },
	select: {
		id: true,
		joinCode: true,
		name: true,
		startedAt: true,
		musicProvider: true,
	},
});
```

And in `venue.ts`, lines 86-87 (nested filter):
```typescript
return prisma.venue.findMany({
	where: { ownerId: ctx.user.id },
	include: {
		sessions: {
			where: { isActive: true },
			...
		},
	},
	...
});
```

**When it runs:** Session start (prevents duplicate active sessions), active session lookup (every page load), venue listing (dashboard).

**Current indexes on VenueSession model (lines 33-34):**
```prisma
@@index([venueId])
@@index([isActive])
```

There are **separate** single-column indexes on `venueId` and `isActive`, but **no composite index**. PostgreSQL cannot efficiently combine two single-column indexes for an `AND` query. It typically picks one index (usually `venueId` since it's more selective), scans matching rows, and then filters by `isActive`. This is especially wasteful because `isActive` is a boolean with very low cardinality -- the `@@index([isActive])` index is nearly useless on its own.

**Impact:** Low-to-moderate for now (venues have few sessions), but the separate `isActive` index wastes storage and write overhead without providing query benefit. The composite index replaces both single-column indexes.

---

### 4. Vote `[guestId]` -- Guest vote history

**Query location:** `packages/api/src/routers/guest.ts`, lines 12-15

```typescript
const guest = await prisma.guestUser.findUnique({
	where: { id: ctx.guestId },
	select: {
		id: true,
		displayName: true,
		sessionId: true,
		votes: {
			where: { song: { status: { in: ["queued", "playing"] } } },
			select: { songId: true, value: true },
		},
		_count: { select: { suggestions: true } },
	},
});
```

**When it runs:** Every time the guest view loads (initial page load, reconnects, refocuses). The `votes` relation filter requires looking up all votes by `guestId` and then joining to `song` to check status.

**Current indexes on Vote model:**
```prisma
@@unique([songId, guestId])
```

The unique constraint creates an index on `[songId, guestId]`, but the query needs to look up votes **by guestId** (the second column). PostgreSQL cannot efficiently use a B-tree index `[songId, guestId]` for lookups by `guestId` alone -- it would need to scan the entire index. A dedicated `[guestId]` index is needed.

**Impact:** At 100+ votes per session (common with 20+ guests voting on 5+ songs each), the nested relation query performs a sequential scan on the votes table filtered by guestId. This adds ~10-30ms per guest page load.

---

## Cumulative Impact

| Scenario | Current (no indexes) | With indexes |
| --- | --- | --- |
| Song suggestion (3 queries) | ~60-100ms | ~3-5ms |
| Queue refresh (1 query) | ~20ms | ~2ms |
| Guest page load (1 query) | ~15ms | ~2ms |
| 50 concurrent suggestions | ~3-5s total DB time | ~150-250ms total |

Under concurrent load, unindexed queries hold database connections longer, compounding the connection pool exhaustion issue described in PERF-001.

---

## Fix

### Step 1: Add missing indexes to domain.prisma

**File: `packages/db/prisma/schema/domain.prisma`**

Add the following `@@index` directives:

```prisma
model Song {
  id            String       @id @default(cuid())
  sessionId     String
  session       VenueSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  providerId    String
  provider      String       @default("youtube")
  title         String
  artist        String?
  thumbnailUrl  String?
  durationMs    Int?
  status        String       @default("queued")
  score         Int          @default(0)
  addedAt       DateTime     @default(now())
  playedAt      DateTime?
  suggestedById String?
  suggestedBy   GuestUser?   @relation("SuggestedBy", fields: [suggestedById], references: [id], onDelete: SetNull)

  votes         Vote[]

  @@index([sessionId, status, score])            // existing - queue ordering
  @@index([sessionId, providerId, status])       // NEW - duplicate detection
  @@index([sessionId, suggestedById])            // NEW - suggestion count + cooldown
  @@map("song")
}

model VenueSession {
  id            String    @id @default(cuid())
  venueId       String
  venue         Venue     @relation(fields: [venueId], references: [id], onDelete: Cascade)
  name          String?
  musicProvider String    @default("youtube")
  isActive      Boolean   @default(true)
  joinCode      String    @unique
  startedAt     DateTime  @default(now())
  endedAt       DateTime?

  songs         Song[]
  guests        GuestUser[]

  @@index([venueId, isActive])                   // NEW - replaces two separate indexes
  @@map("venue_session")
}

model Vote {
  id        String    @id @default(cuid())
  songId    String
  song      Song      @relation(fields: [songId], references: [id], onDelete: Cascade)
  guestId   String
  guest     GuestUser @relation(fields: [guestId], references: [id], onDelete: Cascade)
  value     Int
  createdAt DateTime  @default(now())

  @@unique([songId, guestId])
  @@index([guestId])                             // NEW - guest vote history lookup
  @@map("vote")
}
```

### Step 2: Remove redundant single-column indexes on VenueSession

Remove these two lines from the current schema:
```prisma
// REMOVE these:
@@index([venueId])
@@index([isActive])
```

Replace with the single composite:
```prisma
// REPLACE with:
@@index([venueId, isActive])
```

The composite index `[venueId, isActive]` can satisfy queries that filter on `venueId` alone (leftmost prefix), so the separate `@@index([venueId])` is redundant. The `@@index([isActive])` is nearly useless due to low cardinality (boolean column) and should be removed.

### Step 3: Generate and apply migration

```bash
# Generate migration SQL
npx prisma migrate dev --name add-missing-composite-indexes

# Verify the generated SQL contains CREATE INDEX statements
cat packages/db/prisma/migrations/*add-missing-composite-indexes/migration.sql
```

Expected SQL:
```sql
CREATE INDEX "song_sessionId_providerId_status_idx" ON "song"("sessionId", "providerId", "status");
CREATE INDEX "song_sessionId_suggestedById_idx" ON "song"("sessionId", "suggestedById");
CREATE INDEX "venue_session_venueId_isActive_idx" ON "venue_session"("venueId", "isActive");
CREATE INDEX "vote_guestId_idx" ON "vote"("guestId");

-- Also drops redundant indexes:
DROP INDEX "venue_session_venueId_idx";
DROP INDEX "venue_session_isActive_idx";
```

---

## Verification

### Using EXPLAIN ANALYZE

After applying the migration, verify index usage on the production database:

```sql
-- 1. Duplicate detection query
EXPLAIN ANALYZE
SELECT * FROM "song"
WHERE "sessionId" = 'test_session_id'
  AND "providerId" = 'dQw4w9WgXcQ'
  AND "status" IN ('queued', 'playing')
LIMIT 1;

-- Expected: Index Scan using song_sessionId_providerId_status_idx
-- NOT: Seq Scan or Filter

-- 2. Suggestion count
EXPLAIN ANALYZE
SELECT COUNT(*) FROM "song"
WHERE "sessionId" = 'test_session_id'
  AND "suggestedById" = 'test_guest_id';

-- Expected: Index Only Scan using song_sessionId_suggestedById_idx

-- 3. Active session lookup
EXPLAIN ANALYZE
SELECT * FROM "venue_session"
WHERE "venueId" = 'test_venue_id'
  AND "isActive" = true
LIMIT 1;

-- Expected: Index Scan using venue_session_venueId_isActive_idx

-- 4. Guest vote history
EXPLAIN ANALYZE
SELECT * FROM "vote"
WHERE "guestId" = 'test_guest_id';

-- Expected: Index Scan using vote_guestId_idx
```

### Load test comparison

Use `autocannon` or similar to hit the song suggest endpoint before and after:

```bash
# Before: expect p99 latency > 50ms under 50 concurrent users
# After:  expect p99 latency < 10ms under 50 concurrent users
npx autocannon -c 50 -d 10 http://localhost:3000/api/trpc/song.suggest
```

---

## Related Files

- `packages/api/src/routers/song.ts` -- Duplicate detection (lines 112-118, 208-214), suggestion count (lines 85-87), cooldown (lines 96-100)
- `packages/api/src/routers/session.ts` -- Active session lookup (lines 26-27, 117-118)
- `packages/api/src/routers/venue.ts` -- Venue listing with active sessions (lines 83-92)
- `packages/api/src/routers/guest.ts` -- Guest vote history (lines 6-18)
