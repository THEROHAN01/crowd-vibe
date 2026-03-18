# AUDIT-007: Dashboard search thumbnails have empty alt text

**Severity:** P1
**Source:** UI/UX Spec, Section 7 "Accessibility"; Section 12 "Pre-Delivery Checklist"
**File:** `apps/web/src/components/venue/session-dashboard.tsx:196`

---

## Problem

The spec's accessibility section requires:

> "Alt text: All meaningful images — Thumbnail alt = song title"

And the pre-delivery checklist confirms:

> "Alt text on all images"

In the owner's song search results within `session-dashboard.tsx`, thumbnails are rendered with empty alt text:

```tsx
{track.thumbnailUrl && <img src={track.thumbnailUrl} alt="" className="w-10 h-10 rounded" />}
```

`alt=""` tells screen readers to skip the image entirely (treating it as decorative). However, these thumbnails are **meaningful** images — they're the primary visual identifier for a song in the search results. A venue owner using a screen reader would hear "Test Song, Test Artist, Add button" but miss the visual context that sighted users get from the thumbnail.

For comparison, the guest-facing components handle this inconsistently:
- `now-playing.tsx` correctly uses `alt={song.title}`
- `song-queue.tsx` uses `alt=""` (acceptable there because the song title is immediately adjacent in text)
- `queue-manager.tsx` uses `alt=""` (same reasoning)
- `session-dashboard.tsx` search results use `alt=""` (NOT acceptable — these are search results where the thumbnail helps distinguish between songs with similar names)

The distinction is: when the image is next to its text label in a list, `alt=""` is acceptable to avoid redundancy. But in search results where users are scanning visually to pick the right song, the thumbnail carries independent meaning.

## Fix

Change `alt=""` to `alt={track.title}` on the thumbnail in the search results:

```tsx
{track.thumbnailUrl && <img src={track.thumbnailUrl} alt={track.title} className="w-10 h-10 rounded" />}
```

This gives screen readers: "Test Song thumbnail, Test Song, Test Artist, Add button" — slightly redundant for the title, but correctly communicates the image's purpose.
