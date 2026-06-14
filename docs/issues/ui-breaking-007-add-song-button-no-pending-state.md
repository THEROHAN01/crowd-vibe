# UI-BREAKING-007: Add Song Button Has No Pending/Disabled State During Mutation

**Severity:** P2 — MEDIUM  
**Status:** ✅ RESOLVED — commit `e478de3`  
**Area:** UI / Owner Dashboard  
**File:** `apps/web/src/components/venue/session-dashboard.tsx` (lines 74–84)

---

## Problem

The `addSong` mutation in the owner dashboard does not disable or visually update the "Add" button while the mutation is in-flight (`addSong.isPending`). This means:

- Owner can click "Add" multiple times before the first request completes
- Each click fires a separate mutation, potentially adding the same song to the queue multiple times
- The button gives no feedback that an action is being processed

The guest version (`song-search.tsx`) has the same gap — the suggest button does not show a loading state.

## Impact

- Duplicate songs appear in the queue due to double-clicks or impatient repeated clicks
- No visual affordance that the action was received
- Breaks the perceived responsiveness of the UI

## Fix

Disable the button and show a loading indicator while the mutation is pending:

```tsx
<Button
  onClick={() => addSong.mutate({ sessionId, providerId: track.id, provider: "youtube" })}
  disabled={addSong.isPending}
  size="sm"
>
  {addSong.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
</Button>
```
