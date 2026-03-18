# AUDIT-008: Session ended overlay — blur value wrong and keyboard focus not trapped

**Severity:** P1
**Source:** UI/UX Spec, Section 11 "Interaction States — Session Ended Overlay"
**File:** `apps/web/src/app/session/[id]/session-view.tsx:37-44`

---

## Problem

The session ended overlay has two deviations from the spec:

### Issue A: `backdrop-blur-sm` is 4px, spec requires 8px

The spec defines:

> "Background: `--background` at 95% opacity + `backdrop-filter: blur(8px)`"

The implementation uses:

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
```

Tailwind's `backdrop-blur-sm` applies `backdrop-filter: blur(4px)`. The spec requires `blur(8px)`, which is Tailwind's `backdrop-blur` (without a size suffix). This means the content behind the overlay is less blurred than intended — users can still partially read the queue and now-playing content through the overlay, which undermines the "session is over, stop looking at the queue" visual signal.

### Issue B: Content behind overlay is still keyboard-focusable

The spec requires:

> "All underlying elements disabled (pointer-events-none on content behind overlay)"

The `fixed inset-0` overlay visually covers the entire viewport and blocks mouse/touch interactions (the overlay intercepts pointer events). However, **keyboard navigation is not blocked**. A user pressing Tab can still focus on vote buttons, search buttons, and other interactive elements behind the overlay. This creates a confusing experience:

1. Screen reader users hear "Upvote button" when tabbing, even though the session has ended
2. Pressing Enter on a focused vote button behind the overlay would attempt to cast a vote on an ended session (which would fail with a server error, but shouldn't be reachable)
3. The overlay's "Session Ended" message and the focusable elements behind it create contradictory states

The current component structure makes this tricky — when `sessionEnded` is true, the overlay replaces the entire content via a conditional return:

```tsx
if (sessionEnded) {
  return (
    <div className="fixed inset-0 z-50 ...">
      {/* overlay content */}
    </div>
  );
}
// ... normal session content
```

Because the overlay *replaces* the content (not overlays it), there's actually no content behind it in the DOM. The spec's description implies the overlay is rendered ON TOP of existing content (with blur showing the content beneath), but the implementation removes the content entirely.

This means Issue B is actually a non-issue in the current implementation — there are no elements behind the overlay to focus on. However, it also means the `backdrop-blur` has nothing to blur (since the content is gone), making the blur purely decorative (blurring the empty background).

## Fix

**For Issue A** — Change `backdrop-blur-sm` to `backdrop-blur`:

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur">
```

**For the architectural mismatch** — If the spec's intent is to show blurred content behind the overlay (creating a frosted-glass effect over the queue), the implementation needs to change from a conditional return to a parallel render:

```tsx
return (
  <div className="flex flex-col h-full max-w-lg mx-auto">
    {sessionEnded && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur">
        {/* overlay content */}
      </div>
    )}
    {/* Session ended: mark content as inert so keyboard can't reach it */}
    <div className={sessionEnded ? "pointer-events-none" : ""} inert={sessionEnded || undefined}>
      {/* ... normal session content ... */}
    </div>
  </div>
);
```

The `inert` HTML attribute prevents all keyboard and assistive technology interaction with the content behind the overlay. This is the modern replacement for `aria-hidden` + `tabindex="-1"` hacks.

If the current "replace content" approach is preferred (simpler, no inert needed), then the `backdrop-blur` is purely cosmetic and the spec should be updated to reflect this choice.
