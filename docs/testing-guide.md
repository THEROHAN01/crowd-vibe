# CrowdVibe Testing Guide

How to run, write, and maintain tests for the CrowdVibe monorepo.

## Prerequisites

- **Docker** — Required for integration tests (runs PostgreSQL locally)
- **Node.js 20+** — Required for Vitest and Prisma CLI
- Dependencies installed (`npm install`)

## Quick Start

```bash
npm run test:db:up    # Start the test database (once per session)
npm test              # Run unit tests
npm run test:integration  # Run integration tests
```

## Architecture

```
vitest.config.ts                    ← Root config: defines "unit" + "integration" projects
.env.test                           ← Test environment variables (safe to commit)
docker-compose.test.yml             ← PostgreSQL 17 on port 5433

packages/api/
├── test/
│   ├── globalSetup.ts              ← Runs prisma db push --force-reset before integration suite
│   └── helpers/
│       ├── test-db.ts              ← resetDatabase() — truncates all tables
│       ├── test-context.ts         ← tRPC caller factories (owner/guest/anonymous)
│       ├── test-fixtures.ts        ← Factory functions for test data
│       └── index.ts                ← Barrel export
├── src/
│   ├── lib/
│   │   ├── cookie.test.ts          ← Unit tests
│   │   ├── rate-limiter.test.ts
│   │   ├── join-code.test.ts
│   │   └── settings.test.ts
│   ├── music/
│   │   ├── search-cache.test.ts
│   │   └── providers/youtube.test.ts
│   ├── sse/
│   │   └── channel-manager.test.ts
│   └── routers/
│       ├── venue.integration.test.ts    ← Integration tests
│       ├── session.integration.test.ts
│       ├── guest.integration.test.ts
│       ├── song.integration.test.ts
│       ├── vote.integration.test.ts
│       └── queue.integration.test.ts
```

### Two test projects

| Project | Pattern | Needs DB | Speed |
|---------|---------|----------|-------|
| `unit` | `*.test.ts` | No | ~150ms |
| `integration` | `*.integration.test.ts` | Yes (Docker Postgres) | ~3s |

## NPM Scripts

| Script | What it does |
|--------|-------------|
| `npm test` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run test:all` | Run both unit + integration |
| `npm run test:watch` | Unit tests in watch mode (for TDD) |
| `npm run test:coverage` | Run all tests with V8 coverage report |
| `npm run test:db:up` | Start Docker Postgres test container |
| `npm run test:db:down` | Stop Docker Postgres test container |
| `npm run test:db:reset` | Reset test database schema (force push) |

## TDD Workflow

This is the recommended workflow when implementing new features:

```bash
# 1. Start the test database (if not already running)
npm run test:db:up

# 2. Start watch mode
npm run test:watch

# 3. Write a failing test → implement → watch it pass → repeat

# 4. Run integration tests periodically
npm run test:integration

# 5. Stop the database when done
npm run test:db:down
```

## Writing Unit Tests

Unit tests go next to the source file: `cookie.ts` → `cookie.test.ts`.

**No database, no network, no shared state.** Use mocks for external dependencies.

### Example: Testing a pure function

```typescript
import { describe, it, expect } from "vitest";
import { generateJoinCode } from "./join-code";

describe("generateJoinCode", () => {
  it("returns a string of length 6", () => {
    expect(generateJoinCode()).toHaveLength(6);
  });
});
```

### Example: Testing with fake timers

For modules that use `setInterval` (RateLimiter, SearchCache):

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter(3, 60_000);
  });

  afterEach(() => {
    limiter.destroy();    // Clear the setInterval
    vi.useRealTimers();
  });

  it("resets after the time window expires", () => {
    limiter.check("a");
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(limiter.check("a").allowed).toBe(true);
  });
});
```

### Example: Mocking external modules

