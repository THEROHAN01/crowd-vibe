# CrowdVibe Test Infrastructure Design

## Overview

Test infrastructure for the CrowdVibe MVP — a crowd-controlled music voting system. Covers unit tests for pure business logic and integration tests for tRPC routers against a real PostgreSQL database. E2E browser tests are deferred to a future pass once the UI stabilizes.

**Testing layers:** Unit + Integration (no E2E yet)
**Test runner:** Vitest (ESM-native, workspace mode)
**Database strategy:** Local PostgreSQL via Docker
**Related plan:** `docs/superpowers/plans/2026-03-17-crowdvibe-mvp.md`

---

## Architecture

### Vitest Workspace

A single `vitest.workspace.ts` at the project root defines two **projects**:

- **`unit`** — Matches `**/*.test.ts`, excludes `*.integration.test.ts`. No global setup. Fast, no DB, no network.
- **`integration`** — Matches `**/*.integration.test.ts`. Uses a `globalSetup.ts` that runs `prisma db push --force-reset` against the test database before the suite starts.

Per-package Vitest configs:

| Config file | Scope |
|---|---|
| `packages/api/vitest.config.ts` | Unit + integration tests for routers, lib, music, SSE |
| `packages/db/vitest.config.ts` | Schema sanity tests (future) |
| `apps/web/vitest.config.ts` | Component unit tests (future) |

Only `packages/api/vitest.config.ts` is created now. The others are placeholders for when those packages need tests.

### Docker Test Database

**`docker-compose.test.yml`** at project root:

- Service: `postgres-test`
- Image: `postgres:17-alpine`
- Port: `5433` (avoids conflict with local Postgres on 5432)
- Database: `crowdvibe_test`
- Credentials: `test` / `test`
- No volume — ephemeral, wiped on container restart

### Environment

**`.env.test`** at project root with test-specific values:

```
DATABASE_URL=postgresql://test:test@localhost:5433/crowdvibe_test
BETTER_AUTH_SECRET=test-secret-that-is-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3001
YOUTUBE_API_KEY=test-youtube-api-key
```

This file is safe to commit (no real secrets).

---

## Test Isolation Strategy

### Unit tests

No isolation needed — pure functions, no shared state.

### Integration tests

Each integration test file:

1. Imports `resetDatabase()` from test helpers
2. Calls `resetDatabase()` in `beforeEach` — truncates all tables in dependency order (Vote → Song → GuestUser → VenueSession → Venue, then auth tables)
3. Sets up its own test data via fixture factories

This gives full isolation between tests without per-test schema resets (which would be slow).

### External API mocking

- **YouTube API:** Mock `global.fetch` with `vi.fn()` returning canned JSON responses. No real API calls in any test.
- **SSE channel manager:** Use the real in-memory singleton. Assert broadcasts by subscribing a test writer that captures events.

---

## Test Helpers

All helpers live in `packages/api/test/helpers/`:

### `test-db.ts` — Test Prisma client + cleanup

- Creates a Prisma client connected to the test `DATABASE_URL`
- Exports `resetDatabase()` — truncates tables in correct dependency order using `$executeRawUnsafe`
- Exports `testPrisma` for direct DB assertions in tests

### `test-context.ts` — tRPC caller factories

- `createOwnerCaller(userId?)` — builds a tRPC caller with `{ type: "owner", user: { id, name, email } }` context
- `createGuestCaller(guestId, sessionId)` — builds a caller with `{ type: "guest", guestId, guestSessionId }` context
- `createAnonymousCaller()` — builds a caller with `{ type: "anonymous" }` context

Uses `t.createCallerFactory(appRouter)` so tests call routers directly (e.g., `caller.venue.create({ ... })`) without HTTP overhead.

### `test-fixtures.ts` — Factory functions

- `createTestUser(overrides?)` → inserts User, returns record
- `createTestVenue(ownerId, overrides?)` → inserts Venue with sensible defaults
- `createTestSession(venueId, overrides?)` → inserts VenueSession with generated joinCode
- `createTestGuest(sessionId, overrides?)` → inserts GuestUser with generated fingerprint
- `createTestSong(sessionId, overrides?)` → inserts Song with default status "queued"

All return the created Prisma record. Override any field via the `overrides` parameter.

### `index.ts` — Barrel export

Re-exports everything from the above modules for clean imports:

```typescript
import { resetDatabase, createOwnerCaller, createTestVenue } from "../test/helpers";
```

---

## Test File Naming Convention

| Pattern | Type | Requires DB |
|---|---|---|
| `*.test.ts` | Unit test | No |
| `*.integration.test.ts` | Integration test | Yes (Docker Postgres) |

Tests live next to the source files they test:

```
packages/api/src/lib/cookie.ts
packages/api/src/lib/cookie.test.ts
packages/api/src/routers/venue.ts
packages/api/src/routers/venue.integration.test.ts
```

