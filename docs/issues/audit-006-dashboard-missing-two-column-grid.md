# AUDIT-006: Dashboard missing two-column desktop grid for player + QR code

**Severity:** P2
**Source:** UI/UX Spec, Section 5 "Page Layouts — Venue Owner Dashboard"
**File:** `apps/web/src/components/venue/session-dashboard.tsx`

---

## Problem

The UI/UX spec defines the dashboard's live session layout as:

> "Two-column grid (desktop): Now Playing with YouTube player + QR code display"

The intent is that on desktop screens (≥1024px), the YouTube player and QR code sit side by side, giving the venue owner a compact view of both the current song and the join information. On mobile, they stack vertically.

The current implementation renders all sections in a single-column vertical stack:

```tsx
<div className="container mx-auto max-w-4xl px-4 py-4 grid gap-6">
  {/* Header */}
  {/* Stats */}
  {/* Now Playing + Player */}    ← full width
  {/* Owner Song Search + Add */}
  {/* Queue */}
  {/* QR Code */}                 ← full width, at the very bottom
</div>
```

The QR code is pushed to the very bottom of the page, below the queue. A venue owner setting up their session has to scroll past the entire queue to find the QR code they need to display for customers. This is a poor workflow — the QR code is the first thing they need after starting a session.

The spec's two-column layout solves this by placing the QR code at the same visual level as the player, making it immediately visible without scrolling.

## Fix

Wrap the "Now Playing" section and `QRDisplay` in a responsive two-column grid:

```tsx
{/* Now Playing + QR Code — two columns on desktop */}
<div className="grid gap-6 lg:grid-cols-[1fr_auto]">
  {/* Now Playing + Player */}
  <div className="bg-card border border-border rounded-lg p-4">
    <h2 className="font-heading font-semibold mb-3">Now Playing</h2>
    {/* ... existing player content ... */}
  </div>

  {/* QR Code — right column on desktop, stacks below on mobile */}
  <QRDisplay joinCode={joinCode} />
</div>
```

Using `lg:grid-cols-[1fr_auto]` gives the player the remaining space while the QR code takes its natural width. On screens below `lg` (1024px), they stack vertically. The `auto` column prevents the QR code from stretching unnecessarily wide.

Move the `<QRDisplay>` from its current position at the bottom of the page into this grid alongside the player.
