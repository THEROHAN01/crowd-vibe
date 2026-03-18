# FIX-002: Join page card uses `rounded-xl` (16px) instead of `rounded-lg` (12px)

**Severity:** P1
**Spec:** UI/UX Spec Section 4 "Component Treatments — Cards"

---

## Problem

The spec defines card border radius as:

> "Radius: 12px (rounded-lg = --radius)"

The `--radius` token is set to `0.75rem` (12px). Tailwind's `rounded-lg` maps to this value. The join page card uses `rounded-xl` instead, which maps to `calc(var(--radius) + 4px)` = 16px.

**File:** `apps/web/src/app/join/[joinCode]/page.tsx:56`
```tsx
<div className="w-full max-w-sm rounded-xl border border-primary/20 shadow-lg shadow-primary/5 bg-card p-6 grid gap-4">
```

This makes the join page card visually inconsistent with every other card in the app (all using `rounded-lg` via the Card component). The 4px difference is subtle but noticeable when the join page card appears alongside the standard design system.

## Fix

Change `rounded-xl` to `rounded-lg`:

```tsx
<div className="w-full max-w-sm rounded-lg border border-primary/20 shadow-lg shadow-primary/5 bg-card p-6 grid gap-4">
```
