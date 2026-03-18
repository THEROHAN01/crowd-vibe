# PERF-009: Auth Validation Hits Database on Every Request with No Caching

**Severity:** P1 HIGH
**Category:** Performance / Database
**Date identified:** 2026-03-18

---

## Affected File

| File | Lines | Description |
|------|-------|-------------|
| `packages/api/src/context.ts` | 13-49 | `createContext()` -- called on every tRPC request |

---

## Problem Description

The `createContext()` function is invoked on **every single tRPC API request** to determine the caller's identity (venue owner, guest, or anonymous). The current implementation always performs database queries, with no caching or short-circuiting.

### Current Code

```typescript
// packages/api/src/context.ts:13-49
export async function createContext(req: NextRequest): Promise<Context> {
    // Try Better-Auth first (venue owner)
    const authSession = await auth.api.getSession({    // <-- DB call #1: session lookup
        headers: req.headers,
    });
    if (authSession?.user) {
        return {
            type: "owner",
            user: {
                id: authSession.user.id,
                name: authSession.user.name,
                email: authSession.user.email,
            },
        };
    }

    // Fall back to guest cookie (HMAC-signed)
    const rawCookie = req.cookies.get("cv_guest")?.value;
    if (rawCookie) {
        const guestId = verifySignedCookie(rawCookie, env.BETTER_AUTH_SECRET); // <-- HMAC verify (~1ms, OK)
        if (guestId) {
            const guest = await prisma.guestUser.findUnique({               // <-- DB call #2: guest lookup
                where: { id: guestId },
                select: { sessionId: true },
            });
            if (guest) {
                return {
                    type: "guest",
                    guestId,
                    guestSessionId: guest.sessionId,
                };
            }
        }
    }

    return { type: "anonymous" };
}
```

### The Problem: Wrong Auth Order + No Caching

There are two distinct issues in this function:

#### Issue 1: Better Auth Checked First for Guest Requests

The function calls `auth.api.getSession()` **before** checking the guest cookie. In a CrowdVibe session with 50 guests and 1 venue owner:

- **98% of requests are from guests** (voting, viewing queue, searching songs)
- **2% of requests are from the venue owner** (dashboard, skip, add songs)
- Yet every guest request first performs a full Better Auth session lookup (which involves cookie parsing, session token validation, and potentially a database query), only to get `null` back, before falling through to the guest cookie check

This means guests pay the cost of Better Auth validation on every request even though they never have a Better Auth session.

#### Issue 2: No Result Caching

Even after determining the auth context, the result is not cached. The same guest making 10 requests in 5 seconds will trigger 10 identical `prisma.guestUser.findUnique()` calls with the same `guestId`, getting the same result each time.

### Request-Level Cost Analysis

| Auth path | Operations | Estimated latency |
|-----------|-----------|-------------------|
| Guest (current) | `auth.api.getSession()` (fail) + `verifySignedCookie()` + `prisma.guestUser.findUnique()` | 15-40ms |
| Guest (optimized) | `verifySignedCookie()` + cache hit | 1-2ms |
| Owner (current) | `auth.api.getSession()` (success) | 10-25ms |
| Owner (optimized) | Cache hit | 0-1ms |

---

## Impact Assessment

### Database Load

With 50 concurrent guests in a session:

| Scenario | Requests/sec | DB queries/sec (current) | DB queries/sec (fixed) |
|----------|-------------|-------------------------|----------------------|
| Guests voting (5s interval) | 10 | 20 (auth.getSession + guestUser.findUnique) | 0-2 (cache hits) |
| Queue refetches (tab switch, PERF-007) | 50-150 | 100-300 | 0 (cache hits) |
| SSE connection setup | Burst of 50 | 100 | 50 (one-time, no cache) |
| Total steady state | 60-160 | 120-320 | 0-52 |

**Current: 120-320 DB queries/sec just for auth**
**Fixed: 0-52 DB queries/sec for auth (84-100% reduction)**

### Latency Impact

Every tRPC request is delayed by auth validation latency:

- `auth.api.getSession()` for a guest (no session): ~5-15ms (parses cookies, checks DB, returns null)
- `prisma.guestUser.findUnique()`: ~5-15ms (DB roundtrip)
- **Total auth overhead per guest request: ~10-30ms**

For a vote action:
1. Auth validation: 10-30ms
2. Vote mutation: ~5-10ms
3. SSE broadcast: ~1ms
4. **Auth is 50-75% of total request time**

### Vercel Serverless Impact

Each millisecond of function execution costs money on Vercel. With 120-320 unnecessary DB queries per second, each taking 5-15ms:

- Wasted compute: 600-4800ms of function execution per second
- At Vercel Pro pricing (~$0.18/100GB-hrs or ~$0.00000005/ms): small per-request, but adds up at scale

