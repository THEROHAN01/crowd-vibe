# PERF-014: SearchCache Has No Max Size — Unbounded Memory Growth

| Field        | Value                                                           |
|--------------|-----------------------------------------------------------------|
| **Severity** | P2 MEDIUM                                                       |
| **Category** | Performance / Memory Safety                                     |
| **File**     | `packages/api/src/music/search-cache.ts`                        |
| **Status**   | Open                                                            |
| **Date**     | 2026-03-18                                                      |

---

## Problem Statement

The `SearchCache` class uses a `Map<string, CacheEntry<unknown>>` that grows without any size limit. The only eviction mechanism is a TTL-based sweep that runs every 5 minutes. Between sweeps, the cache can accumulate an unbounded number of entries.

### Current Implementation

**File: `packages/api/src/music/search-cache.ts`** (full file, lines 1-51)

```typescript
interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

export class SearchCache {
    private cache = new Map<string, CacheEntry<unknown>>();
    private ttlMs: number;
    private cleanupTimer: ReturnType<typeof setInterval>;

    constructor(ttlMinutes = 15) {
        this.ttlMs = ttlMinutes * 60 * 1000;
        // Sweep expired entries every 5 minutes
        this.cleanupTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
        this.cleanupTimer.unref();
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data as T;
    }

    set<T>(key: string, data: T): void {
        this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
    }

    makeKey(provider: string, query: string): string {
        return `${provider}:${query.toLowerCase().trim()}`;
    }

    destroy() {
        clearInterval(this.cleanupTimer);
    }

    private sweep() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) this.cache.delete(key);
        }
    }
}

const globalForCache = globalThis as unknown as { searchCache: SearchCache };
export const searchCache = globalForCache.searchCache ?? new SearchCache(15);
globalForCache.searchCache = searchCache;
```

### Why This Is Dangerous

1. **No maximum entry count.** The `set()` method (line 28-30) always inserts. There is no check against a maximum size.

2. **TTL is 15 minutes, sweep is every 5 minutes.** In the worst case, entries live for up to 20 minutes before eviction (inserted just after a sweep, not evicted until the next sweep after TTL expiry).

3. **Each search result is large.** A YouTube search result contains 10 tracks, each with title, artist, thumbnailUrl, providerId, and durationMs. A single cached entry is approximately 2-5 KB of JSON data.

4. **Venue sessions with many guests generate diverse queries.** If 100 guests are all searching for different songs over 15 minutes, that is potentially 1,000+ unique search queries (10 searches each), producing 2-5 MB of cached data per session. With multiple active sessions, this grows further.

5. **The cache is stored in `globalThis`.** The singleton pattern (lines 48-50) means the cache persists across requests in long-running Node.js processes (traditional server). In serverless environments, the cache is per-instance but each instance has limited memory (typically 256MB-1GB on Vercel/AWS Lambda).

### Worst-Case Memory Calculation

| Variable                     | Value       |
|------------------------------|-------------|
| Unique searches per session  | 500         |
| Active sessions              | 10          |
| Avg. entry size              | 3 KB        |
| **Total cache memory**       | **15 MB**   |
| If 50 sessions               | **75 MB**   |
| With 15-min TTL stacking     | **Up to 150 MB** |

This is significant pressure on a 256MB Lambda or a small container.

---

## Root Cause

The `SearchCache` was designed with only TTL-based expiry and no size-based eviction. The `set()` method unconditionally adds entries with no cap.

---

## Impact Assessment

| Dimension               | Impact                                                                 |
|--------------------------|------------------------------------------------------------------------|
| **Memory usage**         | Unbounded growth proportional to unique search queries                 |
| **Serverless stability** | Potential OOM kills on Lambda/Vercel functions with limited memory     |
| **Long-running servers** | Gradual memory increase requiring periodic restarts                    |
| **Performance**          | Large Map size degrades GC performance and increases pause times       |
| **Cost**                 | Higher memory usage increases serverless billing                       |

---

## Fix Instructions

