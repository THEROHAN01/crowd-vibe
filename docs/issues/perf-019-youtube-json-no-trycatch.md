# PERF-019: YouTube API `res.json()` Not Wrapped in Try-Catch — Malformed Response Crashes Handler

| Field        | Value                                                           |
|--------------|-----------------------------------------------------------------|
| **Severity** | P2 MEDIUM                                                       |
| **Category** | Reliability / Error Handling                                    |
| **File**     | `packages/api/src/music/providers/youtube.ts`                   |
| **Lines**    | 78 (`search` method), 103 (`getTrack` method)                  |
| **Status**   | Open                                                            |
| **Date**     | 2026-03-18                                                      |

---

## Problem Statement

The YouTube provider calls `await res.json()` after checking `res.ok`, but does not wrap the JSON parsing in a try-catch. If YouTube returns a `200 OK` response with a non-JSON body (e.g., an HTML error page, empty body, or truncated JSON), `res.json()` throws a `SyntaxError` that propagates unhandled.

### Affected Code: `search()` Method

**File: `packages/api/src/music/providers/youtube.ts`** (lines 72-79)

```typescript
const res = await fetch(url.toString());
if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`YouTube API error: ${res.status} ${errorBody}`);
}

const data = await res.json();   // Line 78: UNGUARDED
const items: YouTubeSearchItem[] = data.items ?? [];
```

The `!res.ok` check (line 73) handles HTTP error status codes (4xx, 5xx) correctly. However, a `200 OK` response with malformed JSON is not caught. The `res.json()` call on line 78 will throw:

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

This error propagates up to the caller. In the `song.ts` search handler, it is caught by the silent `catch` block (see PERF-016). But in other callers (like `suggest` and `add` which call `getTrack()`), the error is **not caught** and becomes a 500 Internal Server Error.

### Affected Code: `getTrack()` Method

**File: `packages/api/src/music/providers/youtube.ts`** (lines 100-104)

```typescript
const res = await fetch(url.toString());
if (!res.ok) return null;

const data = await res.json();   // Line 103: UNGUARDED
const item: YouTubeVideoItem | undefined = data.items?.[0];
```

This method is called by:
- `song.suggest` mutation (line 128 of `song.ts`) -- guest suggesting a song
- `song.add` mutation (line 223 of `song.ts`) -- owner adding a song
- `validate()` method (line 126-127 of `youtube.ts`) -- validating a provider ID

If `getTrack()` throws due to malformed JSON, the `suggest` mutation will return a 500 error to the guest with an unstructured error message.

### When Does YouTube Return 200 + Non-JSON?

This is not a theoretical concern. Known scenarios include:

1. **CDN/Proxy HTML error pages** -- Corporate proxies, captive portals (airports, hotels), or CDN edge errors can intercept the request and return an HTML page with a `200` status code.

2. **YouTube API incidents** -- During API degradation events, YouTube has been known to return partial JSON or HTML error pages with `200` status codes. The YouTube Data API v3 status page documents multiple such incidents.

3. **Rate limiting with HTML body** -- Some API gateways return `200` with an HTML challenge page (e.g., Cloudflare Under Attack Mode) instead of a proper 429 status code.

4. **Truncated responses** -- Network interruptions during response streaming can result in truncated JSON that fails to parse.

5. **Empty body** -- A `200` response with a zero-length body causes `res.json()` to throw `SyntaxError: Unexpected end of JSON input`.

---

## Root Cause

The code assumes that a `200 OK` response always contains valid JSON. This assumption is safe under normal operating conditions but fails during API incidents, network issues, or proxy interference.

---

## Impact Assessment

| Scenario                        | Affected Method | Current Behavior                              | User Impact                       |
|---------------------------------|-----------------|-----------------------------------------------|-----------------------------------|
| Malformed JSON during search    | `search()`      | SyntaxError caught silently by `song.ts` catch | Empty results, no error indication |
| Malformed JSON during suggest   | `getTrack()`    | SyntaxError becomes 500 Internal Server Error  | Guest sees generic "Something went wrong" |
| Malformed JSON during add       | `getTrack()`    | SyntaxError becomes 500 Internal Server Error  | Owner sees generic error           |
| Malformed JSON during validate  | `getTrack()`    | SyntaxError becomes 500 Internal Server Error  | Validation fails unexpectedly      |
| YouTube API extended outage     | Both            | Every request throws unhandled SyntaxError    | Complete search/add functionality failure |

The `search()` path is partially mitigated by the catch in `song.ts` (though that catch is itself problematic -- see PERF-016). The `getTrack()` path is **completely unhandled** and will crash the request handler.

---

## Fix Instructions

### Step 1: Create a Safe JSON Parser Helper

**File: `packages/api/src/music/providers/youtube.ts`**

Add a helper function at the top of the file (after imports, before the class):

```typescript
/**
 * Safely parse a JSON response, throwing a descriptive error on failure.
 * This wraps res.json() to provide better error messages when YouTube
 * returns non-JSON responses (HTML error pages, empty bodies, truncated JSON).
 */
async function safeJsonParse<T>(res: Response, context: string): Promise<T> {
    const text = await res.text();
    try {
        return JSON.parse(text) as T;
    } catch (error) {
        const preview = text.substring(0, 200);
        throw new Error(
            `${context}: Expected JSON but received: "${preview}${text.length > 200 ? "..." : ""}"`,
        );
    }
}
```

