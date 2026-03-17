# Task 6: Music Provider Abstraction — Code Review

**Date:** 2026-03-17
**Commit:** `6c01059`
**Files created:** `packages/api/src/music/types.ts`, `packages/api/src/music/search-cache.ts`, `packages/api/src/music/providers/youtube.ts`, `packages/api/src/music/providers/spotify.ts`, `packages/api/src/music/index.ts`

---

## Issues

### ISSUE-01: YouTube API error response body is not logged or parsed

**File:** `packages/api/src/music/providers/youtube.ts:61-63`
**Severity:** MEDIUM
**Description:** When the YouTube API returns a non-OK response, the code throws `new Error(`YouTube API error: ${res.status}`)` but discards the response body. YouTube API error responses contain useful information (e.g., "quotaExceeded", "keyInvalid", "videoNotFound") in the JSON body. During development and debugging, knowing *why* the API failed is critical — especially for quota issues.

**Recommendation:** Parse the error body and include it in the error message:
```typescript
if (!res.ok) {
  const errorBody = await res.text();
  throw new Error(`YouTube API error ${res.status}: ${errorBody}`);
}
```

---

### ISSUE-02: `YouTubeProvider.apiKey` is evaluated at class instantiation, not import time

**File:** `packages/api/src/music/providers/youtube.ts:49`
**Severity:** INFO
**Description:** `private apiKey = env.YOUTUBE_API_KEY` reads from env at the time the `YouTubeProvider` instance is created (via `getMusicProvider("youtube")`), not at module import time. This is correct behavior — it means the env validation in `packages/env/src/server.ts` runs first. Just noting this is intentional and correct.

---

### ISSUE-03: `SearchCache.sweep()` mutates the Map during iteration

**File:** `packages/api/src/music/search-cache.ts:36-38`
**Severity:** INFO
**Description:** The `sweep()` method calls `this.cache.delete(key)` while iterating over `this.cache`. In JavaScript, deleting keys from a Map during `for...of` iteration is safe per the spec — the iterator handles it correctly. No issue, just noting it's been verified.

---

## Verification

- `types.ts`: `MusicTrack`, `SearchResult`, `PlayerData`, `MusicProvider` interface — all match plan and spec exactly.
- `search-cache.ts`: `globalThis` singleton, 15-min TTL, `sweep()` every 5 minutes. Matches updated plan.
- `youtube.ts`: Search uses `videoCategoryId=10` (Music). `parseDuration` handles ISO 8601 `PTxHxMxS`. `getTrack` fetches `snippet,contentDetails`. `getPlayerData` returns embed URL. All correct.
- `spotify.ts`: Stub that throws on all methods except `getPlayerData`. Correct for MVP.
- `index.ts`: Lazy singleton factory with `Map<string, MusicProvider>`. Re-exports types. Correct.

**Verdict:** Solid implementation. The YouTube error logging is the only actionable item.
