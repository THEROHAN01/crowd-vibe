# FIX-006: Logo `sm` logomark is 20px, below spec's 24px minimum

**Severity:** P2
**Spec:** UI/UX Spec Section 1 "Brand Identity — Logo Concept"

---

## Problem

The spec states:

> "Minimum size: 24px height for logomark"

The Logo component's `sm` size variant renders the logomark at `h-5 w-5` = 20px:

**File:** `apps/web/src/components/ui/logo.tsx:25`
```tsx
const sizes = {
  sm: { text: "text-lg", mark: "h-5 w-5" },
  default: { text: "text-2xl", mark: "h-6 w-6" },
  lg: { text: "text-5xl", mark: "h-10 w-10" },
};
```

The `sm` size is used in the header (`header.tsx`) and the guest session top bar (`session-view.tsx`). At 20px, the 3-bar logomark becomes difficult to distinguish — the bars are only ~3px wide at that scale, losing the visual identity.

The `default` (24px) and `lg` (40px) sizes both meet the minimum.

## Fix

Change `sm` mark size from `h-5 w-5` to `h-6 w-6`:

```tsx
sm: { text: "text-lg", mark: "h-6 w-6" },
```

This brings the `sm` logomark to exactly 24px — the stated minimum.
