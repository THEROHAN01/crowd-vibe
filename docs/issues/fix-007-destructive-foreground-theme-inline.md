# FIX-007: `--color-destructive-foreground` missing from `@theme inline`

**Severity:** P2
**Spec:** UI/UX Spec Section 2 "Color System — @theme inline Mappings"

---

## Problem

The spec says to preserve all existing shadcn color mappings in the `@theme inline` block. The `--color-destructive-foreground` mapping is absent:

**File:** `packages/ui/src/styles/globals.css` — `@theme inline` block (around line 164)

The block maps `--color-destructive: var(--destructive)` but does NOT include `--color-destructive-foreground: var(--destructive-foreground)`.

This means Tailwind 4 will not generate `text-destructive-foreground` or `bg-destructive-foreground` utility classes. Any component attempting to use these utilities will get no styling applied.

Currently no component uses `text-destructive-foreground` directly (the destructive button variant uses `text-destructive` with `bg-destructive/10`), so this is not causing a visible bug. However, it breaks the completeness of the design token system — if someone adds a destructive action that needs foreground-colored text on a destructive background, the utility won't work.

## Fix

Add to the `@theme inline` block alongside the existing `--color-destructive` mapping:

```css
--color-destructive-foreground: var(--destructive-foreground);
```