For modules that import from other packages (e.g., YouTube provider needs env):

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock BEFORE importing the module under test
vi.mock("@crowd-vibe/env/server", () => ({
  env: { YOUTUBE_API_KEY: "fake-api-key" },
}));

import { parseDuration } from "./youtube";

describe("parseDuration", () => {
  it("parses ISO 8601 duration to ms", () => {
    expect(parseDuration("PT4M30S")).toBe(270_000);
  });
});
```

### Example: Mocking fetch

```typescript
it("search returns parsed tracks", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ items: [/* ... */] }), { status: 200 }),
  );

  const result = await provider.search("test query");
  expect(result.tracks).toHaveLength(1);
});
```

## Writing Integration Tests

Integration tests go next to the router: `venue.ts` → `venue.integration.test.ts`.

**Real database, real tRPC callers, mocked external APIs (YouTube).**

### Setup pattern

Every integration test file follows this structure:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDatabase,
  createOwnerCaller,
  createGuestCaller,
  createAnonymousCaller,
  createTestUser,
  createTestVenue,
  createTestSession,
} from "../../test/helpers";
import { channelManager } from "../sse/channel-manager";

describe("my router", () => {
  beforeEach(async () => {
    await resetDatabase();         // Truncate all tables
    channelManager.reset();        // Clear SSE subscriptions
  });

  // tests go here
});
```

### Test helpers

**Caller factories** — Create tRPC callers with different auth contexts:

```typescript
// Venue owner caller
const user = await createTestUser();
const caller = createOwnerCaller(user.id);
await caller.venue.create({ name: "My Bar", slug: "my-bar" });

// Guest caller
const guest = await createTestGuest(session.id);
const caller = createGuestCaller(guest.id, session.id);
await caller.song.suggest({ providerId: "dQw4w9WgXcQ" });

// Anonymous caller (should be rejected by protected routes)
const caller = createAnonymousCaller();
await expect(caller.venue.create({ ... })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
```

**Fixture factories** — Create test data with sensible defaults:

```typescript
const user = await createTestUser();                              // Random ID, email
const venue = await createTestVenue(user.id);                     // Random slug
const session = await createTestSession(venue.id);                // Random join code
const guest = await createTestGuest(session.id);                  // Random fingerprint
const song = await createTestSong(session.id);                    // Default status: "queued"

// Override any field:
const song = await createTestSong(session.id, {
  title: "Custom Title",
  score: 10,
  status: "playing",
});
```

**Direct DB assertions** — Use `testPrisma` when you need to verify DB state beyond what the API returns:

```typescript
import { testPrisma } from "../../test/helpers";

const dbSong = await testPrisma.song.findUnique({ where: { id: song.id } });
expect(dbSong!.status).toBe("playing");
```

### Mocking the music provider

For routers that call `getMusicProvider()` (song, vote, queue), mock the module:

```typescript
import { vi } from "vitest";
import type { MusicProvider } from "../music/types";

const mockProvider: MusicProvider = {
  search: vi.fn().mockResolvedValue({ tracks: [{ providerId: "vid-1", ... }] }),
  getTrack: vi.fn().mockResolvedValue({ providerId: "vid-1", title: "Mock Song", ... }),
  getPlayerData: vi.fn().mockReturnValue({ type: "youtube", embedUrl: "...", providerId: "vid-1" }),
  validate: vi.fn().mockResolvedValue(true),
};

vi.mock("../music/index", () => ({
  getMusicProvider: () => mockProvider,
}));
```

Place `vi.mock()` **before** any imports that transitively use `getMusicProvider`.

### Testing SSE broadcasts

Subscribe a mock writer to capture broadcast events:

```typescript
const events: string[] = [];
channelManager.subscribe(session.id, {
  write: (data) => events.push(data),
  close: () => {},
});

await caller.session.end({ sessionId: session.id });

expect(events.some((e) => e.includes("session_ended"))).toBe(true);
```

### Testing auth boundaries

Always test that protected routes reject unauthorized callers:

