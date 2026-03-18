# CrowdVibe Test Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete test infrastructure (unit + integration) for the CrowdVibe MVP using Vitest and Docker Postgres, enabling TDD for all future development.

**Architecture:** Vitest 3.x in workspace mode with two projects (unit/integration). Unit tests run against pure logic with mocked externals. Integration tests hit a real Docker Postgres via tRPC caller factories, with table truncation between tests for isolation. The Neon adapter is conditionally bypassed in test mode so routers connect to local Postgres.

**Tech Stack:** Vitest 3.x, Docker Compose, PostgreSQL 17, Prisma 7.x, tRPC 11.x, dotenv-cli

**Spec:** `docs/superpowers/specs/2026-03-17-crowdvibe-test-infra-design.md`

---

## File Map

### Files to CREATE

| File | Responsibility |
|------|----------------|
| `docker-compose.test.yml` | Postgres test container (port 5433) |
| `.env.test` | Test environment variables |
| `vitest.config.ts` | Vitest config with unit + integration projects |
| `packages/api/test/globalSetup.ts` | Safety-guarded `prisma db push --force-reset` |
| `packages/api/test/helpers/test-db.ts` | `resetDatabase()` — TRUNCATE all 9 tables |
| `packages/api/test/helpers/test-context.ts` | tRPC caller factories (owner/guest/anonymous) |
| `packages/api/test/helpers/test-fixtures.ts` | Factory functions for test data |
| `packages/api/test/helpers/index.ts` | Barrel export |
| `packages/api/src/lib/cookie.test.ts` | Unit tests for HMAC cookie signing |
| `packages/api/src/lib/rate-limiter.test.ts` | Unit tests for rate limiter |
| `packages/api/src/lib/join-code.test.ts` | Unit tests for join code generation |
| `packages/api/src/lib/settings.test.ts` | Unit tests for venue settings parsing |
| `packages/api/src/music/search-cache.test.ts` | Unit tests for search cache |
| `packages/api/src/music/providers/youtube.test.ts` | Unit tests for YouTube provider |
| `packages/api/src/sse/channel-manager.test.ts` | Unit tests for SSE channel manager |
| `packages/api/src/routers/venue.integration.test.ts` | Integration tests for venue router |
| `packages/api/src/routers/session.integration.test.ts` | Integration tests for session router |
| `packages/api/src/routers/guest.integration.test.ts` | Integration tests for guest router |
| `packages/api/src/routers/song.integration.test.ts` | Integration tests for song router |
| `packages/api/src/routers/vote.integration.test.ts` | Integration tests for vote router |
| `packages/api/src/routers/queue.integration.test.ts` | Integration tests for queue router |

### Files to MODIFY

| File | Change |
|------|--------|
| `package.json` | Add test scripts + devDependencies |
| `packages/db/prisma/schema/schema.prisma` | Add `url = env("DATABASE_URL")` to datasource |
| `packages/db/src/index.ts` | Conditional Neon adapter bypass in test mode |
| `packages/api/src/lib/rate-limiter.ts` | Store interval handle, add `destroy()` |
| `packages/api/src/music/search-cache.ts` | Store interval handle, add `destroy()` |
| `packages/api/src/music/providers/youtube.ts` | Export `parseDuration` and `getThumbnail` |
| `packages/api/src/sse/channel-manager.ts` | Add `reset()` method |

---

### Task 1: Install dependencies and add NPM scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install devDependencies**

```bash
npm install --save-dev vitest @vitest/coverage-v8 dotenv-cli
```

- [ ] **Step 2: Add test scripts to root package.json**

Add these scripts to the `"scripts"` object in `package.json`:

```json
"test": "dotenv -e .env.test -- vitest run --project unit",
"test:integration": "dotenv -e .env.test -- vitest run --project integration",
"test:all": "dotenv -e .env.test -- vitest run",
"test:watch": "dotenv -e .env.test -- vitest --project unit",
"test:coverage": "dotenv -e .env.test -- vitest run --coverage",
"test:db:up": "docker compose -f docker-compose.test.yml up -d --wait",
"test:db:down": "docker compose -f docker-compose.test.yml down",
"test:db:reset": "dotenv -e .env.test -- npx prisma db push --force-reset --schema=packages/db/prisma/schema"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest, coverage, and dotenv-cli devDependencies + test scripts"
```

---

### Task 2: Create Docker, env, and Vitest config files

**Files:**
- Create: `docker-compose.test.yml`
- Create: `.env.test`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `docker-compose.test.yml`**

```yaml
services:
  postgres-test:
    image: postgres:17-alpine
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: crowdvibe_test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d crowdvibe_test"]
      interval: 2s
      timeout: 5s
      retries: 10
```

- [ ] **Step 2: Create `.env.test`**

```
DATABASE_URL=postgresql://test:test@localhost:5433/crowdvibe_test
BETTER_AUTH_SECRET=test-secret-that-is-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3001
YOUTUBE_API_KEY=test-youtube-api-key
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
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
        },
      },
    ],
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.test.yml .env.test vitest.config.ts
git commit -m "chore: add Docker test DB, .env.test, and Vitest config"
```

---

### Task 3: Modify source files for testability

**Files:**
- Modify: `packages/db/prisma/schema/schema.prisma`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/api/src/lib/rate-limiter.ts`
- Modify: `packages/api/src/music/search-cache.ts`
- Modify: `packages/api/src/music/providers/youtube.ts`
- Modify: `packages/api/src/sse/channel-manager.ts`

- [ ] **Step 1: Add `url` to Prisma datasource**

In `packages/db/prisma/schema/schema.prisma`, change the datasource block from:

```prisma
datasource db {
  provider = "postgresql"
}
```

to:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 2: Add Neon adapter conditional to `packages/db/src/index.ts`**

Replace the entire file contents with:

```typescript
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../prisma/generated/client";
import { env } from "@crowd-vibe/env/server";

let prisma: PrismaClient;

if (process.env.VITEST) {
  prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
} else {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  prisma = new PrismaClient({ adapter });
}

export default prisma;
```

- [ ] **Step 3: Add `destroy()` to RateLimiter in `packages/api/src/lib/rate-limiter.ts`**

Store the interval handle and add the destroy method. The constructor's `setInterval` line changes from:

```typescript
    setInterval(() => this.sweep(), 5 * 60 * 1000);
```

to:

```typescript
    this.cleanupTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
