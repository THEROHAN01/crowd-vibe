# UI-BREAKING-005: SSE Connection Failures Give Users No Feedback

**Severity:** P2 — MEDIUM  
**Area:** UI / Realtime / Guest + Owner  
**File:** `apps/web/src/hooks/use-session-events.ts` (lines 107–111)

---

## Problem

The `eventSource.onerror` handler only calls `onReconnect()` when the connection is in `CONNECTING` state. It does not handle the case where SSE fails permanently (e.g., 401, 403, 500 from the server, or network goes offline). In these cases:

- The EventSource silently stops receiving events
- The user sees a frozen UI — votes, song changes, and queue updates stop arriving
- No banner, toast, or indicator tells the user their real-time connection is broken
- Users do not know to refresh the page

For a product whose entire value proposition is real-time crowd voting, a silent SSE failure is functionally equivalent to the app being down.

## Impact

- Guests cast votes and see no score change — assume the app is broken
- Owner sees a frozen queue and can't tell if it's a real issue or just quiet
- Session-ended events may never arrive, leaving guests on a dead session page

## Fix

Track connection status and surface it to the UI:

```tsx
// In use-session-events.ts
eventSource.onerror = () => {
  setConnected(false)
  onDisconnect?.()
}

// In session-view.tsx / session-dashboard.tsx
{!isConnected && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-full text-sm">
    Connection lost — updates paused
  </div>
)}
```
