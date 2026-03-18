# PERF-012: No Suspense Boundaries — No Progressive Rendering or Streaming

| Field        | Value                                                                 |
|--------------|-----------------------------------------------------------------------|
| **Severity** | P2 MEDIUM                                                             |
| **Category** | Performance / React Architecture                                      |
| **Affects**  | All data-fetching pages (Dashboard, SessionView, SessionDashboard)    |
| **Status**   | Open                                                                  |
| **Date**     | 2026-03-18                                                            |

---

## Problem Statement

There are zero `<Suspense>` components anywhere in the CrowdVibe frontend codebase. Every data-fetching component uses manual `if (isLoading)` patterns instead of React Suspense boundaries. This has two major consequences:

1. **No progressive rendering** -- the entire page is blank (or shows a single root-level "Loading..." text) until all data resolves. The user sees nothing useful while data fetches complete.
2. **No streaming benefits** -- Next.js App Router supports HTML streaming via React Suspense. Without Suspense boundaries, the server cannot progressively send rendered chunks. The entire page waits for all server-side work to complete before any HTML is flushed to the client.

### Evidence: Zero Suspense Usage

A codebase-wide search confirms there is no Suspense usage:

```bash
$ grep -r "Suspense" apps/web/src/
# (no results)
```

### Components Using Manual Loading Patterns

#### 1. `apps/web/src/app/(venue)/dashboard/dashboard.tsx` (lines 18-22)

```tsx
const venues = useQuery(trpc.venue.listMine.queryOptions());

if (venues.isLoading) {
    return (
        <div className="flex items-center justify-center p-8">Loading...</div>
    );
}
```

This blocks the **entire dashboard** (including the header, stats, QR code, and queue) behind a single "Loading..." string. The user cannot see or interact with any part of the dashboard until the venue list API call completes.

#### 2. `apps/web/src/app/session/[id]/session-view.tsx` (lines 17-21)

```tsx
const queue = useQuery(trpc.queue.list.queryOptions({ sessionId }));
const nowPlaying = useQuery(
    trpc.queue.nowPlaying.queryOptions({ sessionId }),
);
const guestInfo = useQuery(trpc.guest.me.queryOptions());
```

Three parallel queries fire, but none is wrapped in Suspense. The page renders all-or-nothing. The top bar, "Now Playing" hero, queue, and search are all invisible until every query completes. On slow connections this means 1-3 seconds of a blank white screen.

#### 3. `apps/web/src/components/venue/session-dashboard.tsx` (lines 42-51)

```tsx
const queue = useQuery(trpc.queue.list.queryOptions({ sessionId }));
const nowPlaying = useQuery(
    trpc.queue.nowPlaying.queryOptions({ sessionId }),
);
const stats = useQuery(trpc.session.stats.queryOptions({ sessionId }));
const searchResults = useQuery({
    ...trpc.song.search.queryOptions({ sessionId, query: debouncedSearch }),
    enabled: debouncedSearch.length > 0,
    staleTime: 5 * 60 * 1000,
});
```

Four queries in a single component with no Suspense boundaries. The venue owner sees nothing until queue, now-playing, stats, and search all resolve.

---

## Root Cause

The app was built using TanStack Query's `useQuery` hook exclusively, which returns `{ isLoading, data, error }` and expects manual conditional rendering. This is a valid pattern but misses the progressive rendering and streaming opportunities that React 19 + Next.js App Router provide when Suspense is used.

The `page.tsx` server components (e.g., `apps/web/src/app/(venue)/dashboard/page.tsx`) render their client children synchronously without wrapping them in `<Suspense>`, so there is no boundary for Next.js to use as a streaming flush point.

---

## Impact Assessment

