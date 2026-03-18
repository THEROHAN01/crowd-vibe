# FIX-003: Card component uses `ring-1` instead of `border border-border`

**Severity:** P1
**Spec:** UI/UX Spec Section 4 "Component Treatments — Cards"

---

## Problem

The spec defines card borders as:

> "Border: 1px solid var(--border)"

The Card component uses `ring-1 ring-foreground/10` instead:

**File:** `packages/ui/src/components/card.tsx:14`
```tsx
"group/card flex flex-col gap-4 overflow-hidden rounded-lg bg-card py-4 text-sm/relaxed text-card-foreground ring-1 ring-foreground/10 ..."
```

Two issues with this:

1. **Wrong color token.** `ring-foreground/10` uses the `--foreground` color at 10% opacity. The spec says `var(--border)`, which is a dedicated border token (`oklch(0.25 0.02 280)` in dark mode). These produce different colors — `--foreground` at 10% is a near-white tint, while `--border` is a distinct dark gray.

2. **Wrong mechanism.** `ring-1` renders a `box-shadow`-based outline, not a CSS `border`. This means the card border doesn't participate in the border-box model — it can overlap adjacent content and doesn't affect the card's dimensions. Using `border` is the standard approach and what every other bordered element in the app uses.

Every other component in the codebase that needs borders uses `border border-border` (e.g., `session-dashboard.tsx` cards, `song-queue.tsx` items, `qr-display.tsx`). The Card component is the only outlier.

## Fix

In `packages/ui/src/components/card.tsx:14`, replace `ring-1 ring-foreground/10` with `border border-border`:

```tsx
"group/card flex flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card py-4 text-sm/relaxed text-card-foreground ..."
```

Also remove `ring-1 ring-foreground/10` from the CardFooter if it inherits (check line 80).
