# CrowdVibe Test Infrastructure Design

## Overview

Test infrastructure for the CrowdVibe MVP — a crowd-controlled music voting system. Covers unit tests for pure business logic and integration tests for tRPC routers against a real PostgreSQL database. E2E browser tests are deferred to a future pass once the UI stabilizes.

**Testing layers:** Unit + Integration (no E2E yet)
**Test runner:** Vitest ^3.x (ESM-native, workspace mode)
**Database strategy:** Local PostgreSQL via Docker
**Related plan:** `docs/superpowers/plans/2026-03-17-crowdvibe-mvp.md`

---

## Architecture

### Vitest Workspace

A single `vitest.workspace.ts` at the project root using `defineWorkspace`:

```typescript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "unit",
      include: ["packages/api/src/**/*.test.ts"],
      exclude: ["**/*.integration.test.ts"],
    },
  },
  {
    test: {
      name: "integration",
      include: ["packages/api/src/**/*.integration.test.ts"],
      globalSetup: ["packages/api/test/globalSetup.ts"],
      env: { DOTENV_CONFIG_PATH: ".env.test" },
    },
  },
]);
```

- **`unit`** — Fast, no DB, no network. Matches `*.test.ts`, excludes `*.integration.test.ts`.
- **`integration`** — Uses `globalSetup.ts` that runs `prisma db push --force-reset` against the test database before the suite starts.

Only `packages/api` tests are created now. Per-package configs for `packages/db` and `apps/web` are deferred until those packages need tests.

### Docker Test Database

**`docker-compose.test.yml`** at project root:

- Service: `postgres-test`
- Image: `postgres:17-alpine`
- Port: `5433` (avoids conflict with local Postgres on 5432)
- Database: `crowdvibe_test`
- Credentials: `test` / `test`
- No volume — ephemeral, wiped on container restart
- Healthcheck: `pg_isready -U test -d crowdvibe_test` (ensures DB is ready before tests start)

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

## Neon Adapter Strategy

**Problem:** The production `@crowd-vibe/db` package creates its PrismaClient with the `PrismaNeon` WebSocket adapter, which cannot connect to a standard Docker PostgreSQL instance. All routers import `prisma` directly from `@crowd-vibe/db`.

**Solution:** Modify `packages/db/src/index.ts` to conditionally skip the Neon adapter when `globalThis.__vitest_worker__` is defined (Vitest sets this automatically) or when `process.env.VITEST` is set:

```typescript
import { PrismaClient } from "../prisma/generated/client";
import { env } from "@crowd-vibe/env/server";

let prisma: PrismaClient;

if (process.env.VITEST) {
  // In tests: use standard PrismaClient with direct TCP connection
  prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
} else {
  // In production: use Neon serverless adapter
  const { PrismaNeon } = await import("@prisma/adapter-neon");
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  prisma = new PrismaClient({ adapter });
}

export default prisma;
```

This means:
- Routers continue to `import prisma from "@crowd-vibe/db"` unchanged
- In test runs, the import resolves to a vanilla PrismaClient over TCP
- No `vi.mock()` needed for the DB module — the conditional handles it
- The `test-db.ts` helper imports the same `prisma` (which is now a standard client in test mode) for fixtures and assertions

---

## Test Isolation Strategy

### Unit tests

No isolation needed — pure functions, no shared state. Use `vi.useFakeTimers()` for modules that create `setInterval` (RateLimiter, SearchCache) to prevent timer leaks that hang the test process.

### Integration tests

Each integration test file:

1. Imports `resetDatabase()` from test helpers
2. Calls `resetDatabase()` in `beforeEach` — truncates all tables using `TRUNCATE ... CASCADE` in dependency order:
   `Vote → Song → GuestUser → VenueSession → Venue → Account → Session (auth) → Verification → User`
3. Calls `channelManager.reset()` in `beforeEach` to clear SSE subscriptions between tests
4. Sets up its own test data via fixture factories

This gives full isolation between tests without per-test schema resets (which would be slow).

### External API mocking

- **Music provider:** Integration tests `vi.mock("../music/index")` to replace `getMusicProvider()` with a fake provider that returns canned data. This avoids env variable issues with the real YouTube provider and keeps tests deterministic.
- **YouTube API (unit tests):** Mock `global.fetch` with `vi.fn()` returning canned JSON responses. Also `vi.mock("@crowd-vibe/env/server")` to provide a fake env object so the YouTubeProvider constructor doesn't fail on missing API key.
- **SSE channel manager:** Use the real in-memory singleton. Assert broadcasts by subscribing a test writer that captures events. The `reset()` method (to be added) clears all channels between tests.

---

## Test Helpers

All helpers live in `packages/api/test/helpers/`:

### `test-db.ts` — Prisma client + cleanup

- Imports `prisma` from `@crowd-vibe/db` (which in test mode is a vanilla PrismaClient — see Neon Adapter Strategy)
- Exports `resetDatabase()` — truncates all 9 tables using `TRUNCATE ... CASCADE` in dependency order via `$executeRawUnsafe`:
  `vote, song, guest_user, venue_session, venue, account, session, verification, user`
- Also resets SSE channel manager state via `channelManager.reset()`

### `test-context.ts` — tRPC caller factories

- `createOwnerCaller(userId?)` — builds a tRPC caller with `{ type: "owner", user: { id, name, email } }` context
- `createGuestCaller(guestId, sessionId)` — builds a caller with `{ type: "guest", guestId, guestSessionId }` context
- `createAnonymousCaller()` — builds a caller with `{ type: "anonymous" }` context