---

## Test Coverage Plan

### Unit Tests

| Source file | What's tested |
|---|---|
| `lib/cookie.ts` | sign/verify round-trip, tampered signature rejected, malformed input returns null |
| `lib/rate-limiter.ts` | allows up to max, blocks after max, resets after window expires, sweep cleans expired entries |
| `lib/join-code.ts` | output length is 6, uses only valid charset, no ambiguous characters (O/0/I/1/L) |
| `lib/settings.ts` | defaults applied for empty input, partial overrides merged, invalid input falls back to defaults |
| `music/search-cache.ts` | set/get round-trip, TTL expiry, makeKey normalizes case and whitespace |
| `music/providers/youtube.ts` | `parseDuration` converts ISO 8601 to ms, `getThumbnail` fallback chain, `search` and `getTrack` with mocked fetch |
| `sse/channel-manager.ts` | subscribe/unsubscribe lifecycle, broadcast reaches all writers, dead writer auto-cleaned, getListenerCount accurate |

### Integration Tests

| Router | What's tested |
|---|---|
| `venue` | create succeeds, duplicate slug returns BAD_REQUEST, update own venue works, update other's venue returns NOT_FOUND, listMine returns only owned venues |
| `session` | start creates session with valid joinCode, can't start two active sessions for same venue, end sets isActive=false and broadcasts session_ended, getByJoinCode returns venue name + listener count |
| `guest` | me returns guest record with active votes and suggestion count |
| `song` | search returns tracks (mocked YouTube), suggest creates song + auto-upvote in transaction, suggest respects cooldown, suggest respects max suggestions limit, suggest rejects duplicate providerId, owner add works, owner remove deletes and broadcasts |
| `vote` | cast upvote increments score, toggle (same value) removes vote and decrements, downvote below threshold triggers auto-skip via advanceQueue |
| `queue` | next advances to highest-scored queued song, skip marks current as skipped, empty queue returns null and broadcasts null now_playing |

---

## NPM Scripts

Added to root `package.json`:

```json
{
  "test": "vitest run --project unit",
  "test:integration": "vitest run --project integration",
  "test:all": "vitest run",
  "test:watch": "vitest --project unit",
  "test:coverage": "vitest run --coverage",
  "test:db:up": "docker compose -f docker-compose.test.yml up -d --wait",
  "test:db:down": "docker compose -f docker-compose.test.yml down",
  "test:db:reset": "dotenv -e .env.test -- npx prisma db push --force-reset --schema=packages/db/prisma/schema"
}
```

**TDD workflow:**

1. `npm run test:db:up` — start test database (once)
2. `npm run test:watch` — Vitest watch mode for unit tests
3. Write test → watch it fail → implement → watch it pass
4. `npm run test:integration` — run integration suite periodically
5. `npm run test:db:down` — stop database when done

---

## Dependencies

Added to root `package.json` `devDependencies`:

| Package | Purpose |
|---|---|
| `vitest` | Test runner |
| `@vitest/coverage-v8` | Coverage reporting |
| `dotenv-cli` | Load `.env.test` for DB scripts |

No additional mocking libraries — Vitest's built-in `vi.mock()`, `vi.fn()`, `vi.spyOn()` cover all needs.

---

## File Map

### Files to CREATE

```
docker-compose.test.yml                               — Postgres test container
.env.test                                              — Test environment variables
vitest.workspace.ts                                    — Vitest workspace (unit + integration projects)
packages/api/vitest.config.ts                          — API package Vitest config
packages/api/test/globalSetup.ts                       — Prisma db push before integration suite
packages/api/test/helpers/test-db.ts                   — Test Prisma client + resetDatabase()
packages/api/test/helpers/test-context.ts              — tRPC caller factories
packages/api/test/helpers/test-fixtures.ts             — Factory functions for test data
packages/api/test/helpers/index.ts                     — Barrel export
packages/api/src/lib/cookie.test.ts                    — Unit tests
packages/api/src/lib/rate-limiter.test.ts              — Unit tests
packages/api/src/lib/join-code.test.ts                 — Unit tests
packages/api/src/lib/settings.test.ts                  — Unit tests
packages/api/src/music/search-cache.test.ts            — Unit tests
packages/api/src/music/providers/youtube.test.ts       — Unit tests
packages/api/src/sse/channel-manager.test.ts           — Unit tests
packages/api/src/routers/venue.integration.test.ts     — Integration tests
packages/api/src/routers/session.integration.test.ts   — Integration tests
packages/api/src/routers/guest.integration.test.ts     — Integration tests
packages/api/src/routers/song.integration.test.ts      — Integration tests
packages/api/src/routers/vote.integration.test.ts      — Integration tests
packages/api/src/routers/queue.integration.test.ts     — Integration tests
```

### Files to MODIFY

```
package.json              — Add test scripts + devDependencies
packages/api/package.json — Add vitest config reference
```
