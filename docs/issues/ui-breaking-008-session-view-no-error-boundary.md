# UI-BREAKING-008: Guest Session View Has No Error Boundary — Single Error Crashes Entire Page

**Severity:** P1 — HIGH  
**Area:** UI / Guest Session  
**File:** `apps/web/src/components/session/session-view.tsx`

---

## Problem

The guest session view has no React Error Boundary wrapping its subtree. Any unhandled runtime error in any child component — `NowPlaying`, `SongQueue`, `SongSearch`, or the SSE hook — will unmount the entire session view and render a blank white page (or Next.js error overlay in dev mode).

Common triggers:
- A song object arrives from SSE with an unexpected shape (null field, missing property)
- `queryClient.setQueryData()` is called with malformed SSE data and a component tries to access a nested property
- YouTube player throws during initialization

There is no recovery path — the guest sees a white screen and has to refresh manually, with no indication of what went wrong.

## Impact

- A single malformed SSE event or bad API response crashes the entire guest experience
- Guests cannot vote, search, or interact until they refresh
- No error message, no retry button, no fallback UI

## Fix

Wrap the session view (or individual sections) in error boundaries:

```tsx
// apps/web/src/components/session/session-view.tsx
import { ErrorBoundary } from "react-error-boundary"

<ErrorBoundary fallback={<SessionErrorFallback />}>
  <NowPlaying song={nowPlaying} />
</ErrorBoundary>

<ErrorBoundary fallback={<QueueErrorFallback />}>
  <SongQueue songs={queue} sessionId={sessionId} />
</ErrorBoundary>
```

Use `react-error-boundary` (already in the ecosystem) or a custom class component.