### Option A: Add LRU Eviction with Max Size (Recommended)

Modify the `SearchCache` class to accept a `maxSize` parameter and evict the oldest entries when the limit is reached.

**File: `packages/api/src/music/search-cache.ts`**

Replace the entire file with:

```typescript
interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

export class SearchCache {
    private cache = new Map<string, CacheEntry<unknown>>();
    private ttlMs: number;
    private maxSize: number;
    private cleanupTimer: ReturnType<typeof setInterval>;

    constructor(ttlMinutes = 15, maxSize = 500) {
        this.ttlMs = ttlMinutes * 60 * 1000;
        this.maxSize = maxSize;
        // Sweep expired entries every 5 minutes
        this.cleanupTimer = setInterval(() => this.sweep(), 5 * 60 * 1000);
        this.cleanupTimer.unref();
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        // Move to end for LRU ordering (Map preserves insertion order)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.data as T;
    }

    set<T>(key: string, data: T): void {
        // If key already exists, delete first to refresh insertion order
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Evict oldest entries if at capacity
        while (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            } else {
                break;
            }
        }

        this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
    }

    get size(): number {
        return this.cache.size;
    }

    makeKey(provider: string, query: string): string {
        return `${provider}:${query.toLowerCase().trim()}`;
    }

    destroy() {
        clearInterval(this.cleanupTimer);
    }

    private sweep() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) this.cache.delete(key);
        }
    }
}

const globalForCache = globalThis as unknown as { searchCache: SearchCache };
export const searchCache =
    globalForCache.searchCache ?? new SearchCache(15, 500);
globalForCache.searchCache = searchCache;
```

#### Key Changes

1. **`maxSize` parameter** (default 500) -- caps the cache at 500 entries (~1.5 MB worst case).
2. **LRU ordering via Map insertion order** -- `Map` in JavaScript preserves insertion order. On `get()`, the entry is deleted and re-inserted to move it to the end. On `set()`, the oldest entry (first key in iteration order) is evicted when at capacity.
3. **`size` getter** -- exposes current cache size for monitoring/logging.
4. **While loop eviction** -- evicts as many entries as needed to make room (handles edge case where maxSize is reduced at runtime).

### Option B: Use an Existing LRU Library

If you prefer a battle-tested implementation:

```bash
pnpm add lru-cache
```

```typescript
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, unknown>({
    max: 500,
    ttl: 15 * 60 * 1000,  // 15 minutes
});
```

This is simpler and handles edge cases (e.g., size-based eviction accounting for value size) but adds a dependency.

---

## Verification

1. **Unit test:** Write a test that inserts 600 entries and verifies the cache size never exceeds 500:

```typescript
import { SearchCache } from "./search-cache";

describe("SearchCache", () => {
    it("should evict oldest entries when maxSize is reached", () => {
        const cache = new SearchCache(15, 5);

        for (let i = 0; i < 10; i++) {
            cache.set(`key-${i}`, { data: i });
        }

        expect(cache.size).toBe(5);
        // Oldest entries (key-0 through key-4) should be evicted
        expect(cache.get("key-0")).toBeNull();
        expect(cache.get("key-9")).not.toBeNull();
    });

    it("should refresh LRU order on get", () => {
        const cache = new SearchCache(15, 3);

        cache.set("a", 1);
        cache.set("b", 2);
        cache.set("c", 3);

        // Access "a" to move it to the end
        cache.get("a");

        // Insert "d" -- should evict "b" (now oldest), not "a"
        cache.set("d", 4);

        expect(cache.get("b")).toBeNull();
        expect(cache.get("a")).toBe(1);
    });
});
```

2. **Monitoring:** After deployment, log `searchCache.size` periodically to confirm it stays bounded.

---

## Related Issues

- The `RateLimiter` class (`packages/api/src/lib/rate-limiter.ts`) has a similar pattern -- a `Map` with only TTL-based sweep. It is lower risk because rate limit entries are tiny (just a count and timestamp), but the same max-size pattern could be applied for defense in depth.
