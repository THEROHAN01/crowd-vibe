# AUDIT-005: Song search sheet missing drag handle

**Severity:** P2
**Source:** UI/UX Spec, Section 4 "Component Treatments — Song Search Bottom Sheet"
**File:** `apps/web/src/components/session/song-search.tsx`

---

## Problem

The UI/UX spec defines a drag handle at the top of the song search bottom sheet:

> "Drag handle: 32x4px, centered, `--muted-foreground` bg"

This is a standard mobile UI pattern for bottom sheets — a small horizontal bar at the top that visually communicates "this sheet can be swiped." It appears in Google Maps, Apple Music, Spotify, and virtually every mobile app with a bottom sheet.

The current implementation has no drag handle:

```tsx
<SheetContent side="bottom" className="rounded-t-2xl" showCloseButton={false}>
  <div className="p-4 border-b">
    <Input autoFocus placeholder="Search songs..." ... />
    ...
```

The sheet opens directly with the search input. Without the drag handle:

1. **Users have no visual affordance** that the sheet can be dismissed by swiping down (if the Sheet component supports gesture dismissal) or that it's a temporary overlay
2. **The sheet looks like a page transition** rather than a floating panel, because there's no visual indicator of its "sheet-ness"
3. **Accessibility**: sighted users lose a visual cue about the interactive nature of the element

This matters because CrowdVibe's primary audience is venue customers on mobile phones. The bottom sheet is the main interaction point for adding songs — the drag handle is their visual anchor for understanding the UI.

## Fix

Add a drag handle element as the first child of `SheetContent`:

```tsx
<SheetContent side="bottom" className="rounded-t-2xl bg-card" showCloseButton={false}>
  <div className="mx-auto mt-2 mb-1 h-1 w-8 rounded-full bg-muted-foreground/40" />
  <div className="p-4 border-b">
    <Input autoFocus placeholder="Search songs..." ... />
    ...
```

The handle is `w-8` (32px), `h-1` (4px), `rounded-full`, centered via `mx-auto`, and uses `bg-muted-foreground/40` for a subtle but visible appearance. The `mt-2 mb-1` spacing gives it room to breathe above the search input.
