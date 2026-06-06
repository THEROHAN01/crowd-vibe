# UI-BREAKING-004: Guest Suggest Song Mutation Has No onError Handler

**Severity:** P2 — MEDIUM  
**Area:** UI / Guest Session  
**File:** `apps/web/src/components/session/song-search.tsx` (lines 38–50)

---

## Problem

The `suggestSong` mutation in `song-search.tsx` is missing an `onError` handler. When a guest tries to suggest a song and the call fails (quota exceeded, cooldown active, network error, session ended), the mutation fails silently:

- No toast is shown
- No error message appears in the UI
- The sheet stays open and the guest has no idea if the action succeeded or failed
- The button may re-enable, inviting the guest to retry without knowing why it failed

This is especially damaging for quota/cooldown errors — the guest is blocked from suggesting but receives no explanation.

## Impact

- Guests hit their 5-suggestion quota with no feedback
- Cooldown errors (30s between suggestions) are invisible
- Any network failure during suggestion is swallowed silently

## Fix

Add `onError` to the mutation:

```tsx
const suggestSong = trpc.song.suggest.useMutation({
  onSuccess: () => {
    toast.success("Song added to the queue!")
    setSearch("")
    onClose?.()
  },
  onError: (err) => toast.error(err.message),
})
```
