# PERF-001: Prisma Client not singleton-safe for serverless deployment

| Field            | Value                                          |
| ---------------- | ---------------------------------------------- |
| **Severity**     | P0 CRITICAL                                    |
| **Category**     | Performance / Infrastructure                   |
| **File**         | `packages/db/src/index.ts`                     |
| **Lines**        | 1-17 (entire file)                             |
| **Discovered**   | 2026-03-18                                     |
| **Status**       | Open                                           |

---

## Summary

The Prisma Client is instantiated at module scope with a plain `let` variable and no `globalThis` caching. In Vercel serverless (Lambda) deployments, every cold start re-evaluates the module, creating a **new PrismaClient instance** and spawning a fresh database connection pool. Under moderate load this exhausts Neon's connection pool limit (typically 100 connections on free tier, 300 on Pro), resulting in `"too many connections"` errors and HTTP 500 responses.

---

## Current Code

**File: `packages/db/src/index.ts` (lines 1-17)**

```typescript
import { PrismaClient } from "../prisma/generated/client";

let prisma: PrismaClient;

if (process.env.VITEST) {
	// Dynamic import to avoid loading pg driver in production/edge environments
	const { PrismaPg } = await import("@prisma/adapter-pg");
	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
	prisma = new PrismaClient({ adapter });
} else {
	const { PrismaNeon } = await import("@prisma/adapter-neon");
	const { env } = await import("@crowd-vibe/env/server");
	const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
	prisma = new PrismaClient({ adapter });
}

export default prisma;
```

---

## Root Cause Analysis

### Why this is wrong

1. **Module-level `let` is re-evaluated on every serverless cold start.** In Vercel's Lambda model, each function invocation may run in a fresh V8 isolate. When the isolate is cold, the module is re-imported from scratch, and a new `PrismaClient` is constructed. There is no mechanism to reuse an existing instance across invocations within the same container.

2. **No `globalThis` caching.** The `globalThis` object persists across hot invocations within the same Lambda container. By attaching the Prisma instance to `globalThis`, subsequent warm invocations reuse the existing client and its connection pool instead of creating a new one.

3. **The codebase already uses the correct pattern elsewhere.** Two other modules in this exact codebase demonstrate the proper singleton approach:

   - **`packages/api/src/music/search-cache.ts` (lines 48-50):**
     ```typescript
     const globalForCache = globalThis as unknown as { searchCache: SearchCache };
     export const searchCache = globalForCache.searchCache ?? new SearchCache(15);
     globalForCache.searchCache = searchCache;
     ```

   - **`packages/api/src/sse/channel-manager.ts` (lines 59-64):**
     ```typescript
     const globalForSSE = globalThis as unknown as {
     	channelManager: SSEChannelManager;
     };
     export const channelManager =
     	globalForSSE.channelManager ?? new SSEChannelManager();
     globalForSSE.channelManager = channelManager;
     ```

   The Prisma client -- the single most important resource to cache -- is the only one that **doesn't** use this pattern.

### Connection lifecycle under current code

```
Request 1 (cold start):
  Module loads -> new PrismaClient() -> opens 1-5 connections to Neon

Request 2 (warm, same container):
  Module already loaded -> reuses same PrismaClient -> OK

Request 3 (new container, concurrent):
  Module loads -> new PrismaClient() -> opens 1-5 MORE connections

After 20+ concurrent cold starts:
  20 * 5 = 100 connections -> Neon pool EXHAUSTED
  Subsequent requests -> "too many connections" -> 500 error
```

---

## Impact Assessment

| Metric                  | Value                                                          |
| ----------------------- | -------------------------------------------------------------- |
| **Trigger threshold**   | ~10-20 concurrent cold starts (easily reachable at a busy venue) |
| **Error manifests as**  | PostgreSQL `too many connections` / Neon `connection limit exceeded` |
| **User-visible effect** | HTTP 500 on all API calls (queue, voting, search, session management) |
| **Recovery**            | Requires waiting for idle connections to time out (~5-10 min)   |
| **Neon free tier limit**| 100 concurrent connections                                     |
| **Neon Pro tier limit** | 300 concurrent connections (still exhaustible under load)       |

### Real-world scenario

A venue session with 50 guests. Each guest's browser maintains an SSE connection (1 request) and periodically fetches the queue (1 request). If the Vercel function scales to 20 concurrent Lambda containers during a spike (e.g., everyone opens the app at once when the DJ announces the session), that's 20 new PrismaClient instances, each opening up to 5 connections = 100 connections. Pool exhausted.

---

## Fix

### Step 1: Add globalThis singleton caching

**File: `packages/db/src/index.ts`**

Replace the entire file with:

```typescript
import { PrismaClient } from "../prisma/generated/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

if (!globalForPrisma.prisma) {
	let adapter;

	if (process.env.VITEST) {
		const { PrismaPg } = await import("@prisma/adapter-pg");
		adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
	} else {
		const { PrismaNeon } = await import("@prisma/adapter-neon");
		const { env } = await import("@crowd-vibe/env/server");
		adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
	}

	globalForPrisma.prisma = new PrismaClient({ adapter });
}

export default globalForPrisma.prisma;
```

### Step 2: Configure Neon adapter for serverless pool sizing

When constructing the Neon adapter, pass pool configuration optimized for serverless:

```typescript
const adapter = new PrismaNeon({
	connectionString: env.DATABASE_URL,
	// Serverless-optimized pool settings
	poolConfig: {
		maxConnections: 3,        // Fewer connections per Lambda
		idleTimeoutMillis: 10000, // Release idle connections faster (10s)
	},
});
```

This ensures each Lambda container holds at most 3 connections and releases them quickly when idle, dramatically reducing the total connection footprint across containers.

### Step 3: (Optional) Add connection string pooler parameter

If using Neon's built-in connection pooler (PgBouncer), ensure the connection string uses the pooled hostname:

```
# Direct connection (bypasses pooler):
postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/crowdvibe

# Pooled connection (routes through PgBouncer):
postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/crowdvibe?pgbouncer=true
```

---

## Verification

1. **Before fix** -- Check connection count under load:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'crowdvibe';
   ```
   Under 10 concurrent requests, expect to see connection count climbing with each cold start.

2. **After fix** -- Same query should show a stable connection count that plateaus rather than growing linearly.

3. **Unit test** -- Verify the module exports the same reference on multiple imports:
   ```typescript
   import prisma1 from "@crowd-vibe/db";
   import prisma2 from "@crowd-vibe/db";
   expect(prisma1).toBe(prisma2); // Should be the same object reference
   ```

---

## Related Files

- `packages/api/src/music/search-cache.ts` -- Correct globalThis pattern (reference implementation)
- `packages/api/src/sse/channel-manager.ts` -- Correct globalThis pattern (reference implementation)
- `apps/web/src/app/api/sse/[sessionId]/route.ts` -- Imports prisma directly; affected by connection leaks
- `packages/api/src/routers/*.ts` -- All router files import prisma; every API call is affected