---

## Root Cause Analysis

The auth flow follows a common pattern where the "primary" auth (Better Auth for venue owners) is checked first, and the "secondary" auth (guest cookie) is the fallback. This made sense during development when the owner was the primary user, but in production the ratio is inverted: guests vastly outnumber owners.

Additionally, no caching layer was added because:
1. The function is simple and the developer likely assumed it was fast enough
2. Better Auth's `getSession()` may already have internal caching (but it still parses cookies and validates every time)
3. The guest cookie verification (`verifySignedCookie`) IS fast (HMAC, ~1ms), but the subsequent `prisma.guestUser.findUnique()` is not

---

## Fix: Guest-First Auth Path + In-Memory Cache

### Step 1: Reorder Auth Checks (Guest First)

Check the guest cookie BEFORE Better Auth. The guest cookie check starts with a synchronous HMAC verification -- if the cookie is invalid or absent, it fails immediately (< 1ms) with no DB call.

```typescript
// packages/api/src/context.ts
export async function createContext(req: NextRequest): Promise<Context> {
    // Check guest cookie FIRST -- cheap HMAC verification, no DB call if invalid
    const rawCookie = req.cookies.get("cv_guest")?.value;
    if (rawCookie) {
        const guestId = verifySignedCookie(rawCookie, env.BETTER_AUTH_SECRET);
        if (guestId) {
            const guest = await prisma.guestUser.findUnique({
                where: { id: guestId },
                select: { sessionId: true },
            });
            if (guest) {
                return {
                    type: "guest",
                    guestId,
                    guestSessionId: guest.sessionId,
                };
            }
        }
    }

    // Only try Better Auth if no valid guest cookie (venue owner path)
    const authSession = await auth.api.getSession({
        headers: req.headers,
    });
    if (authSession?.user) {
        return {
            type: "owner",
            user: {
                id: authSession.user.id,
                name: authSession.user.name,
                email: authSession.user.email,
            },
        };
    }

    return { type: "anonymous" };
}
```

**Benefit:** Guests no longer pay the cost of `auth.api.getSession()`. This alone eliminates one DB call per guest request.

### Step 2: Add Short-Lived In-Memory Cache

Cache the auth context for 30-60 seconds, keyed by the relevant cookie value. This eliminates the `prisma.guestUser.findUnique()` call for repeated requests from the same guest.

```typescript
// packages/api/src/context.ts
import { auth } from "@crowd-vibe/auth";
import prisma from "@crowd-vibe/db";
import { env } from "@crowd-vibe/env/server";
import type { NextRequest } from "next/server";

import { verifySignedCookie } from "./lib/cookie";

export type Context =
    | { type: "owner"; user: { id: string; name: string; email: string } }
    | { type: "guest"; guestId: string; guestSessionId: string }
    | { type: "anonymous" };

// ---- Auth cache ----
// TTL-based in-memory cache for auth context.
// Key: cookie value (guest cookie or session token)
// Value: resolved Context + expiry timestamp
interface CacheEntry {
    context: Context;
    expiresAt: number;
}

const AUTH_CACHE_TTL_MS = 30 * 1000; // 30 seconds
const authCache = new Map<string, CacheEntry>();

// Periodic cleanup to prevent memory leaks (runs at most every 60 seconds)
let lastCleanup = Date.now();
function cleanupCache() {
    const now = Date.now();
    if (now - lastCleanup < 60_000) return;
    lastCleanup = now;
    for (const [key, entry] of authCache) {
        if (entry.expiresAt < now) {
            authCache.delete(key);
        }
    }
}

function getCached(key: string): Context | null {
    const entry = authCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
        authCache.delete(key);
        return null;
    }
    return entry.context;
}

function setCache(key: string, context: Context): void {
    authCache.set(key, {
        context,
        expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
    });
    cleanupCache();
}

// ---- Context creation ----
export async function createContext(req: NextRequest): Promise<Context> {
    // 1. Check guest cookie FIRST (cheap HMAC, no DB if invalid)
    const rawGuestCookie = req.cookies.get("cv_guest")?.value;
    if (rawGuestCookie) {
        // Check cache first
        const cached = getCached(`guest:${rawGuestCookie}`);
        if (cached) return cached;

        const guestId = verifySignedCookie(rawGuestCookie, env.BETTER_AUTH_SECRET);
        if (guestId) {
            const guest = await prisma.guestUser.findUnique({
                where: { id: guestId },
                select: { sessionId: true },
            });
            if (guest) {
                const context: Context = {
                    type: "guest",
                    guestId,
                    guestSessionId: guest.sessionId,
                };
                setCache(`guest:${rawGuestCookie}`, context);
                return context;
            }
        }
    }

    // 2. Try Better Auth (venue owner) -- only if no valid guest cookie
    const sessionCookie = req.cookies.get("better-auth.session_token")?.value
        ?? req.cookies.get("__Secure-better-auth.session_token")?.value;

    if (sessionCookie) {
        const cached = getCached(`owner:${sessionCookie}`);
        if (cached) return cached;
    }

    const authSession = await auth.api.getSession({
        headers: req.headers,
    });
    if (authSession?.user) {
        const context: Context = {
            type: "owner",
            user: {
                id: authSession.user.id,
                name: authSession.user.name,
                email: authSession.user.email,
            },
        };
        if (sessionCookie) {
            setCache(`owner:${sessionCookie}`, context);
        }
        return context;
    }

    return { type: "anonymous" };
}

// Export for testing
export { authCache as _authCacheForTesting };
```

