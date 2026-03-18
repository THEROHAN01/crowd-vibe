# PERF-008: Heavy Client Libraries Not Lazy-Loaded -- YouTubePlayer and FingerprintJS

**Severity:** P1 HIGH
**Category:** Performance / Bundle Size
**Date identified:** 2026-03-18

---

## Affected Files

| # | File | Line | Library | Size |
|---|------|------|---------|------|
| 1 | `apps/web/src/components/player/youtube-player.tsx` | 4 | `react-youtube` | ~40-50 KB gzipped |
| 2 | `apps/web/src/hooks/use-guest.ts` | 3 | `@fingerprintjs/fingerprintjs` | ~60 KB gzipped |
| 3 | `apps/web/src/components/venue/session-dashboard.tsx` | 8 | `youtube-player` (via static import) | Included in shared chunk |

**Combined impact:** ~100-110 KB of unnecessary JavaScript on pages that do not need these libraries.

---

## Problem 1: YouTubePlayer Static Import

### Current Code

```typescript
// apps/web/src/components/player/youtube-player.tsx:1-4
"use client";

import { useCallback } from "react";
import YouTube from "react-youtube"; // <-- 40-50 KB, imported at module top level
```

This component is then statically imported by the session dashboard:

```typescript
// apps/web/src/components/venue/session-dashboard.tsx:8
import YouTubePlayer from "@/components/player/youtube-player";
```

### Why This Is a Problem

1. **`react-youtube` bundles the YouTube IFrame API wrapper** (~40-50 KB gzipped). It includes:
   - The YouTube Player API loader
   - Event binding logic
   - Player state management
   - TypeScript type definitions for the YouTube IFrame API

2. **Only the venue owner's dashboard uses the player.** The guest session view (`apps/web/src/app/session/[id]/session-view.tsx`) never renders `YouTubePlayer`. It shows song metadata and voting UI only.

3. **Because `session-dashboard.tsx` statically imports `youtube-player.tsx`**, and `youtube-player.tsx` statically imports `react-youtube`, the bundler (Next.js/webpack/turbopack) includes `react-youtube` in the JavaScript chunk shared by the dashboard route.

4. **If the dashboard and guest view share any layout or chunk**, `react-youtube` can end up in a shared chunk that is downloaded by guest users who never need it.

5. **Even if chunks are route-split correctly**, the dashboard page pays the full parse/compile cost of `react-youtube` on initial load, even before the user starts a session or has a "now playing" song.

### Current Component Structure

```
apps/web/src/components/player/youtube-player.tsx
  - Imports: react-youtube (40-50KB)
  - Used by: session-dashboard.tsx ONLY
  - Renders: YouTube iframe embed

apps/web/src/components/venue/session-dashboard.tsx
  - Imports: YouTubePlayer (static)
  - Renders YouTubePlayer only when nowPlaying.data exists (line 136)
  - When no song is playing, the YouTube player is NOT rendered
  - But the import cost is ALWAYS paid
```

### Fix: Dynamic Import with `next/dynamic`

```typescript
// apps/web/src/components/venue/session-dashboard.tsx

// REMOVE this static import:
// import YouTubePlayer from "@/components/player/youtube-player";

// ADD dynamic import:
import dynamic from "next/dynamic";

const YouTubePlayer = dynamic(
    () => import("@/components/player/youtube-player"),
    {
        ssr: false, // YouTube IFrame API requires browser environment
        loading: () => (
            <div className="aspect-video w-full animate-pulse rounded-lg bg-muted" />
        ),
    },
);
```

This change:
- Splits `react-youtube` into its own async chunk
- Only downloads it when `YouTubePlayer` is actually rendered (i.e., when `nowPlaying.data` exists)
- Shows a skeleton placeholder while the chunk loads
- Prevents SSR attempts (YouTube IFrame API is browser-only)

---

## Problem 2: FingerprintJS Static Import

### Current Code

```typescript
// apps/web/src/hooks/use-guest.ts:1-3
"use client";

import FingerprintJS from "@fingerprintjs/fingerprintjs"; // <-- ~60 KB, imported at module top level
```

The library is used only inside the `join` callback:

```typescript
// apps/web/src/hooks/use-guest.ts:24-27
const fp = await FingerprintJS.load();
const result = await fp.get();
const fingerprint = result.visitorId;
```

### Why This Is a Problem

1. **`@fingerprintjs/fingerprintjs` is ~60 KB gzipped.** It includes:
   - Canvas fingerprinting
   - WebGL fingerprinting
   - Audio context fingerprinting
   - Font detection
   - Screen resolution detection
   - Multiple browser-specific detection modules

2. **The `useGuest` hook is only used on the join page** (when a guest enters a join code). It is NOT needed on:
   - The home/landing page
   - The venue owner login page
   - The venue dashboard
   - The session view (after joining)

3. **Because it is a top-level import**, any file that imports `use-guest.ts` causes FingerprintJS to be included in that route's chunk. Even if `useGuest().join()` is never called, the 60 KB library is downloaded, parsed, and compiled.

4. **FingerprintJS performs significant work on `load()`**: it initializes detection agents, probes the browser, and builds a fingerprint. This work should happen lazily, only when actually needed.

### Fix: Dynamic Import Inside the Hook

