# AUDIT-004: Song search sheet uses `bg-background` instead of `bg-card`

**Severity:** P2
**Source:** UI/UX Spec, Section 4 "Component Treatments — Song Search Bottom Sheet"
**File:** `packages/ui/src/components/sheet.tsx`, `apps/web/src/components/session/song-search.tsx`

---

## Problem

The UI/UX spec defines the song search bottom sheet with a `--card` background:

> "Background: `--card` (slightly elevated surface)"

This is intentional — in the dark theme, `--card` (`oklch(0.14 0.015 280)`) is slightly lighter than `--background` (`oklch(0.10 0.02 280)`), creating a visual elevation that communicates "this surface is above the main content." This follows Material Design 3's surface tonal elevation system where higher surfaces are lighter in dark mode.

The actual `SheetContent` component in `packages/ui/src/components/sheet.tsx` uses `bg-background` as its base class:

```tsx
className={cn(
  "bg-background fixed z-50 flex flex-col gap-4 shadow-lg transition-transform ...",
  ...
)}
```

The `song-search.tsx` component does not override this:

```tsx
<SheetContent side="bottom" className="rounded-t-2xl" showCloseButton={false}>
```

As a result, the bottom sheet and the main page content have the same background color. On the dark theme, the sheet doesn't visually "float" above the content — it blends in, making it harder for users to perceive it as a distinct layer. The only visual separation comes from the `shadow-lg` and `rounded-t-2xl` border radius.

In the light theme, `--background` and `--card` are both white (`oklch(1.00 ...)` and `oklch(0.99 ...)`), so the difference is negligible. The issue is primarily noticeable in dark mode.

## Fix

Either modify the `SheetContent` base class in `sheet.tsx` to use `bg-card` globally (affects all sheets), or add `bg-card` to the specific usage in `song-search.tsx`:

```tsx
<SheetContent side="bottom" className="rounded-t-2xl bg-card" showCloseButton={false}>
```

The per-usage approach is safer since other sheets in the app (if any) may intentionally want `bg-background`.