### Step 3: Invalidate Cache on Auth State Changes

When a guest's session ends or when an owner logs out, the cached context should be invalidated. Add a helper:

```typescript
// packages/api/src/context.ts (add to the module)
export function invalidateAuthCache(cookieValue: string): void {
    authCache.delete(`guest:${cookieValue}`);
    authCache.delete(`owner:${cookieValue}`);
}
```

Call this from the session end handler and logout handler.

---

## Security Considerations

### Cache Poisoning

The cache key is the raw cookie value, which is:
- **Guest cookie:** HMAC-signed with `BETTER_AUTH_SECRET`. Cannot be forged without the secret.
- **Owner session token:** Managed by Better Auth. Cryptographically random.

An attacker cannot craft a cookie value that maps to another user's cache entry.

### Cache Staleness

With a 30-second TTL:
- If a guest is kicked from a session, they can still make requests for up to 30 seconds
- This is acceptable for a music voting app; the worst case is 30 seconds of stale votes
- For higher security requirements, reduce TTL to 10 seconds or add explicit cache invalidation

### Memory Usage

Each cache entry is small (~200 bytes). With 500 concurrent users:
- Cache size: ~100 KB
- Well within serverless function memory limits (128 MB minimum on Vercel)
- The periodic cleanup prevents unbounded growth

---

## Serverless Considerations

In a serverless environment (Vercel), the in-memory cache has limitations:

1. **Cold starts**: Cache is empty on cold start. First request after cold start always hits DB.
2. **Multiple instances**: Each serverless function instance has its own cache. No sharing between instances.
3. **Instance lifetime**: Vercel keeps instances warm for ~5-15 minutes. Cache is useful during this window.

Even with these limitations, the cache provides significant benefit:
- During a burst of requests (e.g., 50 guests voting simultaneously), the first request populates the cache, and subsequent requests from the same guest hit the cache
- The warm instance window aligns well with active session periods

For a more robust solution (future improvement), consider:
- **Redis/Upstash** cache with TTL (shared across all function instances)
- **Edge middleware** that validates auth once and passes the result via headers (eliminates auth from the function entirely)

---

## SSE Connection Note

The SSE endpoint (`/api/sse/[sessionId]`) calls `createContext()` once when the connection is established. The long-lived SSE connection does not re-validate auth on each heartbeat or event broadcast. This is correct behavior -- the fix primarily benefits the short-lived tRPC API requests (votes, queue fetches, search).

---

## Verification

### Step 1: Measure Current Auth Latency

Add temporary timing to `createContext()`:

```typescript
export async function createContext(req: NextRequest): Promise<Context> {
    const start = performance.now();
    // ... existing logic ...
    const elapsed = performance.now() - start;
    if (elapsed > 10) {
        console.warn(`[auth] createContext took ${elapsed.toFixed(1)}ms`);
    }
    return context;
}
```

### Step 2: Verify Cache Hit Rate

After deploying the fix, add logging for cache hits:

```typescript
function getCached(key: string): Context | null {
    const entry = authCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
        authCache.delete(key);
        return null;
    }
    console.debug(`[auth] Cache HIT for ${key.slice(0, 10)}...`);
    return entry.context;
}
```

Expected: >90% cache hit rate during active sessions.

### Step 3: Load Test

Use a tool like `k6` or `autocannon` to simulate 50 concurrent guests:

```bash
autocannon -c 50 -d 10 http://localhost:3000/api/trpc/queue.list
```

Compare DB query count before and after the fix using Prisma query logging:

```typescript
// packages/db/src/index.ts (temporary)
const prisma = new PrismaClient({ log: ["query"] });
```

---

## Related Issues

- **PERF-006**: Blanket cache invalidation (more mutations = more auth calls)
- **PERF-007**: No staleTime (more refetches = more auth calls)
- **PERF-011**: Duplicate SSE connections (each connection triggers auth validation)
