# PERF-016: Song Search Silently Swallows YouTube API Errors

| Field        | Value                                                                 |
|--------------|-----------------------------------------------------------------------|
| **Severity** | P2 MEDIUM                                                             |
| **Category** | Reliability / Observability / UX                                      |
| **Files**    | `packages/api/src/routers/song.ts:62-68`, `packages/api/src/music/providers/youtube.ts:78` |
| **Status**   | Open                                                                  |
| **Date**     | 2026-03-18                                                            |

---

## Problem Statement

When the YouTube API fails (quota exceeded, network error, 403 Forbidden, 500 Internal Server Error), the song search handler catches the error and silently returns an empty result. The user sees "no results" with no indication that the search service is down. Server-side, no error is logged.

### Silent Error Swallowing

**File: `packages/api/src/routers/song.ts`** (lines 60-68)

```typescript
// Fetch from provider
const provider = getMusicProvider(session.musicProvider);
try {
    const result = await provider.search(input.query);
    searchCache.set(cacheKey, result);
    return result;
} catch {
    return { tracks: [], nextPageToken: undefined };
}
```

The `catch` block:
1. Has **no error parameter** -- the error object is discarded entirely
2. Does **not log** the error (no `console.error`, no logging service call)
3. Returns a **valid-looking empty response** -- the frontend cannot distinguish "no results found" from "API is down"
4. Does **not cache the failure** -- every subsequent search will retry the failing API, potentially hammering a rate-limited or broken endpoint

### Unguarded `res.json()` in YouTube Provider

**File: `packages/api/src/music/providers/youtube.ts`** (lines 72-79)

```typescript
const res = await fetch(url.toString());
if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`YouTube API error: ${res.status} ${errorBody}`);
}

const data = await res.json();   // <-- Not wrapped in try-catch
const items: YouTubeSearchItem[] = data.items ?? [];
```

If YouTube returns a `200 OK` response with malformed JSON (which can happen during API incidents or when a CDN returns an error page with a 200 status code), `res.json()` will throw a `SyntaxError`. This error would propagate up to the `catch` in `song.ts` and be silently swallowed, making it even harder to debug.

The same pattern exists in `getTrack()` (line 103):

```typescript
const res = await fetch(url.toString());
if (!res.ok) return null;

const data = await res.json();   // <-- Also not wrapped in try-catch
```

### What the User Sees

When YouTube API quota is exceeded (a common occurrence with free-tier API keys):

1. User types a search query
2. The loading spinner shows briefly
3. The results area shows... nothing
4. User thinks "no songs match my search" and tries different queries
5. Every query returns nothing
6. User gives up, confused
7. The venue owner has no indication the API is down

There is no error message, no "try again" prompt, no visual distinction between "no results" and "service unavailable."

---

## Root Cause