```typescript
// Anonymous → UNAUTHORIZED
await expect(
  createAnonymousCaller().venue.create({ name: "Test", slug: "test" }),
).rejects.toMatchObject({ code: "UNAUTHORIZED" });

// Guest → UNAUTHORIZED (for owner-only routes)
await expect(
  createGuestCaller("g1", "s1").venue.create({ name: "Test", slug: "test" }),
).rejects.toMatchObject({ code: "UNAUTHORIZED" });

// Cross-session guest → FORBIDDEN
await expect(
  createGuestCaller(guest.id, otherSessionId).song.search({ sessionId: session.id, query: "test" }),
).rejects.toMatchObject({ code: "FORBIDDEN" });
```

## Test Database

The test database runs in Docker on **port 5433** (not 5432, to avoid conflicts with any local Postgres).

| Property | Value |
|----------|-------|
| Host | `localhost` |
| Port | `5433` |
| Database | `crowdvibe_test` |
| User | `test` |
| Password | `test` |
| Image | `postgres:17-alpine` |

### Safety guard

The `globalSetup.ts` validates that `DATABASE_URL` contains `crowdvibe_test` before running `prisma db push --force-reset`. If someone accidentally runs vitest without `.env.test`, it refuses to execute rather than wiping a real database.

### Data isolation

- `resetDatabase()` truncates all 9 tables between each test via `TRUNCATE ... CASCADE`
- `channelManager.reset()` clears SSE channel subscriptions
- `fileParallelism: false` ensures integration test files run sequentially (no race conditions on shared DB)

## File Naming Conventions

| Pattern | Type | Example |
|---------|------|---------|
| `*.test.ts` | Unit test | `cookie.test.ts` |
| `*.integration.test.ts` | Integration test | `venue.integration.test.ts` |

Tests live **next to** the source file they test, not in a separate `__tests__` directory.

## Adding Tests for New Features

When you add a new router or utility:

### New utility in `packages/api/src/lib/`

1. Create `my-util.test.ts` next to `my-util.ts`
2. No special setup needed — just import and test
3. Use `vi.useFakeTimers()` if your module uses timers
4. Use `vi.mock()` if your module imports external packages

### New tRPC router in `packages/api/src/routers/`

1. Create `my-router.integration.test.ts` next to `my-router.ts`
2. Follow the setup pattern (resetDatabase + channelManager.reset in beforeEach)
3. Test the happy path, error cases, and auth boundaries
4. Mock `getMusicProvider` if the router calls it
5. Use `testPrisma` for direct DB state verification
6. Test SSE broadcasts if the router uses `channelManager.broadcast`

### Checklist for every new router test

- [ ] Happy path (create/read/update/delete works)
- [ ] Error cases (duplicate data, not found, bad input)
- [ ] Auth rejection (anonymous, wrong role, cross-session)
- [ ] Side effects verified (DB state, SSE broadcasts)
- [ ] Cleanup in `beforeEach` (resetDatabase + channelManager.reset)

## Troubleshooting

### Tests hang and never finish

Likely cause: a `setInterval` timer without `.unref()`. If you add a class with periodic cleanup, store the timer handle and call `.unref()` on it:

```typescript
this.cleanupTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
this.cleanupTimer.unref();
```

Also add a `destroy()` method and call it in `afterEach`.

### Integration tests fail with "connection refused"

The Docker test database isn't running. Start it:

```bash
npm run test:db:up
```

### "DATABASE_URL does not point to the test database"

You're running vitest directly without loading `.env.test`. Always use the npm scripts:

```bash
npm test                     # not: npx vitest
npm run test:integration     # not: npx vitest --project integration
```

### Prisma schema out of sync

If you changed the Prisma schema, reset the test database:

```bash
npm run test:db:reset
```

### "Module not found" for `@crowd-vibe/*` packages

Run `npm install` from the repository root. The monorepo workspace links need to be set up.
