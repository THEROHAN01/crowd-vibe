# UI-BREAKING-006: Song Thumbnails Have No Fallback on Load Error

**Severity:** P2 — MEDIUM  
**Status:** ✅ RESOLVED — commits `bd26d30` (song-queue) + `5fba6cc` (song-search)  
**Area:** UI / Guest Session + Owner Dashboard  
**Files:** `apps/web/src/components/session/song-queue.tsx` (lines 95–102), `apps/web/src/components/session/song-search.tsx` (lines 50–58)

---

## Problem

Song thumbnail `<img>` elements use `src={track.thumbnailUrl}` with no `onError` handler and no fallback UI. YouTube thumbnail URLs can fail when:

- The video has been deleted or made private after being added to the queue
- The thumbnail CDN is temporarily unreachable
- The URL format is invalid (non-standard YouTube video IDs)

When this happens, the browser renders a broken image icon inside the fixed-size thumbnail container, breaking the visual layout of every song card.

## Impact

- Broken image icons appear in the queue for every song with a dead thumbnail
- Layout remains intact (fixed dimensions), but visual quality is severely degraded
- No music note fallback or placeholder shown

## Fix

Add an `onError` handler with a fallback:

```tsx
<img
  src={song.thumbnailUrl}
  alt={song.title}
  className="h-10 w-10 shrink-0 rounded object-cover"
  onError={(e) => {
    e.currentTarget.src = "/placeholder-track.svg"
  }}
/>
```

Or use a state-based approach to swap to a `<MusicIcon />` Lucide component on failure.