```

Add the field and method to the class:

```typescript
export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  // ... constructor stays the same except storing the handle as above ...

  destroy() {
    clearInterval(this.cleanupTimer);
  }

  // ... check() and sweep() stay the same ...
}
```

- [ ] **Step 4: Add `destroy()` to SearchCache in `packages/api/src/music/search-cache.ts`**

Same pattern as RateLimiter. Store the interval handle and add `destroy()`:

```typescript
export class SearchCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private ttlMs: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(ttlMinutes: number = 15) {
    this.ttlMs = ttlMinutes * 60 * 1000;
    this.cleanupTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
  }

  destroy() {
    clearInterval(this.cleanupTimer);
  }

  // ... rest stays the same ...
}
```

- [ ] **Step 5: Export helpers from `packages/api/src/music/providers/youtube.ts`**

Change `function parseDuration` to `export function parseDuration` (line 35).
Change `function getThumbnail` to `export function getThumbnail` (line 44).

- [ ] **Step 6: Add `reset()` to SSEChannelManager in `packages/api/src/sse/channel-manager.ts`**

Add this method to the `SSEChannelManager` class, after `getListenerCount`:

```typescript
  reset() {
    for (const channel of this.channels.values()) {
      for (const writer of channel) {
        try {
          writer.close();
        } catch {
          // Writer already closed
        }
      }
    }
    this.channels.clear();
  }
```

- [ ] **Step 7: Regenerate Prisma client (needed after schema change)**

```bash
npx dotenv -e .env.test -- npx prisma generate --schema=packages/db/prisma/schema
```

- [ ] **Step 8: Commit**

```bash
git add packages/db/prisma/schema/schema.prisma packages/db/src/index.ts packages/api/src/lib/rate-limiter.ts packages/api/src/music/search-cache.ts packages/api/src/music/providers/youtube.ts packages/api/src/sse/channel-manager.ts
git commit -m "refactor: add testability hooks (Neon conditional, destroy/reset methods, export helpers)"
```

---

### Task 4: Create test helpers

**Files:**
- Create: `packages/api/test/globalSetup.ts`
- Create: `packages/api/test/helpers/test-db.ts`
- Create: `packages/api/test/helpers/test-context.ts`
- Create: `packages/api/test/helpers/test-fixtures.ts`
- Create: `packages/api/test/helpers/index.ts`

- [ ] **Step 1: Create `packages/api/test/globalSetup.ts`**

```typescript
import { execFileSync } from "node:child_process";

export function setup() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("crowdvibe_test")) {
    throw new Error(
      `globalSetup: DATABASE_URL does not point to the test database.\n` +
        `Got: ${url}\n` +
        `Run tests via npm scripts (which load .env.test), not vitest directly.`,
    );
  }

  execFileSync(
    "npx",
    ["prisma", "db", "push", "--force-reset", "--schema=packages/db/prisma/schema"],
    { stdio: "inherit" },
  );
}
```

- [ ] **Step 2: Create `packages/api/test/helpers/test-db.ts`**

```typescript
import prisma from "@crowd-vibe/db";

export { prisma as testPrisma };

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE vote, song, guest_user, venue_session, venue, account, session, verification, "user" CASCADE`,
  );
}
```

- [ ] **Step 3: Create `packages/api/test/helpers/test-context.ts`**

```typescript
import { t } from "../../src/index";
import { appRouter } from "../../src/routers/index";

const createCaller = t.createCallerFactory(appRouter);

export function createOwnerCaller(userId?: string) {
  return createCaller({
    type: "owner" as const,
    user: {
      id: userId ?? crypto.randomUUID(),
      name: "Test Owner",
      email: "owner@test.com",
    },
  });
}

export function createGuestCaller(guestId: string, sessionId: string) {
  return createCaller({
    type: "guest" as const,
    guestId,
    guestSessionId: sessionId,
  });
}

export function createAnonymousCaller() {
  return createCaller({ type: "anonymous" as const });
}
```

- [ ] **Step 4: Create `packages/api/test/helpers/test-fixtures.ts`**

```typescript
import prisma from "@crowd-vibe/db";
import { generateJoinCode } from "../../src/lib/join-code";

let counter = 0;

export async function createTestUser(overrides?: Partial<Parameters<typeof prisma.user.create>[0]["data"]>) {
  counter++;
  return prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: "Test User",
      email: `test-${counter}@example.com`,
      ...overrides,
    },
  });
}

export async function createTestVenue(
  ownerId: string,
  overrides?: Partial<Parameters<typeof prisma.venue.create>[0]["data"]>,
) {
  const suffix = crypto.randomUUID().slice(0, 8);
  return prisma.venue.create({
    data: {
      name: "Test Venue",
      slug: `test-venue-${suffix}`,
      ownerId,
      ...overrides,
    },
  });
}

export async function createTestSession(
  venueId: string,
  overrides?: Partial<Parameters<typeof prisma.venueSession.create>[0]["data"]>,
) {
  return prisma.venueSession.create({
    data: {
      venueId,
      joinCode: generateJoinCode(),
      ...overrides,
    },
  });
}

export async function createTestGuest(
  sessionId: string,
  overrides?: Partial<Parameters<typeof prisma.guestUser.create>[0]["data"]>,
) {
  return prisma.guestUser.create({
    data: {
      sessionId,
      fingerprint: crypto.randomUUID(),
      ...overrides,
    },
  });
}

export async function createTestSong(
  sessionId: string,
  overrides?: Partial<Parameters<typeof prisma.song.create>[0]["data"]>,
) {
  const suffix = crypto.randomUUID().slice(0, 8);
  return prisma.song.create({
    data: {
      sessionId,
      providerId: `test-video-${suffix}`,
      provider: "youtube",
      title: "Test Song",
      status: "queued",
      ...overrides,
    },
  });
}
```

- [ ] **Step 5: Create `packages/api/test/helpers/index.ts`**

```typescript
export { testPrisma, resetDatabase } from "./test-db";
export { createOwnerCaller, createGuestCaller, createAnonymousCaller } from "./test-context";
export {
  createTestUser,
  createTestVenue,
  createTestSession,
  createTestGuest,
  createTestSong,
} from "./test-fixtures";
```

- [ ] **Step 6: Commit**

```bash
git add packages/api/test/
git commit -m "test: add test helpers (globalSetup, resetDatabase, caller factories, fixtures)"
```

---

### Task 5: Unit tests — `lib/cookie.ts`