The error handling was written defensively (don't crash on API failure) but without any observability or UX consideration. The catch block treats all errors the same (discard and return empty) without logging or signaling the failure to the caller.

---

## Impact Assessment

| Dimension               | Impact                                                                 |
|--------------------------|------------------------------------------------------------------------|
| **User experience**      | Guests think no songs match; venue owners unaware API is down         |
| **Debuggability**        | Zero server-side logs for API failures; impossible to diagnose issues  |
| **Quota monitoring**     | YouTube API quota exhaustion is invisible until someone notices empty results |
| **Cascading failures**   | Retries on every search hammer the broken API endpoint                |
| **Lost engagement**      | Guests give up adding songs when search "doesn't work"                |

---

## Fix Instructions

### Step 1: Log Errors Server-Side

**File: `packages/api/src/routers/song.ts`** (lines 62-68)

Replace the silent catch with proper error logging and an error signal:

```typescript
// Fetch from provider
const provider = getMusicProvider(session.musicProvider);
try {
    const result = await provider.search(input.query);
    searchCache.set(cacheKey, result);
    return result;
} catch (error) {
    // Log the error for server-side observability
    console.error(
        "[song.search] Provider search failed:",
        {
            provider: session.musicProvider,
            query: input.query,
            error: error instanceof Error ? error.message : String(error),
        },
    );

    // Return a result that signals the error to the frontend
    return {
        tracks: [],
        nextPageToken: undefined,
        error: "search_unavailable" as const,
    };
}
```

### Step 2: Update the SearchResult Type

**File: `packages/api/src/music/types.ts`**

Add an optional `error` field to the `SearchResult` type:

```typescript
export interface SearchResult {
    tracks: MusicTrack[];
    nextPageToken?: string;
    error?: "search_unavailable";
}
```

### Step 3: Show Error State on the Frontend

**File: `apps/web/src/components/session/song-search.tsx`** (around lines 86-88)

Add an error state display after the loading state:

```tsx
{searchResults.isLoading && (
    <p className="text-center text-muted-foreground">Searching...</p>
)}
{searchResults.data?.error === "search_unavailable" && (
    <div className="py-8 text-center">
        <p className="font-medium text-destructive">
            Search is temporarily unavailable
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
            Please try again in a few moments.
        </p>
    </div>
)}
{!searchResults.data?.error && searchResults.data?.tracks.length === 0 &&
    debouncedQuery.length > 0 && !searchResults.isLoading && (
    <p className="py-8 text-center text-muted-foreground">
        No songs found for "{debouncedQuery}"
    </p>
)}
```

**File: `apps/web/src/components/venue/session-dashboard.tsx`** (around line 193)

Add the same error display for the owner's search:

```tsx
{searchResults.data?.error === "search_unavailable" && (
    <p className="py-4 text-center text-destructive text-sm">
        Search is temporarily unavailable. Try again shortly.
    </p>
)}
```

### Step 4: Wrap `res.json()` in Try-Catch in the YouTube Provider

**File: `packages/api/src/music/providers/youtube.ts`**

Fix the `search()` method (around line 78):

```typescript
const res = await fetch(url.toString());
if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`YouTube API error: ${res.status} ${errorBody}`);
}

let data: any;
try {
    data = await res.json();
} catch (parseError) {
    throw new Error(
        `YouTube API returned invalid JSON: ${parseError instanceof Error ? parseError.message : "unknown parse error"}`
    );
}
const items: YouTubeSearchItem[] = data.items ?? [];
```

Fix the `getTrack()` method (around line 103):

```typescript
const res = await fetch(url.toString());
if (!res.ok) return null;

let data: any;
try {
    data = await res.json();
} catch {
    console.error("[YouTubeProvider.getTrack] Invalid JSON response for:", providerId);
    return null;
}
const item: YouTubeVideoItem | undefined = data.items?.[0];
```

### Step 5: Add Negative Cache for Failures (Optional Enhancement)

To prevent hammering a broken API, cache failures briefly:

```typescript
} catch (error) {
    console.error("[song.search] Provider search failed:", {
        provider: session.musicProvider,
        query: input.query,
        error: error instanceof Error ? error.message : String(error),
    });

    // Cache the failure for 30 seconds to avoid hammering a broken API
    const failureResult = {
        tracks: [],
        nextPageToken: undefined,
        error: "search_unavailable" as const,
    };
    searchCache.set(cacheKey, failureResult);

    return failureResult;
}
```

Note: The failure TTL uses the standard 15-minute cache TTL. For a shorter failure cache, you could add a separate `setWithTTL(key, data, ttlMs)` method. However, even a 15-minute cache prevents retry storms. The user can still try a different query.

---

## Verification

### Test 1: Simulate YouTube API Quota Exceeded

1. Set `YOUTUBE_API_KEY` to an invalid key (e.g., `"INVALID_KEY"`)
2. Search for a song in the guest view
3. **Expected:** "Search is temporarily unavailable" message appears
4. **Expected:** Server logs show `[song.search] Provider search failed: { provider: "youtube", error: "YouTube API error: 403 ..." }`

### Test 2: Simulate Malformed JSON Response

1. Mock the YouTube API to return `200 OK` with body `"<html>Error</html>"`
2. Search for a song
3. **Expected:** "Search is temporarily unavailable" message appears
4. **Expected:** Server logs show `[song.search] Provider search failed: { error: "YouTube API returned invalid JSON: ..." }`

### Test 3: Verify Normal Operation Unchanged

1. Restore a valid API key
2. Search for "never gonna give you up"
3. **Expected:** Results appear normally, no error state shown

---

## Related Issues

- [PERF-019: YouTube API res.json() not wrapped in try-catch](./perf-019-youtube-json-no-trycatch.md) -- directly related; the unguarded `res.json()` call is part of this error-swallowing chain
- [PERF-014: SearchCache has no max size](./perf-014-search-cache-no-size-limit.md) -- if negative caching is added, the cache size limit becomes even more important
