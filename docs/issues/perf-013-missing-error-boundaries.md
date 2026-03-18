# PERF-013: Missing Error Boundaries Around Feature Components

| Field        | Value                                                                   |
|--------------|-------------------------------------------------------------------------|
| **Severity** | P2 MEDIUM                                                               |
| **Category** | Reliability / React Architecture                                        |
| **Affects**  | YouTubePlayer, SongSearch, SongQueue, VoteButton, SessionDashboard      |
| **Status**   | Open                                                                    |
| **Date**     | 2026-03-18                                                              |

---

## Problem Statement

The only error boundary in the entire application is the root-level `apps/web/src/app/error.tsx`. If any individual feature component throws a runtime error, the **entire page** crashes and the user is shown the global "Something went wrong" screen. There are no granular error boundaries around failure-prone components.

### Root Error Boundary (Only One)

**File: `apps/web/src/app/error.tsx`** (lines 1-21)

```tsx
"use client";

import { Button } from "@crowd-vibe/ui/components/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
      <h1 className="font-heading font-bold text-2xl">Something went wrong</h1>
      <p className="max-w-md text-center text-muted-foreground">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
```

This is a page-level boundary. There are no `error.tsx` files in subdirectories (e.g., `app/(venue)/dashboard/error.tsx` or `app/session/[id]/error.tsx`), and there are no React `ErrorBoundary` components wrapping individual features.

### Components That Need Error Boundaries

#### 1. YouTubePlayer (`apps/web/src/components/player/youtube-player.tsx`)

**Why it fails:** The `react-youtube` library loads a third-party YouTube IFrame API. If YouTube is blocked (corporate networks, China), the iframe fails to load, or the API returns an error, the component can throw. Additionally, passing an invalid `videoId` can cause the player to error during initialization.

**Current behavior:** A YouTube error crashes the entire `SessionDashboard`, taking down the queue, stats, QR code -- everything the venue owner needs.

**Relevant code (lines 11-33):**
```tsx
export default function YouTubePlayer({
    videoId,
    onEnded,
}: YouTubePlayerProps) {
    const handleEnd = useCallback(() => {
        onEnded();
    }, [onEnded]);

    return (
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-background">
            <YouTube
                videoId={videoId}
                opts={{
                    width: "100%",
                    height: "100%",
                    playerVars: { autoplay: 1, controls: 1 },
                }}
                onEnd={handleEnd}
                className="h-full w-full"
                iframeClassName="w-full h-full"
            />
        </div>
    );
}
```

No `onError` callback is provided to the `<YouTube>` component, and no boundary catches render errors.

#### 2. SongSearch (`apps/web/src/components/session/song-search.tsx`)

**Why it fails:** Uses `useQuery` and `useMutation` for search and suggest operations. If the tRPC client throws an unexpected error (e.g., network disconnect mid-request, JSON parse failure), or if the Sheet component from the UI library throws during render, the entire SessionView page crashes.

**Current behavior (lines 27-31):**
```tsx
const searchResults = useQuery({
    ...trpc.song.search.queryOptions({ sessionId, query: debouncedQuery }),
    enabled: debouncedQuery.length > 0,
    staleTime: 5 * 60 * 1000,
});
```

TanStack Query handles most errors internally, but render-time errors (e.g., accessing `.tracks` on an unexpected response shape) are uncaught.

#### 3. SongQueue (`apps/web/src/components/session/song-queue.tsx`)

**Why it fails:** Iterates over `songs` array and renders child `VoteButton` components. If the API returns a malformed song object (e.g., `null` title, missing `id`), the map callback throws, crashing the entire page.

**Relevant code (lines 36-41):**
```tsx
{songs.map((song) => {
    const myVote = myVotes.get(song.id) ?? 0;
    // If song.id is undefined, myVotes.get(undefined) returns undefined
    // but song.title being null would crash the <p> text rendering
```

#### 4. VoteButton (`apps/web/src/components/session/vote-button.tsx`)

**Why it fails:** Calls `castVote.mutate()` on click. If the mutation throws synchronously (e.g., the tRPC client has been torn down after session end), the error propagates up through the entire component tree.

---

## Root Cause

The application was built without a component-level error isolation strategy. Only the Next.js App Router's automatic `error.tsx` boundary exists, which catches errors at the route segment level. There is no defense-in-depth for individual feature failures.

---

## Impact Assessment

| Scenario                          | Current Behavior                                      | Expected Behavior                              |
|-----------------------------------|-------------------------------------------------------|------------------------------------------------|
| YouTube iframe fails to load      | Entire dashboard crashes                              | "Player unavailable" fallback, queue still works |
| Song search API returns bad data  | Entire guest session page crashes                     | "Search unavailable" message, queue still visible |
| Vote mutation throws              | Entire guest page crashes                             | Vote button shows error state, page remains functional |
| Song with null title in queue     | Entire page crashes on `.map()`                       | Broken song row shows fallback, rest of queue works |