Uses `t.createCallerFactory(appRouter)` so tests call routers directly (e.g., `caller.venue.create({ ... })`) without HTTP overhead. Note: importing `appRouter` triggers the full dependency tree (`@crowd-vibe/db`, `@crowd-vibe/auth`), which is why the Neon adapter conditional (above) is essential.

### `test-fixtures.ts` — Factory functions

- `createTestUser(overrides?)` → generates a `crypto.randomUUID()` for `id` (User model has no `@default`), generates a unique email via counter suffix, inserts User, returns record
- `createTestVenue(ownerId, overrides?)` → inserts Venue with sensible defaults (name, slug with random suffix)
- `createTestSession(venueId, overrides?)` → inserts VenueSession with generated joinCode
- `createTestGuest(sessionId, overrides?)` → inserts GuestUser with generated fingerprint
- `createTestSong(sessionId, overrides?)` → inserts Song with default `providerId: "test-video-id"`, `title: "Test Song"`, `provider: "youtube"`, `status: "queued"`

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
| `lib/rate-limiter.ts` | allows up to max, blocks after max, resets after window expires, sweep cleans expired entries. Uses `vi.useFakeTimers()` + `vi.advanceTimersByTime()` for sweep testing. Call `destroy()` in afterEach. |
| `lib/join-code.ts` | output length is 6, uses only valid charset, no ambiguous characters (O/0/I/1/L) |
| `lib/settings.ts` | defaults applied for empty input, partial overrides merged, invalid input falls back to defaults |
| `music/search-cache.ts` | set/get round-trip, TTL expiry, makeKey normalizes case and whitespace. Uses `vi.useFakeTimers()` for expiry. Call `destroy()` in afterEach. |
| `music/providers/youtube.ts` | `parseDuration` converts ISO 8601 to ms, `getThumbnail` fallback chain (export these helpers from the module), `search` and `getTrack` with mocked fetch. Must `vi.mock("@crowd-vibe/env/server")` to provide fake env. |
| `sse/channel-manager.ts` | subscribe/unsubscribe lifecycle, broadcast reaches all writers, dead writer auto-cleaned, getListenerCount accurate, `reset()` clears all channels |

### Integration Tests

| Router | What's tested |
|---|---|
| `venue` | create succeeds, duplicate slug returns BAD_REQUEST, update own venue works, update other's venue returns NOT_FOUND, listMine returns only owned venues. **Auth rejection:** anonymous/guest calling create returns UNAUTHORIZED. |
| `session` | start creates session with valid joinCode, can't start two active sessions for same venue, end sets isActive=false and broadcasts session_ended, getByJoinCode returns venue name + listener count, getActive returns active session or null, stats returns correct counts and rejects non-owner. |
| `guest` | me returns guest record with active votes and suggestion count. **Auth rejection:** anonymous calling me returns UNAUTHORIZED. |
| `song` | search returns tracks (mocked provider), suggest creates song + auto-upvote in transaction, suggest respects cooldown, suggest respects max suggestions limit, suggest rejects duplicate providerId, owner add works, owner remove deletes and broadcasts. **Auth rejection:** anonymous calling suggest returns UNAUTHORIZED, owner calling suggest returns UNAUTHORIZED. |
| `vote` | cast upvote increments score, toggle (same value) removes vote and decrements, downvote below threshold triggers auto-skip via advanceQueue. **Auth rejection:** anonymous calling cast returns UNAUTHORIZED. |
| `queue` | list returns songs ordered by score then addedAt, list rejects cross-session guest access, nowPlaying returns currently playing song or null, next advances to highest-scored queued song, skip marks current as skipped, empty queue returns null and broadcasts null now_playing. |

### Source Modifications Required for Testing

| File | Change |
|---|---|
| `packages/db/src/index.ts` | Add Neon adapter conditional (skip adapter when `process.env.VITEST` is set) |
| `packages/api/src/music/providers/youtube.ts` | Export `parseDuration` and `getThumbnail` helper functions |
| `packages/api/src/lib/rate-limiter.ts` | Add `destroy()` method that calls `clearInterval(this.cleanupTimer)` |
| `packages/api/src/music/search-cache.ts` | Store interval handle, add `destroy()` method |
| `packages/api/src/sse/channel-manager.ts` | Add `reset()` method that clears all channels |

### Known Gaps (Deferred)

- **`createContext` function** — The security boundary (`packages/api/src/context.ts`) is not directly tested because tRPC caller factories bypass it. A future pass should add integration tests for request-to-context translation (valid/invalid/tampered cookies, Better-Auth session handling).
- **Guest join route handler** (`apps/web/src/app/api/guest/join/route.ts`) — Contains rate limiting, validation, upsert, and HMAC cookie logic. Deferred to when `apps/web` tests are set up.
- **`lib/queue-helpers.ts`** — `advanceQueue()` is tested indirectly through queue and vote router integration tests. Dedicated unit tests deferred since the function requires DB transactions.

---

## NPM Scripts

Added to root `package.json`. All test commands use `dotenv -e .env.test --` to ensure environment variables are loaded before any module imports (the `@crowd-vibe/env` package validates at import time via `createEnv`):

```json
{
  "test": "dotenv -e .env.test -- vitest run --project unit",
  "test:integration": "dotenv -e .env.test -- vitest run --project integration",
  "test:all": "dotenv -e .env.test -- vitest run",
  "test:watch": "dotenv -e .env.test -- vitest --project unit",
  "test:coverage": "dotenv -e .env.test -- vitest run --coverage",
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