```typescript
// apps/web/src/hooks/use-guest.ts
"use client";

// REMOVE this static import:
// import FingerprintJS from "@fingerprintjs/fingerprintjs";

import { useCallback, useState } from "react";

interface JoinResult {
    sessionId: string;
    venueName: string;
    displayName: string | null;
}

export function useGuest() {
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const join = useCallback(
        async (
            joinCode: string,
            displayName?: string,
        ): Promise<JoinResult | null> => {
            setIsJoining(true);
            setError(null);

            try {
                // Dynamic import -- only loads FingerprintJS when join() is called
                const FingerprintJS = await import(
                    "@fingerprintjs/fingerprintjs"
                );
                const fp = await FingerprintJS.load();
                const result = await fp.get();
                const fingerprint = result.visitorId;

                const res = await fetch("/api/guest/join", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ joinCode, fingerprint, displayName }),
                    credentials: "include",
                });

                if (!res.ok) {
                    const data = await res.json();
                    setError(data.error || "Failed to join session");
                    return null;
                }

                return await res.json();
            } catch (err) {
                setError("Failed to join session. Please try again.");
                return null;
            } finally {
                setIsJoining(false);
            }
        },
        [],
    );

    return { join, isJoining, error };
}
```

This change:
- Removes the 60 KB static import from the module graph
- Only downloads FingerprintJS when the user actually clicks "Join"
- The dynamic `import()` returns the module; `FingerprintJS.load()` works the same way
- Subsequent calls to `join()` reuse the cached module (browsers cache dynamic imports)

---

## Combined Impact Analysis

### Bundle Size

| Page | Before Fix | After Fix | Savings |
|------|-----------|-----------|---------|
| Guest session view | Includes react-youtube if shared chunk | Excludes react-youtube | ~40-50 KB |
| Join page | Includes FingerprintJS at load | Loads FingerprintJS on click | ~60 KB |
| Landing page | May include FingerprintJS via shared chunk | Excludes FingerprintJS | ~60 KB |
| Dashboard (no song playing) | Includes react-youtube | Excludes react-youtube | ~40-50 KB |
| Dashboard (song playing) | Same | Same (loaded on demand) | 0 KB |

### Time to Interactive (TTI)

On a mid-range mobile device (Moto G Power, ~4x CPU throttle):

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| JS parse time (100 KB) | ~200-400ms | 0ms (deferred) | 200-400ms |
| Main thread blocking | Significant | Reduced | Improved INP |
| First Contentful Paint | Delayed by JS | Unblocked | Faster FCP |
| Time to Interactive | +300-500ms | Baseline | 300-500ms faster |

### Lighthouse Impact

These two libraries contribute to:
- **"Reduce unused JavaScript"** audit failure
- **"Avoid enormous network payloads"** warning
- **Total Blocking Time (TBT)** increase
- **Largest Contentful Paint (LCP)** delay (blocked main thread)

---

## Verification

### Method 1: `@next/bundle-analyzer`

```bash
# Install the analyzer
cd apps/web
npm install --save-dev @next/bundle-analyzer
```

Add to `apps/web/next.config.ts`:

```typescript
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
    typedRoutes: true,
    reactCompiler: true,
};

export default process.env.ANALYZE === "true"
    ? withBundleAnalyzer({ enabled: true })(nextConfig)
    : nextConfig;
```

Run the analysis:

```bash
ANALYZE=true npm run build
```

This opens an interactive treemap showing chunk composition. Look for:
- `react-youtube` in the guest session view chunks (should be absent after fix)
- `@fingerprintjs/fingerprintjs` in non-join-page chunks (should be absent after fix)

### Method 2: Chrome DevTools Coverage

1. Open Chrome DevTools > Coverage tab
2. Navigate to the guest session view
3. Look for `fingerprintjs` and `react-youtube` in the coverage report
4. Before fix: both appear with high "unused bytes" percentage
5. After fix: neither appears (not loaded on this page)

### Method 3: Network Tab

1. Open Network tab, filter by JS
2. Navigate to the guest session view
3. Before fix: chunks containing `react-youtube` and `fingerprintjs` are downloaded
4. After fix: these chunks are not downloaded
5. Navigate to the join page and click "Join"
6. After fix: `fingerprintjs` chunk downloads on click

---

## Additional Considerations

### Preloading for Better UX

If the join page wants to minimize the delay when the user clicks "Join", the FingerprintJS module can be preloaded after the page renders:

```typescript
// In the join page component
useEffect(() => {
    // Preload FingerprintJS in the background after page is interactive
    const timer = setTimeout(() => {
        import("@fingerprintjs/fingerprintjs");
    }, 2000); // Wait 2 seconds after page load
    return () => clearTimeout(timer);
}, []);
```

This pre-fetches the module with low priority, so it is ready when the user clicks "Join" without blocking the initial page load.

### Route-Level Code Splitting

Next.js App Router already does route-level code splitting. However, if `use-guest.ts` is imported by a layout (e.g., a context provider), it would be included in all child routes. Verify that `useGuest` is only imported directly by the join page component, not by any layout or provider.

---

## Related Issues

- **PERF-003**: Unbounded queue queries (another source of excessive data transfer)
- **PERF-006**: Blanket invalidation (triggers refetches that transfer unnecessary data)
- **PERF-007**: No staleTime (compounds the network cost of large bundles)
