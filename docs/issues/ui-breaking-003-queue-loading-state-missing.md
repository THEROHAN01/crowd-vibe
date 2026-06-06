# UI-BREAKING-003: Queue Renders Empty Instead of Loading State While Fetching

**Severity:** P2 — MEDIUM  
**Area:** UI / Owner Dashboard  
**File:** `apps/web/src/components/venue/session-dashboard.tsx` (line 247)

---

## Problem

The queue is rendered as:

```tsx
<QueueManager songs={queue.data ?? []} sessionId={sessionId} />
```

When `queue.isLoading === true`, `queue.data` is `undefined`, so `?? []` kicks in and `QueueManager` renders its "No songs in queue yet" empty state. The owner sees this empty state immediately on page load before any data has arrived, making it look like the session has no songs even when it does.

## Impact

- Initial page load shows "No songs in queue" before data arrives — looks like a bug
- Owner may start adding songs unnecessarily, causing duplicate entries
- Degrades perceived reliability of the dashboard

## Fix

Gate the `QueueManager` render on `queue.isLoading`:

```tsx
{queue.isLoading ? (
  <div className="space-y-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-16 w-full rounded-lg" />
    ))}
  </div>
) : (
  <QueueManager songs={queue.data ?? []} sessionId={sessionId} />
)}
```
