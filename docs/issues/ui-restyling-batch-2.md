# UI Restyling Batch 2 — Code Review

**Date:** 2026-03-18
**Commits reviewed:**
- `9255fd9` — Add shadcn Sheet, Badge, Dialog, Separator, Tooltip, ScrollArea
- `c5e20f1` — Add Logo, LiveBadge, StatCard, EqualizerBars components
- `e7368ef` — Remove dead mock override in song duplicate test
- `5f0010f` — Restyle all page components with design system
- `079da49` — Restyle dashboard, landing page, header, and add polish

---

## Issues

### ISSUE-01: `SheetTrigger` uses `render` prop — not standard shadcn/Radix API

**File:** `apps/web/src/components/session/song-search.tsx:52-57`
**Severity:** MEDIUM
**Description:** The `SongSearch` component uses `<SheetTrigger render={<Button>...</Button>} />`. The standard shadcn `SheetTrigger` uses `asChild` with a child element, not a `render` prop:
```tsx
<SheetTrigger asChild>
  <Button variant="tonal" className="w-full" size="lg">...</Button>
</SheetTrigger>
```

If the installed `Sheet` component is based on Radix Dialog (standard shadcn), the `render` prop won't do anything — it's not part of the Radix API. If it's based on Base UI, `render` may be valid. Need to verify which primitive the sheet uses.

**Recommendation:** Check `packages/ui/src/components/sheet.tsx` to confirm whether `render` or `asChild` is the correct API.

---

### ISSUE-02: `SongSearch` Sheet doesn't close after successful suggestion

**File:** `apps/web/src/components/session/song-search.tsx:38-41`
**Severity:** MEDIUM
**Description:** The old implementation used local `isOpen` state and set it to `false` in `onSuccess`. The new `Sheet`-based implementation doesn't control open/close state — it relies on shadcn's internal sheet state. After a successful suggestion, `queryClient.invalidateQueries()` runs and `setQuery("")` clears the search, but the sheet stays open. The user has to manually close it.

**Recommendation:** Use controlled state with `<Sheet open={open} onOpenChange={setOpen}>` and set `setOpen(false)` in `onSuccess`.

---

### ISSUE-03: `EqualizerBars` uses inline `<style>` tag — renders on every mount

**File:** `apps/web/src/components/ui/equalizer-bars.tsx:7-21`
**Severity:** LOW
**Description:** The `@keyframes equalize` and `.animate-equalize` styles are injected via an inline `<style>` tag inside the component. Every time `NowPlaying` re-renders (e.g., on SSE vote events), this `<style>` tag is re-inserted into the DOM. While browsers deduplicate identical style blocks, this is wasteful.

**Recommendation:** Move the keyframes to `globals.css` or use Tailwind's `@keyframes` extension in `tailwind.config`. The `prefers-reduced-motion` media query is a good accessibility touch — preserve it.

---

### ISSUE-04: `&amp;` in JSX — HTML entity renders literally in JSX

**File:** `apps/web/src/components/session/song-search.tsx:55`
**Severity:** LOW
**Description:** `Search &amp; Add Songs` — in JSX, `&amp;` renders as the literal text `&amp;`, not `&`. JSX uses JavaScript string semantics, not HTML entities. The correct JSX is `Search & Add Songs` or `Search &amp; Add Songs` only inside raw HTML attributes.

Actually, looking more closely — this is inside a JSX child text node. In React JSX, `&amp;` IS correctly interpreted as `&` because JSX text children do process HTML entities. So this is functionally correct but unconventional. Most React code just uses `&` directly.

**Recommendation:** No action needed — functionally correct. Style preference only.

---

### ISSUE-05: Previous review docs deleted in `5f0010f`

**File:** `docs/issues/task-01-*.md` through `docs/issues/task-13-14-*.md` (12 files deleted)
**Severity:** INFO
**Description:** The commit `5f0010f` deleted most of the review docs from `docs/issues/`. These are historical review records. While they're preserved in git history, removing them from the working tree means future conversations lose easy access to the review trail.

---

## Previously Flagged Issues — Resolved

| Issue | Resolution |
|---|---|
| `VoteButton` hardcoded `text-green-500`/`text-red-500` | **Fixed** — now uses `bg-upvote/15 text-upvote` / `bg-downvote/15 text-downvote` from design tokens |
| `SongSearch` full-screen overlay vs bottom sheet | **Fixed** — now uses shadcn `Sheet` with `side="bottom"` |
| Session ended overlay — simple div vs blurred overlay | **Fixed** — now uses `fixed inset-0 z-50 bg-background/95 backdrop-blur-sm` |
| Stats as inline text, not cards | **Fixed** — now uses `StatCard` component with icons |
| Missing `rounded-md` on button/input | **Fixed** — both now have `rounded-md` in base classes |
| Dead mock in song duplicate test | **Fixed** in `e7368ef` — mock override removed |
| No `tonal` button variant | **Fixed** (previous commit) — verified still present |
| Missing `Logo`, `LiveBadge`, `EqualizerBars` components | **Fixed** — all created in `c5e20f1` |
| `NowPlaying` missing glow border | **Fixed** — uses `border-primary/20` + `box-shadow` with `color-mix` |
| Dashboard QR not in two-column grid | Still at bottom — acceptable for MVP |

## Component Quality

- **Logo:** Clean, uses `font-heading`, `text-primary` for "Vibe". Two sizes. Good.
- **LiveBadge:** Animated ping dot with `bg-accent`. Accessible text label. Good.
- **StatCard:** Uses Lucide icon type, `tabular-nums` for numbers, uppercase label with tracking. Matches spec. Good.
- **EqualizerBars:** `aria-hidden="true"` (decorative), `prefers-reduced-motion` support. Good accessibility.
- **VoteButton:** 44px touch target (`w-11 h-11`), rounded-full, uses design tokens (`text-upvote`/`text-downvote`). `active:scale-[0.85]` with `ease-spring`. Clean.
- **SongQueue:** Uses `text-score-positive`/`text-score-negative`/`text-score-neutral` tokens. `aria-live="polite"` on container. Good.
- **SessionDashboard:** Uses `StatCard`, `LiveBadge`, `font-heading` on headings. Clean.

---

## Summary

| ID | Severity | Status |
|----|----------|--------|
| ISSUE-01 | MEDIUM | `SheetTrigger render` prop — verify against sheet primitive API |
| ISSUE-02 | MEDIUM | Sheet doesn't close after successful song suggestion |
| ISSUE-03 | LOW | `EqualizerBars` inline `<style>` re-inserted on every render |
| ISSUE-04 | LOW | `&amp;` in JSX — functionally correct, stylistically unconventional |
| ISSUE-05 | INFO | Previous review docs deleted from working tree |

**Verdict:** Major design system implementation complete. VoteButton, NowPlaying, SessionDashboard, SongSearch all restyled per spec. The two MEDIUM issues (SheetTrigger API and Sheet not closing on success) should be verified/fixed.