**Quantified impact:** A single broken YouTube video ID can take down the venue owner's entire dashboard, preventing them from managing the session. This is a critical reliability gap for a live-event product.

---

## Fix Instructions

### Step 1: Create a Reusable ErrorBoundary Component

**File: `apps/web/src/components/ui/error-boundary.tsx`**

```tsx
"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback: ReactNode | ((error: Error, reset: () => void) => ReactNode);
    onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        this.props.onError?.(error, info);
        // Log to your error reporting service here
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    reset = () => {
        this.setState({ error: null });
    };

    render() {
        if (this.state.error) {
            const { fallback } = this.props;
            if (typeof fallback === "function") {
                return fallback(this.state.error, this.reset);
            }
            return fallback;
        }
        return this.props.children;
    }
}
```

### Step 2: Wrap YouTubePlayer

**File: `apps/web/src/components/venue/session-dashboard.tsx`**

Add an error boundary around the YouTube player section (around line 136):

```tsx
import { ErrorBoundary } from "@/components/ui/error-boundary";

// In JSX, replace the direct <YouTubePlayer> usage:
<ErrorBoundary
    fallback={
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-border bg-muted">
            <div className="text-center">
                <p className="font-medium text-muted-foreground">Player unavailable</p>
                <p className="mt-1 text-muted-foreground text-sm">
                    The video player encountered an error.
                </p>
            </div>
        </div>
    }
>
    <YouTubePlayer
        videoId={nowPlaying.data.providerId}
        onEnded={handleSongEnded}
    />
</ErrorBoundary>
```

### Step 3: Wrap SongSearch in SessionView

**File: `apps/web/src/app/session/[id]/session-view.tsx`** (around line 95)

```tsx
import { ErrorBoundary } from "@/components/ui/error-boundary";

// Wrap the search section:
<div className="border-t p-4">
    <ErrorBoundary
        fallback={
            <p className="text-center text-muted-foreground text-sm">
                Search is temporarily unavailable.
            </p>
        }
    >
        <SongSearch sessionId={sessionId} />
    </ErrorBoundary>
</div>
```

### Step 4: Wrap SongQueue in SessionView

**File: `apps/web/src/app/session/[id]/session-view.tsx`** (around line 91)

```tsx
<ErrorBoundary
    fallback={(error, reset) => (
        <div className="py-8 text-center">
            <p className="text-muted-foreground">Could not load the queue.</p>
            <button
                onClick={reset}
                className="mt-2 text-primary text-sm underline"
            >
                Try again
            </button>
        </div>
    )}
>
    <SongQueue songs={queue.data ?? []} myVotes={myVotes} />
</ErrorBoundary>
```

### Step 5: Add Route-Level Error Boundaries

Create `error.tsx` for the two main route segments:

**File: `apps/web/src/app/(venue)/dashboard/error.tsx`**

```tsx
"use client";

import { Button } from "@crowd-vibe/ui/components/button";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
            <h1 className="font-heading font-bold text-2xl">Dashboard Error</h1>
            <p className="max-w-md text-center text-muted-foreground">
                Something went wrong loading your dashboard. Your session is still active.
            </p>
            <Button onClick={reset}>Reload Dashboard</Button>
        </div>
    );
}
```

**File: `apps/web/src/app/session/[id]/error.tsx`**

```tsx
"use client";

import { Button } from "@crowd-vibe/ui/components/button";

export default function SessionError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
            <h1 className="font-heading font-bold text-2xl">Oops!</h1>
            <p className="max-w-md text-center text-muted-foreground">
                Something went wrong. The session is still live -- try reloading.
            </p>
            <Button onClick={reset}>Reload</Button>
        </div>
    );
}
```

### Step 6: Add `onError` to YouTubePlayer

**File: `apps/web/src/components/player/youtube-player.tsx`**

Add an `onError` handler to the `<YouTube>` component so player errors are caught before they become render errors:

```tsx
<YouTube
    videoId={videoId}
    opts={{
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, controls: 1 },
    }}
    onEnd={handleEnd}
    onError={(e) => {
        console.error("[YouTubePlayer] Player error:", e.data);
        // Optionally show inline error state via useState
    }}
    className="h-full w-full"
    iframeClassName="w-full h-full"
/>
```

---

## Verification

1. **YouTube error simulation:** Temporarily pass an invalid `videoId` (e.g., `"INVALID_ID_TEST"`). The player section should show the fallback UI while the rest of the dashboard remains fully functional.
2. **Search error simulation:** In the browser console, run `window.__TRPC_CLIENT__ = null` (or disconnect network). The search area should show "Search is temporarily unavailable" without crashing the queue.
3. **Queue error simulation:** Modify the API response in DevTools to include a song with `null` id. The queue section should show the fallback while the now-playing and search sections remain operational.

---

## Related Issues

- [PERF-012: No Suspense boundaries](./perf-012-no-suspense-boundaries.md) -- Suspense + ErrorBoundary should be paired for proper loading/error states
