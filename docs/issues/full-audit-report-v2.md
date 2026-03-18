# CrowdVibe Full Audit Report v2 — Spec & Plan vs Codebase (Re-Audit)

**Date:** 2026-03-18
**Scope:** All 3 specs and 3 plans re-audited after fix commit `6a78bc6`

---

## Executive Summary

| Document | Satisfied | Partially | Not Satisfied | Total | Change |
|----------|-----------|-----------|---------------|-------|--------|
| MVP Spec + Plan | 49 | 1 | 0 | 50 | +2 satisfied |
| Test Infra Spec + Plan | 10 | 1 | 0 | 11 | **Blocker resolved**, +2 satisfied |
| UI/UX Spec | 35 | 1 | 2 | 38 | +5 satisfied, -4 not satisfied |
| **Totals** | **94** | **3** | **2** | **99** | **+9 satisfied, -5 not satisfied** |

**Overall: 95% fully satisfied, 98% at least partially satisfied.**

**Previous blocker (schema.prisma missing `url`) is resolved.**
**6 of 8 previous audit issues fixed. 2 remain.**

---

## Previous Audit Issues — Resolution Status

| # | Issue | Previous | Current |
|---|-------|----------|---------|
| AUDIT-001 | schema.prisma missing `url = env("DATABASE_URL")` | **BLOCKER** | **FIXED** |
| AUDIT-002 | Logo missing logomark (3 bars) | NOT SATISFIED | **FIXED** — SVG logomark with 3 staggered rects added |
| AUDIT-003 | Landing page duplicates Logo markup | NOT SATISFIED | **FIXED** — uses `<Logo size="lg" />` inside `<h1>` |
| AUDIT-004 | Song search sheet bg-background | NOT SATISFIED | **FIXED** — `bg-card` class added |
| AUDIT-005 | Song search missing drag handle | NOT SATISFIED | **FIXED** — `h-1 w-8 rounded-full bg-muted-foreground/40` added |
| AUDIT-006 | Dashboard missing two-column grid | NOT SATISFIED | **FIXED** — `lg:grid-cols-[1fr_auto]` wraps player + QR |
| AUDIT-007 | Dashboard thumbnails empty alt | NOT SATISFIED | **FIXED** — `alt={track.title}` |
| AUDIT-008 | Session ended overlay gaps | NOT SATISFIED | **PARTIALLY FIXED** — blur changed to 8px; focus trap + pointer-events still missing |

---

## Remaining Issues (2)

### REMAINING-01: Session ended overlay has no focus trap

**Severity:** P1
**File:** `apps/web/src/app/session/[id]/session-view.tsx:53`
**Spec:** UI/UX Spec Section 11 — "All underlying elements disabled"

The session-ended overlay is a bare `<div>`. It visually covers the viewport with `fixed inset-0 z-50 bg-background/95 backdrop-blur`, but keyboard users can Tab through vote buttons, queue items, and the search trigger behind it. There is no `role="dialog"`, no `aria-modal`, and no focus trap.

The codebase already has a `Dialog` component (`packages/ui/src/components/dialog.tsx`) that provides built-in focus trapping, `aria-modal`, and Escape key support. Using it (or adding `inert` to the content wrapper) would resolve this.

### REMAINING-02: Content behind session ended overlay not disabled

**Severity:** P1
**File:** `apps/web/src/app/session/[id]/session-view.tsx:64-86`
**Spec:** UI/UX Spec Section 11 — "pointer-events-none on content behind overlay"

When `sessionEnded` is true, the underlying content (top bar, NowPlaying, queue, search button) has no `pointer-events-none` applied. Mouse/touch users can still interact with elements behind the overlay (though the overlay intercepts most clicks). The spec explicitly requires disabled content behind the overlay.

Fix: Either wrap the non-overlay content in `<div className={sessionEnded ? "pointer-events-none" : ""} inert={sessionEnded || undefined}>` or conditionally render the content only when `!sessionEnded`.

---

## MVP Spec + Plan — Status

**49/50 SATISFIED, 1 PARTIALLY SATISFIED**

The one partial: `SongSearch` hardcodes `maxSuggestions = 5` client-side instead of reading from venue settings. Server still enforces the real limit. Harmless for MVP where settings UI isn't built and the default is always 5, but diverges from spec intent.

Everything else is fully implemented: all 39 created files exist, all 3 deleted files gone, all 10 modified files updated, every tRPC procedure correct, data model exact, SSE system complete, auth flows working.

---

## Test Infra Spec + Plan — Status

**10/11 SATISFIED, 1 PARTIALLY SATISFIED**

The one partial: `test:db:reset` npm script uses `--config=packages/db/prisma.config.ts` (Prisma 7 approach) instead of `--schema=packages/db/prisma/schema`. The `prisma.config.ts` calls `dotenv.config({ path: "../../apps/web/.env" })`, which could theoretically override the test DATABASE_URL. In practice, dotenv's default "no-override" behavior protects against this, but it's fragile.

Everything else is correct: Vitest 4.x config, Docker DB, .env.test, globalSetup safety guard, test helpers, all 47 unit tests passing, all 40 integration tests covering every spec case.

---

## UI/UX Spec — Status

**35/38 SATISFIED, 1 PARTIALLY SATISFIED, 2 NOT SATISFIED**

The 2 remaining items are both about the session-ended overlay (REMAINING-01 and REMAINING-02 above). The 1 partial is the blur being technically fixed but the overall overlay lacking proper modal/inert behavior.

All other UI/UX requirements are fully met: color system, typography, component restyling, custom components (Logo with logomark, LiveBadge, StatCard, EqualizerBars), page layouts, design tokens in VoteButton/NowPlaying/SongQueue, shadcn components, accessibility (aria-live, touch targets, reduced motion, skip nav), dark mode default.
