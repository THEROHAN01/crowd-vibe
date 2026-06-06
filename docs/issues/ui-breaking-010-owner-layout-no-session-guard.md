# UI-BREAKING-010: Owner Dashboard Has No Guard for Ended/Non-Existent Sessions

**Severity:** P1 — HIGH  
**Area:** UI / Owner Dashboard  
**File:** `apps/web/src/app/(app)/(venue)/dashboard/page.tsx`, `apps/web/src/components/venue/session-dashboard.tsx`

---

## Problem

The owner dashboard loads and renders the session view using a `sessionId` from query params or session state. There is no guard for:

1. **Session that has ended** — `VenueSession.isActive === false`. The dashboard continues to render queue management, skip controls, and the YouTube player as if the session is live.
2. **Session that doesn't exist** — navigating directly to a dashboard URL with a stale or invalid `sessionId` causes API calls to fail silently (the `queue`, `nowPlaying`, `stats` queries all return empty/null) and the UI renders as if it's a live but empty session.
3. **Venue with no session started** — the dashboard renders with no active session context, but no "Start a Session" prompt is shown in the session management area.

In all three cases, the owner sees a fully rendered dashboard UI that appears functional but all interactions fail or produce no result.

## Impact

- Owners who navigate back to the dashboard after ending a session see a ghost UI
- Direct URL access with a stale session ID presents a broken-looking empty dashboard
- No clear "session ended" state or CTA to start a new session

## Fix

Fetch session status at the top of the dashboard and gate all session-dependent UI:

```tsx
if (!session || !session.isActive) {
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <h2 className="text-lg font-semibold">No active session</h2>
      <StartSessionForm venueId={venue.id} />
    </div>
  )
}
```

Also handle `session.isError` and `session.isLoading` at this top level.