**Files:**
- Create: `packages/api/src/lib/cookie.test.ts`
- Test: `packages/api/src/lib/cookie.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect } from "vitest";
import { signCookie, verifySignedCookie } from "./cookie";

describe("signCookie / verifySignedCookie", () => {
  const secret = "test-secret-32-chars-long-minimum";

  it("round-trips: sign then verify returns original value", () => {
    const signed = signCookie("guest-123", secret);
    expect(verifySignedCookie(signed, secret)).toBe("guest-123");
  });

  it("rejects tampered signature", () => {
    const signed = signCookie("guest-123", secret);
    const tampered = `${signed}x`;
    expect(verifySignedCookie(tampered, secret)).toBeNull();
  });

  it("rejects tampered value", () => {
    const signed = signCookie("guest-123", secret);
    const tampered = `guest-456${signed.slice(signed.lastIndexOf("."))}`;
    expect(verifySignedCookie(tampered, secret)).toBeNull();
  });

  it("returns null for input without a dot separator", () => {
    expect(verifySignedCookie("no-dot-here", secret)).toBeNull();
  });

  it("returns null for wrong secret", () => {
    const signed = signCookie("guest-123", secret);
    expect(verifySignedCookie(signed, "different-secret")).toBeNull();
  });

  it("handles values that contain dots", () => {
    const signed = signCookie("a.b.c", secret);
    expect(verifySignedCookie(signed, secret)).toBe("a.b.c");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm test -- --reporter=verbose 2>&1 | head -30
```