| Dimension               | Impact                                                                 |
|--------------------------|------------------------------------------------------------------------|
| **Perceived performance**| Users see a blank/loading screen for 500ms-3s instead of progressive content |
| **Time to First Byte**   | Streaming is disabled; TTFB matches the slowest data dependency        |
| **Largest Contentful Paint (LCP)** | Delayed because no content is painted until all data loads  |
| **React 19 benefits**    | None of the streaming/concurrent features are utilized                 |
| **User experience**      | Venue owners and guests both see "Loading..." with no skeleton/shimmer |

---

## Fix Instructions

### Step 1: Create Skeleton Components

Create loading skeleton components for each major section.

**File: `apps/web/src/components/ui/skeleton-queue.tsx`**

```tsx
export function QueueSkeleton() {
    return (
        <div className="grid gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                    <div className="h-12 w-12 animate-pulse rounded-md bg-muted" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                </div>
            ))}
        </div>
    );
}
```

**File: `apps/web/src/components/ui/skeleton-now-playing.tsx`**

```tsx
export function NowPlayingSkeleton() {
    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <div className="h-5 w-28 animate-pulse rounded bg-muted mb-3" />
            <div className="aspect-video w-full animate-pulse rounded-lg bg-muted" />
            <div className="mt-3 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </div>
        </div>
    );
}
```

### Step 2: Wrap Client Components in Suspense at the Page Level

**File: `apps/web/src/app/(venue)/dashboard/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@crowd-vibe/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Dashboard from "./dashboard";
import { DashboardSkeleton } from "@/components/ui/skeleton-dashboard";

export const metadata: Metadata = {
    title: "Dashboard -- CrowdVibe",
};

export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/login");
    }

    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <Dashboard userId={session.user.id} userName={session.user.name} />
        </Suspense>
    );
}
```

**File: `apps/web/src/app/session/[id]/page.tsx`**

```tsx
import { Suspense } from "react";
import SessionView from "./session-view";
import { QueueSkeleton } from "@/components/ui/skeleton-queue";

export default async function SessionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <Suspense fallback={<QueueSkeleton />}>
            <SessionView sessionId={id} />
        </Suspense>
    );
}
```

### Step 3: Add Inner Suspense Boundaries for Progressive Rendering

Inside `SessionView`, wrap independent sections so they can stream independently:

```tsx
import { Suspense } from "react";
import { NowPlayingSkeleton } from "@/components/ui/skeleton-now-playing";
import { QueueSkeleton } from "@/components/ui/skeleton-queue";

// In the JSX:
<Suspense fallback={<NowPlayingSkeleton />}>
    <NowPlaying song={nowPlaying.data ?? null} />
</Suspense>

<Suspense fallback={<QueueSkeleton />}>
    <SongQueue songs={queue.data ?? []} myVotes={myVotes} />
</Suspense>
```

### Step 4: Enable TanStack Query Suspense Mode (Optional Enhancement)

To fully leverage Suspense with TanStack Query, use `useSuspenseQuery` instead of `useQuery`:

```tsx
import { useSuspenseQuery } from "@tanstack/react-query";

// Before:
const queue = useQuery(trpc.queue.list.queryOptions({ sessionId }));

// After:
const queue = useSuspenseQuery(trpc.queue.list.queryOptions({ sessionId }));
// No need for `if (isLoading)` -- Suspense handles it
```

This requires that each `useSuspenseQuery` call is inside a `<Suspense>` boundary; otherwise it will throw.

---

## Verification

1. Run the app and open Chrome DevTools Network tab with "Slow 3G" throttling
2. Navigate to `/dashboard` -- you should see skeleton content immediately, then data streaming in
3. Navigate to `/session/[id]` -- the top bar and skeleton should appear first, then queue and now-playing fill in progressively
4. Check the Response in DevTools: the HTML should arrive in chunks (transfer-encoding: chunked) instead of a single large payload

---

## Related Issues

- [PERF-013: Missing error boundaries around feature components](./perf-013-missing-error-boundaries.md) -- Suspense boundaries need paired ErrorBoundary for proper fallback