### Step 2: Update the `search()` Method

**File: `packages/api/src/music/providers/youtube.ts`** (replace lines 78-79)

Before:
```typescript
const data = await res.json();
const items: YouTubeSearchItem[] = data.items ?? [];
```

After:
```typescript
const data = await safeJsonParse<{ items?: YouTubeSearchItem[]; nextPageToken?: string }>(
    res,
    "YouTube search API",
);
const items: YouTubeSearchItem[] = data.items ?? [];
```

### Step 3: Update the `getTrack()` Method

**File: `packages/api/src/music/providers/youtube.ts`** (replace lines 103-104)

Before:
```typescript
const data = await res.json();
const item: YouTubeVideoItem | undefined = data.items?.[0];
```

After:
```typescript
let data: { items?: YouTubeVideoItem[] };
try {
    data = await safeJsonParse<{ items?: YouTubeVideoItem[] }>(
        res,
        "YouTube video API",
    );
} catch (error) {
    console.error("[YouTubeProvider.getTrack] JSON parse failed for:", providerId, error);
    return null;
}
const item: YouTubeVideoItem | undefined = data.items?.[0];
```

Note: `getTrack()` returns `null` on failure (matching the existing `!res.ok` behavior), while `search()` throws (matching the existing error-throw behavior for non-200 responses). This preserves the existing error-handling contracts.

### Step 4: Full Updated File

For clarity, here is the complete updated `search()` and `getTrack()` methods:

```typescript
async search(query: string, limit = 10): Promise<SearchResult> {
    const url = new URL(`${YOUTUBE_API_BASE}/search`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("videoCategoryId", "10"); // Music category
    url.searchParams.set("maxResults", String(limit));
    url.searchParams.set("q", query);
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
        const errorBody = await res.text().catch(() => "");
        throw new Error(`YouTube API error: ${res.status} ${errorBody}`);
    }

    const data = await safeJsonParse<{
        items?: YouTubeSearchItem[];
        nextPageToken?: string;
    }>(res, "YouTube search API");
    const items: YouTubeSearchItem[] = data.items ?? [];

    return {
        tracks: items.map((item) => ({
            providerId: item.id.videoId,
            provider: "youtube" as const,
            title: item.snippet.title,
            artist: item.snippet.channelTitle,
            thumbnailUrl: getThumbnail(item.snippet.thumbnails),
            durationMs: null,
        })),
        nextPageToken: data.nextPageToken,
    };
}

async getTrack(providerId: string): Promise<MusicTrack | null> {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", providerId);
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    let data: { items?: YouTubeVideoItem[] };
    try {
        data = await safeJsonParse<{ items?: YouTubeVideoItem[] }>(
            res,
            "YouTube video API",
        );
    } catch (error) {
        console.error(
            "[YouTubeProvider.getTrack] JSON parse failed for:",
            providerId,
            error,
        );
        return null;
    }
    const item: YouTubeVideoItem | undefined = data.items?.[0];
    if (!item) return null;

    return {
        providerId: item.id,
        provider: "youtube",
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnailUrl: getThumbnail(item.snippet.thumbnails),
        durationMs: parseDuration(item.contentDetails.duration),
    };
}
```

---

## Verification

### Unit Test

```typescript
import { YouTubeProvider } from "./youtube";

// Mock fetch to return 200 with HTML
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.reject(new SyntaxError("Unexpected token <")),
    text: () => Promise.resolve("<!DOCTYPE html><html><body>Error</body></html>"),
});

describe("YouTubeProvider", () => {
    const provider = new YouTubeProvider();

    it("search() should throw a descriptive error on malformed JSON", async () => {
        await expect(provider.search("test query")).rejects.toThrow(
            /YouTube search API: Expected JSON but received/,
        );
    });

    it("getTrack() should return null on malformed JSON", async () => {
        const result = await provider.getTrack("dQw4w9WgXcQ");
        expect(result).toBeNull();
    });
});
```

### Integration Test

1. Start the app with a valid YouTube API key
2. Search for a song -- should work normally
3. Mock the YouTube API (or use a proxy) to return `200` with `<html>Error</html>`
4. Search for a song -- should see the error state (if PERF-016 is also fixed) or empty results
5. Check server logs for the descriptive error message
6. Try suggesting a song with a valid `providerId` while the API returns bad JSON -- should see "Could not find this song" instead of a 500 error

### Edge Cases to Test

| Input                        | Expected Behavior                             |
|------------------------------|-----------------------------------------------|
| Empty response body          | `safeJsonParse` throws with "Expected JSON but received: ''" |
| `null` JSON body             | Parses to `null`, `data.items` is `undefined`, returns empty results |
| Truncated JSON `{"items":[{` | `safeJsonParse` throws with descriptive preview |
| HTML error page              | `safeJsonParse` throws with HTML preview       |
| Valid JSON, empty items      | Works normally, returns empty tracks           |

---

## Related Issues

- [PERF-016: Song search silently swallows YouTube API errors](./perf-016-silent-search-errors.md) -- the silent catch in `song.ts` masks this `res.json()` failure
- Both issues should be fixed together for comprehensive error handling