Expected: All 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/cookie.test.ts
git commit -m "test: add unit tests for cookie sign/verify"
```

---

### Task 6: Unit tests — `lib/rate-limiter.ts`

**Files:**
- Create: `packages/api/src/lib/rate-limiter.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter(3, 60_000); // 3 requests per 60s
  });

  afterEach(() => {
    limiter.destroy();
    vi.useRealTimers();
  });

  it("allows requests up to max", () => {
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("blocks after max is reached", () => {
    limiter.check("a");
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("a").remaining).toBe(0);
  });

  it("tracks remaining count correctly", () => {
    expect(limiter.check("a").remaining).toBe(2);
    expect(limiter.check("a").remaining).toBe(1);
    expect(limiter.check("a").remaining).toBe(0);
  });

  it("resets after the time window expires", () => {
    limiter.check("a");
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(limiter.check("a").allowed).toBe(true);
  });

  it("isolates keys from each other", () => {
    limiter.check("a");
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("sweep cleans expired entries", () => {
    limiter.check("a");
    vi.advanceTimersByTime(60_001);
    // Trigger sweep interval (5 minutes)
    vi.advanceTimersByTime(5 * 60 * 1000);
    // After sweep, "a" should be cleaned — new request gets full remaining
    expect(limiter.check("a").remaining).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm test -- --reporter=verbose 2>&1 | head -30
```

Expected: All 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/rate-limiter.test.ts
git commit -m "test: add unit tests for rate limiter"
```

---

### Task 7: Unit tests — `lib/join-code.ts`

**Files:**
- Create: `packages/api/src/lib/join-code.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect } from "vitest";
import { generateJoinCode } from "./join-code";

const VALID_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const AMBIGUOUS = ["O", "0", "I", "1", "L"];

describe("generateJoinCode", () => {
  it("returns a string of length 6", () => {
    expect(generateJoinCode()).toHaveLength(6);
  });

  it("uses only valid charset characters", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode();
      for (const char of code) {
        expect(VALID_CHARS).toContain(char);
      }
    }
  });

  it("does not contain ambiguous characters", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode();
      for (const char of AMBIGUOUS) {
        expect(code).not.toContain(char);
      }
    }
  });

  it("generates different codes on successive calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(generateJoinCode());
    }
    // With 30^6 possible codes, 50 calls should all be unique
    expect(codes.size).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm test -- --reporter=verbose 2>&1 | head -20
```

Expected: All 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/join-code.test.ts
git commit -m "test: add unit tests for join code generation"
```

---

### Task 8: Unit tests — `lib/settings.ts`

**Files:**
- Create: `packages/api/src/lib/settings.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect } from "vitest";
import { parseVenueSettings } from "./settings";

describe("parseVenueSettings", () => {
  it("returns defaults for empty input", () => {
    const result = parseVenueSettings({});
    expect(result).toEqual({
      maxSuggestionsPerGuest: 5,
      suggestionCooldownSec: 30,
      downvoteSkipThreshold: -3,
      allowExplicitContent: true,
    });
  });

  it("returns defaults for null input", () => {
    const result = parseVenueSettings(null);
    expect(result).toEqual({
      maxSuggestionsPerGuest: 5,
      suggestionCooldownSec: 30,
      downvoteSkipThreshold: -3,
      allowExplicitContent: true,
    });
  });

  it("applies partial overrides", () => {
    const result = parseVenueSettings({ maxSuggestionsPerGuest: 10 });
    expect(result.maxSuggestionsPerGuest).toBe(10);
    expect(result.suggestionCooldownSec).toBe(30); // default
  });

  it("falls back to defaults for invalid input", () => {
    const result = parseVenueSettings("not an object");
    expect(result).toEqual({
      maxSuggestionsPerGuest: 5,
      suggestionCooldownSec: 30,
      downvoteSkipThreshold: -3,
      allowExplicitContent: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm test -- --reporter=verbose 2>&1 | head -20
```

Expected: All 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/lib/settings.test.ts
git commit -m "test: add unit tests for venue settings parsing"
```

---

### Task 9: Unit tests — `music/search-cache.ts`

**Files:**
- Create: `packages/api/src/music/search-cache.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SearchCache } from "./search-cache";

describe("SearchCache", () => {
  let cache: SearchCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new SearchCache(15); // 15 minute TTL
  });

  afterEach(() => {
    cache.destroy();
    vi.useRealTimers();
  });

  it("returns null for missing key", () => {
    expect(cache.get("missing")).toBeNull();
  });

  it("round-trips set/get", () => {
    cache.set("key", { tracks: [] });
    expect(cache.get("key")).toEqual({ tracks: [] });
  });

  it("returns null after TTL expires", () => {
    cache.set("key", { data: 1 });
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(cache.get("key")).toBeNull();
  });

  it("returns data before TTL expires", () => {
    cache.set("key", { data: 1 });
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(cache.get("key")).toEqual({ data: 1 });
  });

  it("makeKey normalizes case and whitespace", () => {
    expect(cache.makeKey("youtube", "  Hello World  ")).toBe("youtube:hello world");
  });

  it("makeKey treats different providers as different keys", () => {
    const a = cache.makeKey("youtube", "test");
    const b = cache.makeKey("spotify", "test");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm test -- --reporter=verbose 2>&1 | head -20
```

Expected: All 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/music/search-cache.test.ts
git commit -m "test: add unit tests for search cache"
```

---

### Task 10: Unit tests — `music/providers/youtube.ts`

**Files:**
- Create: `packages/api/src/music/providers/youtube.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the env module before importing YouTube provider
vi.mock("@crowd-vibe/env/server", () => ({
  env: { YOUTUBE_API_KEY: "fake-api-key" },
}));

import { parseDuration, getThumbnail } from "./youtube";
import { YouTubeProvider } from "./youtube";

describe("parseDuration", () => {
  it("parses hours, minutes, seconds", () => {
    expect(parseDuration("PT1H2M30S")).toBe(3_750_000);
  });

  it("parses minutes and seconds only", () => {
    expect(parseDuration("PT4M30S")).toBe(270_000);
  });

  it("parses seconds only", () => {
    expect(parseDuration("PT45S")).toBe(45_000);
  });

  it("returns 0 for invalid format", () => {
    expect(parseDuration("invalid")).toBe(0);
  });

  it("parses hours only", () => {
    expect(parseDuration("PT2H")).toBe(7_200_000);
  });
});

describe("getThumbnail", () => {
  it("prefers high quality", () => {
    expect(
      getThumbnail({
        high: { url: "high.jpg" },
        medium: { url: "med.jpg" },
        default: { url: "def.jpg" },
      }),
    ).toBe("high.jpg");
  });

  it("falls back to medium", () => {
    expect(
      getThumbnail({
        medium: { url: "med.jpg" },
        default: { url: "def.jpg" },
      }),
    ).toBe("med.jpg");
  });

  it("falls back to default", () => {
    expect(getThumbnail({ default: { url: "def.jpg" } })).toBe("def.jpg");
  });

  it("returns null when no thumbnails", () => {
    expect(getThumbnail({})).toBeNull();
  });
});

describe("YouTubeProvider", () => {
  let provider: YouTubeProvider;

  beforeEach(() => {
    provider = new YouTubeProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("search returns parsed tracks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: { videoId: "abc123" },
              snippet: {
                title: "Test Song",
                channelTitle: "Test Artist",
                thumbnails: { high: { url: "thumb.jpg" } },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await provider.search("test query");
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      providerId: "abc123",
      provider: "youtube",
      title: "Test Song",
      artist: "Test Artist",
      thumbnailUrl: "thumb.jpg",
    });
  });

  it("search throws on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Quota exceeded", { status: 403 }),
    );

    await expect(provider.search("test")).rejects.toThrow("YouTube API error: 403");
  });

  it("getTrack returns track with duration", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "abc123",
              snippet: {
                title: "Test Song",
                channelTitle: "Test Artist",
                thumbnails: { high: { url: "thumb.jpg" } },
              },
              contentDetails: { duration: "PT3M45S" },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const track = await provider.getTrack("abc123");
    expect(track).toMatchObject({
      providerId: "abc123",
      title: "Test Song",
      durationMs: 225_000,
    });
  });

  it("getTrack returns null on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Not Found", { status: 404 }),
    );

    expect(await provider.getTrack("nonexistent")).toBeNull();
  });

  it("getPlayerData returns embed URL", () => {
    const data = provider.getPlayerData("abc123");
    expect(data).toEqual({
      type: "youtube",
      embedUrl: "https://www.youtube.com/embed/abc123?autoplay=1&enablejsapi=1",
      providerId: "abc123",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm test -- --reporter=verbose 2>&1 | head -40
```

Expected: All 14 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/music/providers/youtube.test.ts
git commit -m "test: add unit tests for YouTube provider"
```

---

### Task 11: Unit tests — `sse/channel-manager.ts`

**Files:**
- Create: `packages/api/src/sse/channel-manager.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { channelManager } from "./channel-manager";

function createMockWriter() {
  const messages: string[] = [];
  let closed = false;
  return {
    writer: {
      write: (data: string) => {
        if (closed) throw new Error("Writer closed");
        messages.push(data);
      },
      close: () => {
        closed = true;
      },
    },
    messages,
    get closed() {
      return closed;
    },
  };
}

describe("SSEChannelManager", () => {
  beforeEach(() => {
    channelManager.reset();
  });

  it("subscribe and broadcast reaches writer", () => {
    const mock = createMockWriter();
    channelManager.subscribe("session-1", mock.writer);
    channelManager.broadcast("session-1", { type: "vote_changed", data: { songId: "s1", score: 5 } });

    expect(mock.messages).toHaveLength(1);
    expect(mock.messages[0]).toContain("event: vote_changed");
    expect(mock.messages[0]).toContain('"songId":"s1"');
  });

  it("broadcast to non-existent channel is a no-op", () => {
    channelManager.broadcast("no-channel", { type: "session_ended", data: {} });
    // No error thrown
  });

  it("unsubscribe stops delivery", () => {
    const mock = createMockWriter();
    channelManager.subscribe("session-1", mock.writer);
    channelManager.unsubscribe("session-1", mock.writer);
    channelManager.broadcast("session-1", { type: "session_ended", data: {} });

    expect(mock.messages).toHaveLength(0);
  });

  it("dead writer is auto-cleaned on broadcast", () => {
    const dead = createMockWriter();
    dead.writer.close(); // Pre-close so write() throws
    const alive = createMockWriter();

    channelManager.subscribe("session-1", dead.writer);
    channelManager.subscribe("session-1", alive.writer);
    channelManager.broadcast("session-1", { type: "session_ended", data: {} });

    expect(alive.messages).toHaveLength(1);
    expect(channelManager.getListenerCount("session-1")).toBe(1);
  });

  it("getListenerCount returns correct count", () => {
    expect(channelManager.getListenerCount("session-1")).toBe(0);

    const m1 = createMockWriter();
    const m2 = createMockWriter();
    channelManager.subscribe("session-1", m1.writer);
    channelManager.subscribe("session-1", m2.writer);

    expect(channelManager.getListenerCount("session-1")).toBe(2);
  });

  it("channels are isolated", () => {
    const mock1 = createMockWriter();
    const mock2 = createMockWriter();
    channelManager.subscribe("session-1", mock1.writer);
    channelManager.subscribe("session-2", mock2.writer);

    channelManager.broadcast("session-1", { type: "session_ended", data: {} });

    expect(mock1.messages).toHaveLength(1);
    expect(mock2.messages).toHaveLength(0);
  });

  it("reset clears all channels and closes writers", () => {
    const mock = createMockWriter();
    channelManager.subscribe("session-1", mock.writer);

    channelManager.reset();

    expect(channelManager.getListenerCount("session-1")).toBe(0);
    expect(mock.closed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm test -- --reporter=verbose 2>&1 | head -30
```

Expected: All 7 tests PASS.

- [ ] **Step 3: Run full unit suite to verify nothing is broken**

```bash
npm test 2>&1 | tail -10
```

Expected: All unit tests pass (cookie, rate-limiter, join-code, settings, search-cache, youtube, channel-manager).

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/sse/channel-manager.test.ts
git commit -m "test: add unit tests for SSE channel manager"
```

---

### Task 12: Integration test — venue router

**Files:**
- Create: `packages/api/src/routers/venue.integration.test.ts`

**Prerequisites:** Docker test DB must be running (`npm run test:db:up`).

- [ ] **Step 1: Start the test database (if not already running)**

```bash
npm run test:db:up
```

- [ ] **Step 2: Write the tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDatabase,
  createOwnerCaller,
  createGuestCaller,
  createAnonymousCaller,
  createTestUser,
  createTestVenue,
} from "../../../test/helpers";

describe("venue router", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe("create", () => {
    it("creates a venue for the owner", async () => {
      const user = await createTestUser();
      const caller = createOwnerCaller(user.id);

      const venue = await caller.venue.create({
        name: "My Bar",
        slug: "my-bar",
        description: "A cool place",
      });

      expect(venue.name).toBe("My Bar");
      expect(venue.slug).toBe("my-bar");
      expect(venue.ownerId).toBe(user.id);
    });

    it("rejects duplicate slug with BAD_REQUEST", async () => {
      const user = await createTestUser();
      const caller = createOwnerCaller(user.id);

      await caller.venue.create({ name: "First", slug: "taken-slug" });

      await expect(
        caller.venue.create({ name: "Second", slug: "taken-slug" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects anonymous caller with UNAUTHORIZED", async () => {
      const caller = createAnonymousCaller();
      await expect(
        caller.venue.create({ name: "Test", slug: "test" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects guest caller with UNAUTHORIZED", async () => {
      const caller = createGuestCaller("guest-1", "session-1");
      await expect(
        caller.venue.create({ name: "Test", slug: "test" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("update", () => {
    it("updates own venue", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const caller = createOwnerCaller(user.id);

      const updated = await caller.venue.update({
        id: venue.id,
        name: "New Name",
      });

      expect(updated.name).toBe("New Name");
    });

    it("rejects updating another owner's venue with NOT_FOUND", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const venue = await createTestVenue(owner.id);
      const caller = createOwnerCaller(other.id);

      await expect(
        caller.venue.update({ id: venue.id, name: "Hijacked" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("getBySlug", () => {
    it("returns venue data for existing slug", async () => {
      const user = await createTestUser();
      await createTestVenue(user.id, { slug: "cool-bar" });
      const caller = createAnonymousCaller();

      const venue = await caller.venue.getBySlug({ slug: "cool-bar" });

      expect(venue).not.toBeNull();
      expect(venue!.slug).toBe("cool-bar");
    });

    it("returns null for non-existent slug", async () => {
      const caller = createAnonymousCaller();
      const venue = await caller.venue.getBySlug({ slug: "no-such-venue" });
      expect(venue).toBeNull();
    });
  });

  describe("listMine", () => {
    it("returns only venues owned by the caller", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      await createTestVenue(owner.id, { name: "Mine" });
      await createTestVenue(other.id, { name: "Theirs" });

      const caller = createOwnerCaller(owner.id);
      const venues = await caller.venue.listMine();

      expect(venues).toHaveLength(1);
      expect(venues[0].name).toBe("Mine");
    });
  });
});
```

- [ ] **Step 3: Run integration tests**

```bash
npm run test:integration -- --reporter=verbose 2>&1 | head -40
```

Expected: All venue tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routers/venue.integration.test.ts
git commit -m "test: add integration tests for venue router"
```

---

### Task 13: Integration test — session router

**Files:**
- Create: `packages/api/src/routers/session.integration.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDatabase,
  createOwnerCaller,
  createAnonymousCaller,
  createTestUser,
  createTestVenue,
  createTestSession,
  createTestGuest,
  createTestSong,
  testPrisma,
} from "../../../test/helpers";
import { channelManager } from "../../sse/channel-manager";

describe("session router", () => {
  beforeEach(async () => {
    await resetDatabase();
    channelManager.reset();
  });

  describe("start", () => {
    it("creates a session with a valid join code", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const caller = createOwnerCaller(user.id);

      const session = await caller.session.start({ venueId: venue.id });

      expect(session.joinCode).toHaveLength(6);
      expect(session.isActive).toBe(true);
      expect(session.venueId).toBe(venue.id);
    });

    it("rejects non-owner with NOT_FOUND", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const venue = await createTestVenue(owner.id);
      const caller = createOwnerCaller(other.id);

      await expect(
        caller.session.start({ venueId: venue.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("rejects starting a second active session", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const caller = createOwnerCaller(user.id);

      await caller.session.start({ venueId: venue.id });

      await expect(
        caller.session.start({ venueId: venue.id }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("end", () => {
    it("deactivates session and broadcasts session_ended", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const caller = createOwnerCaller(user.id);

      const events: string[] = [];
      const writer = {
        write: (data: string) => events.push(data),
        close: () => {},
      };
      channelManager.subscribe(session.id, writer);

      await caller.session.end({ sessionId: session.id });

      // Verify DB state
      const updated = await testPrisma.venueSession.findUnique({ where: { id: session.id } });
      expect(updated!.isActive).toBe(false);
      expect(updated!.endedAt).not.toBeNull();

      // Verify broadcast
      expect(events.some((e) => e.includes("session_ended"))).toBe(true);
    });
  });

  describe("getByJoinCode", () => {
    it("returns venue name and listener count", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id, { name: "Cool Bar" });
      const session = await createTestSession(venue.id);
      const caller = createAnonymousCaller();

      const result = await caller.session.getByJoinCode({ joinCode: session.joinCode });

      expect(result.venueName).toBe("Cool Bar");
      expect(result.listenerCount).toBe(0);
    });

    it("rejects invalid join code with NOT_FOUND", async () => {
      const caller = createAnonymousCaller();
      await expect(
        caller.session.getByJoinCode({ joinCode: "ZZZZZZ" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("getActive", () => {
    it("returns the active session for a venue", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const caller = createAnonymousCaller();

      const result = await caller.session.getActive({ venueId: venue.id });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(session.id);
    });

    it("returns null when no active session", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const caller = createAnonymousCaller();

      const result = await caller.session.getActive({ venueId: venue.id });
      expect(result).toBeNull();
    });
  });

  describe("stats", () => {
    it("returns correct counts", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      await createTestGuest(session.id);
      await createTestGuest(session.id);
      await createTestSong(session.id, { status: "played" });
      await createTestSong(session.id, { status: "queued" });
      const caller = createOwnerCaller(user.id);

      const stats = await caller.session.stats({ sessionId: session.id });

      expect(stats.guestCount).toBe(2);
      expect(stats.totalSongs).toBe(2);
      expect(stats.songsPlayed).toBe(1);
    });

    it("rejects non-owner with NOT_FOUND", async () => {
      const owner = await createTestUser();
      const other = await createTestUser();
      const venue = await createTestVenue(owner.id);
      const session = await createTestSession(venue.id);
      const caller = createOwnerCaller(other.id);

      await expect(
        caller.session.stats({ sessionId: session.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npm run test:integration -- --reporter=verbose 2>&1 | head -50
```

Expected: All session tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/session.integration.test.ts
git commit -m "test: add integration tests for session router"
```

---

### Task 14: Integration test — guest router

**Files:**
- Create: `packages/api/src/routers/guest.integration.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDatabase,
  createGuestCaller,
  createAnonymousCaller,
  createTestUser,
  createTestVenue,
  createTestSession,
  createTestGuest,
  createTestSong,
  testPrisma,
} from "../../../test/helpers";

describe("guest router", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe("me", () => {
    it("returns guest record with votes and suggestion count", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id, { displayName: "DJ Fan" });
      const song = await createTestSong(session.id, { suggestedById: guest.id });

      // Create a vote
      await testPrisma.vote.create({
        data: { songId: song.id, guestId: guest.id, value: 1 },
      });

      const caller = createGuestCaller(guest.id, session.id);
      const me = await caller.guest.me();

      expect(me).not.toBeNull();
      expect(me!.displayName).toBe("DJ Fan");
      expect(me!.votes).toHaveLength(1);
      expect(me!._count.suggestions).toBe(1);
    });

    it("rejects anonymous caller with UNAUTHORIZED", async () => {
      const caller = createAnonymousCaller();
      await expect(caller.guest.me()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npm run test:integration -- --reporter=verbose 2>&1 | head -20
```

Expected: All guest tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/guest.integration.test.ts
git commit -m "test: add integration tests for guest router"
```

---

### Task 15: Integration test — song router

**Files:**
- Create: `packages/api/src/routers/song.integration.test.ts`

- [ ] **Step 1: Write the tests**

The song router requires mocking `getMusicProvider`. Integration tests mock the music module so no real YouTube API calls are made.

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { MusicProvider, MusicTrack, SearchResult, PlayerData } from "../../music/types";

// Mock the music provider module
const mockProvider: MusicProvider = {
  search: vi.fn<MusicProvider["search"]>().mockResolvedValue({
    tracks: [
      {
        providerId: "vid-1",
        provider: "youtube",
        title: "Mock Song",
        artist: "Mock Artist",
        thumbnailUrl: "mock-thumb.jpg",
        durationMs: 200_000,
      },
    ],
  }),
  getTrack: vi.fn<MusicProvider["getTrack"]>().mockResolvedValue({
    providerId: "vid-1",
    provider: "youtube",
    title: "Mock Song",
    artist: "Mock Artist",
    thumbnailUrl: "mock-thumb.jpg",
    durationMs: 200_000,
  }),
  getPlayerData: vi.fn<MusicProvider["getPlayerData"]>().mockReturnValue({
    type: "youtube",
    embedUrl: "https://youtube.com/embed/vid-1",
    providerId: "vid-1",
  }),
  validate: vi.fn<MusicProvider["validate"]>().mockResolvedValue(true),
};

vi.mock("../../music/index", () => ({
  getMusicProvider: () => mockProvider,
}));

import {
  resetDatabase,
  createOwnerCaller,
  createGuestCaller,
  createAnonymousCaller,
  createTestUser,
  createTestVenue,
  createTestSession,
  createTestGuest,
  createTestSong,
  testPrisma,
} from "../../../test/helpers";
import { channelManager } from "../../sse/channel-manager";

describe("song router", () => {
  beforeEach(async () => {
    await resetDatabase();
    channelManager.reset();
    vi.clearAllMocks();
  });

  describe("search", () => {
    it("returns tracks from mocked provider", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);
      const caller = createGuestCaller(guest.id, session.id);

      const result = await caller.song.search({
        sessionId: session.id,
        query: "test song",
      });

      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0].title).toBe("Mock Song");
    });

    it("rejects anonymous caller with UNAUTHORIZED", async () => {
      const caller = createAnonymousCaller();
      await expect(
        caller.song.search({ sessionId: "any", query: "test" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects cross-session guest with FORBIDDEN", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const otherSession = await createTestSession(venue.id, { isActive: false });
      const guest = await createTestGuest(otherSession.id);
      const caller = createGuestCaller(guest.id, otherSession.id);

      await expect(
        caller.song.search({ sessionId: session.id, query: "test" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("suggest", () => {
    it("creates song with auto-upvote and broadcasts", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);
      const caller = createGuestCaller(guest.id, session.id);

      const events: string[] = [];
      channelManager.subscribe(session.id, {
        write: (data) => events.push(data),
        close: () => {},
      });

      const song = await caller.song.suggest({ providerId: "vid-1" });

      expect(song.score).toBe(1);
      expect(song.suggestedById).toBe(guest.id);

      // Verify auto-upvote
      const vote = await testPrisma.vote.findUnique({
        where: { songId_guestId: { songId: song.id, guestId: guest.id } },
      });
      expect(vote).not.toBeNull();
      expect(vote!.value).toBe(1);

      // Verify broadcast
      expect(events.some((e) => e.includes("song_added"))).toBe(true);
    });

    it("rejects duplicate providerId in active queue", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);
      await createTestSong(session.id, { providerId: "vid-dup", status: "queued" });
      const caller = createGuestCaller(guest.id, session.id);

      (mockProvider.getTrack as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        providerId: "vid-dup",
        provider: "youtube",
        title: "Dup",
        artist: null,
        thumbnailUrl: null,
        durationMs: null,
      });

      await expect(
        caller.song.suggest({ providerId: "vid-dup" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("rejects suggest within cooldown period", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);
      // Pre-create a song with recent addedAt (default is now())
      await createTestSong(session.id, {
        suggestedById: guest.id,
        providerId: "old-song",
      });

      const caller = createGuestCaller(guest.id, session.id);
      // Default cooldown is 30s, so immediate suggest should be rejected
      await expect(
        caller.song.suggest({ providerId: "new-song" }),
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    });

    it("rejects when max suggestions reached", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);
      const caller = createGuestCaller(guest.id, session.id);

      // Create 5 songs (default max) for this guest
      for (let i = 0; i < 5; i++) {
        await createTestSong(session.id, {
          providerId: `existing-${i}`,
          suggestedById: guest.id,
        });
      }

      await expect(
        caller.song.suggest({ providerId: "one-more" }),
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    });

    it("rejects anonymous caller with UNAUTHORIZED", async () => {
      const caller = createAnonymousCaller();
      await expect(
        caller.song.suggest({ providerId: "vid-1" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects owner caller with UNAUTHORIZED", async () => {
      const user = await createTestUser();
      const caller = createOwnerCaller(user.id);
      await expect(
        caller.song.suggest({ providerId: "vid-1" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("add (owner)", () => {
    it("creates song with score 0 and broadcasts", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const caller = createOwnerCaller(user.id);

      const events: string[] = [];
      channelManager.subscribe(session.id, {
        write: (data) => events.push(data),
        close: () => {},
      });

      const song = await caller.song.add({
        sessionId: session.id,
        providerId: "vid-1",
      });

      expect(song.score).toBe(0);
      expect(song.suggestedById).toBeNull();
      expect(events.some((e) => e.includes("song_added"))).toBe(true);
    });
  });

  describe("remove (owner)", () => {
    it("deletes song and broadcasts song_removed", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const song = await createTestSong(session.id);
      const caller = createOwnerCaller(user.id);

      const events: string[] = [];
      channelManager.subscribe(session.id, {
        write: (data) => events.push(data),
        close: () => {},
      });

      await caller.song.remove({ songId: song.id });

      const deleted = await testPrisma.song.findUnique({ where: { id: song.id } });
      expect(deleted).toBeNull();
      expect(events.some((e) => e.includes("song_removed"))).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npm run test:integration -- --reporter=verbose 2>&1 | head -50
```

Expected: All song tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/song.integration.test.ts
git commit -m "test: add integration tests for song router"
```

---

### Task 16: Integration test — vote router

**Files:**
- Create: `packages/api/src/routers/vote.integration.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { MusicProvider } from "../../music/types";

const mockProvider: MusicProvider = {
  search: vi.fn().mockResolvedValue({ tracks: [] }),
  getTrack: vi.fn().mockResolvedValue(null),
  getPlayerData: vi.fn().mockReturnValue({
    type: "youtube" as const,
    embedUrl: "https://youtube.com/embed/test",
    providerId: "test",
  }),
  validate: vi.fn().mockResolvedValue(true),
};

vi.mock("../../music/index", () => ({
  getMusicProvider: () => mockProvider,
}));

import {
  resetDatabase,
  createGuestCaller,
  createAnonymousCaller,
  createTestUser,
  createTestVenue,
  createTestSession,
  createTestGuest,
  createTestSong,
  testPrisma,
} from "../../../test/helpers";
import { channelManager } from "../../sse/channel-manager";

describe("vote router", () => {
  beforeEach(async () => {
    await resetDatabase();
    channelManager.reset();
  });

  describe("cast", () => {
    it("upvote increments song score", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);
      const song = await createTestSong(session.id);
      const caller = createGuestCaller(guest.id, session.id);

      const result = await caller.vote.cast({ songId: song.id, value: 1 });

      expect(result.score).toBe(1);

      const dbSong = await testPrisma.song.findUnique({ where: { id: song.id } });
      expect(dbSong!.score).toBe(1);
    });

    it("toggle same value removes vote and decrements score", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);
      const song = await createTestSong(session.id);
      const caller = createGuestCaller(guest.id, session.id);

      await caller.vote.cast({ songId: song.id, value: 1 });
      const result = await caller.vote.cast({ songId: song.id, value: 1 });

      expect(result.score).toBe(0);
    });

    it("changing vote direction updates score correctly", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);
      const song = await createTestSong(session.id);
      const caller = createGuestCaller(guest.id, session.id);

      await caller.vote.cast({ songId: song.id, value: 1 });
      const result = await caller.vote.cast({ songId: song.id, value: -1 });

      expect(result.score).toBe(-1);
    });

    it("broadcasts vote_changed", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);
      const song = await createTestSong(session.id);
      const caller = createGuestCaller(guest.id, session.id);

      const events: string[] = [];
      channelManager.subscribe(session.id, {
        write: (data) => events.push(data),
        close: () => {},
      });

      await caller.vote.cast({ songId: song.id, value: 1 });

      expect(events.some((e) => e.includes("vote_changed"))).toBe(true);
    });

    it("downvote below threshold auto-skips queued song", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id, {
        settings: { downvoteSkipThreshold: -2 },
      });
      const session = await createTestSession(venue.id);
      const song = await createTestSong(session.id);

      // Create 3 guests who all downvote
      const guest1 = await createTestGuest(session.id);
      const guest2 = await createTestGuest(session.id);
      const guest3 = await createTestGuest(session.id);

      await createGuestCaller(guest1.id, session.id).vote.cast({ songId: song.id, value: -1 });
      await createGuestCaller(guest2.id, session.id).vote.cast({ songId: song.id, value: -1 });
      await createGuestCaller(guest3.id, session.id).vote.cast({ songId: song.id, value: -1 });

      const dbSong = await testPrisma.song.findUnique({ where: { id: song.id } });
      expect(dbSong!.status).toBe("skipped");
    });

    it("rejects anonymous caller with UNAUTHORIZED", async () => {
      const caller = createAnonymousCaller();
      await expect(
        caller.vote.cast({ songId: "any", value: 1 }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("rejects vote on song from different session", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session1 = await createTestSession(venue.id);
      const session2 = await createTestSession(venue.id, { isActive: false });
      const guest = await createTestGuest(session1.id);
      const song = await createTestSong(session2.id);
      const caller = createGuestCaller(guest.id, session1.id);

      await expect(
        caller.vote.cast({ songId: song.id, value: 1 }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npm run test:integration -- --reporter=verbose 2>&1 | head -40
```

Expected: All vote tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/vote.integration.test.ts
git commit -m "test: add integration tests for vote router"
```

---

### Task 17: Integration test — queue router

**Files:**
- Create: `packages/api/src/routers/queue.integration.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { MusicProvider } from "../../music/types";

const mockProvider: MusicProvider = {
  search: vi.fn().mockResolvedValue({ tracks: [] }),
  getTrack: vi.fn().mockResolvedValue(null),
  getPlayerData: vi.fn().mockReturnValue({
    type: "youtube" as const,
    embedUrl: "https://youtube.com/embed/test",
    providerId: "test",
  }),
  validate: vi.fn().mockResolvedValue(true),
};

vi.mock("../../music/index", () => ({
  getMusicProvider: () => mockProvider,
}));

import {
  resetDatabase,
  createOwnerCaller,
  createGuestCaller,
  createAnonymousCaller,
  createTestUser,
  createTestVenue,
  createTestSession,
  createTestGuest,
  createTestSong,
  testPrisma,
} from "../../../test/helpers";
import { channelManager } from "../../sse/channel-manager";

describe("queue router", () => {
  beforeEach(async () => {
    await resetDatabase();
    channelManager.reset();
  });

  describe("list", () => {
    it("returns songs ordered by score desc, addedAt asc", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);

      await createTestSong(session.id, { title: "Low Score", score: 1 });
      await createTestSong(session.id, { title: "High Score", score: 10 });
      await createTestSong(session.id, { title: "Mid Score", score: 5 });

      const caller = createGuestCaller(guest.id, session.id);
      const songs = await caller.queue.list({ sessionId: session.id });

      expect(songs[0].title).toBe("High Score");
      expect(songs[1].title).toBe("Mid Score");
      expect(songs[2].title).toBe("Low Score");
    });

    it("rejects cross-session guest with FORBIDDEN", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const otherSession = await createTestSession(venue.id, { isActive: false });
      const guest = await createTestGuest(otherSession.id);
      const caller = createGuestCaller(guest.id, otherSession.id);

      await expect(
        caller.queue.list({ sessionId: session.id }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects anonymous caller with UNAUTHORIZED", async () => {
      const caller = createAnonymousCaller();
      await expect(
        caller.queue.list({ sessionId: "any" }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });

  describe("nowPlaying", () => {
    it("returns the currently playing song", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);
      await createTestSong(session.id, { title: "Now Playing", status: "playing" });

      const caller = createGuestCaller(guest.id, session.id);
      const playing = await caller.queue.nowPlaying({ sessionId: session.id });

      expect(playing).not.toBeNull();
      expect(playing!.title).toBe("Now Playing");
    });

    it("returns null when nothing is playing", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const guest = await createTestGuest(session.id);

      const caller = createGuestCaller(guest.id, session.id);
      const playing = await caller.queue.nowPlaying({ sessionId: session.id });

      expect(playing).toBeNull();
    });
  });

  describe("next", () => {
    it("advances to highest-scored queued song", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);

      await createTestSong(session.id, { title: "Low", score: 1 });
      await createTestSong(session.id, { title: "High", score: 10 });

      const caller = createOwnerCaller(user.id);
      const result = await caller.queue.next({ sessionId: session.id });

      expect(result.song).not.toBeNull();
      expect(result.song!.title).toBe("High");
      // advanceQueue returns the song fetched before the status update in the transaction,
      // so verify the DB state directly
      const dbSong = await testPrisma.song.findUnique({ where: { id: result.song!.id } });
      expect(dbSong!.status).toBe("playing");
    });

    it("returns null song when queue is empty", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);
      const caller = createOwnerCaller(user.id);

      const events: string[] = [];
      channelManager.subscribe(session.id, {
        write: (data) => events.push(data),
        close: () => {},
      });

      const result = await caller.queue.next({ sessionId: session.id });

      expect(result.song).toBeNull();
      expect(events.some((e) => e.includes('"song":null'))).toBe(true);
    });
  });

  describe("skip", () => {
    it("marks current song as skipped and advances", async () => {
      const user = await createTestUser();
      const venue = await createTestVenue(user.id);
      const session = await createTestSession(venue.id);

      const playing = await createTestSong(session.id, { title: "Playing", status: "playing" });
      await createTestSong(session.id, { title: "Next Up", score: 5 });

      const caller = createOwnerCaller(user.id);
      const result = await caller.queue.skip({ sessionId: session.id });

      expect(result.song).not.toBeNull();
      expect(result.song!.title).toBe("Next Up");

      const skipped = await testPrisma.song.findUnique({ where: { id: playing.id } });
      expect(skipped!.status).toBe("skipped");
    });
  });
});
```

- [ ] **Step 2: Run full integration suite**

```bash
npm run test:integration -- --reporter=verbose 2>&1 | tail -20
```

Expected: All integration tests PASS (venue, session, guest, song, vote, queue).

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routers/queue.integration.test.ts
git commit -m "test: add integration tests for queue router"
```

---

### Task 18: Final verification

- [ ] **Step 1: Run full unit suite**

```bash
npm test 2>&1 | tail -10
```

Expected: All unit tests pass.

- [ ] **Step 2: Run full integration suite**

```bash
npm run test:integration 2>&1 | tail -10
```

Expected: All integration tests pass.

- [ ] **Step 3: Run full suite together**

```bash
npm run test:all 2>&1 | tail -15
```

Expected: All tests pass (unit + integration).

- [ ] **Step 4: Run coverage report**

```bash
npm run test:coverage 2>&1 | tail -30
```

Expected: Coverage report generated. Note the numbers for `packages/api/src/`.

- [ ] **Step 5: Commit any remaining changes and tag**

```bash
git add -A
git status
```

If there are uncommitted changes, commit them. Otherwise, done.
