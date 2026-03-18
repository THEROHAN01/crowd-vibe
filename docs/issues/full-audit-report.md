# CrowdVibe Full Audit Report — Spec & Plan vs Codebase

**Date:** 2026-03-18
**Scope:** All 3 specs and 3 plans audited against the live codebase

---

## Executive Summary

| Document | Satisfied | Partially | Not Satisfied | Total |
|----------|-----------|-----------|---------------|-------|
| MVP Spec + Plan | 47 | 3 | 0 | 50 |
| Test Infra Spec + Plan | 8 | 2 | 1 | 11 |
| UI/UX Spec | 30 | 2 | 6 | 38 |
| **Totals** | **85** | **7** | **7** | **99** |

**Overall completion: 86% fully satisfied, 93% at least partially satisfied.**

---

## 1. MVP Spec + Plan — HIGHLY COMPLETE

All 37 files-to-create exist. All 10 files-to-modify updated. All 3 files-to-delete gone. Every tRPC procedure matches its spec. Data model is exact.

### Not Satisfied
None.

### Partially Satisfied
| Requirement | Gap |
|-------------|-----|
| `queue_updated` SSE event | Defined in types but never broadcast from server — dead code, not a bug since granular events cover the same ground |
| `start-session-form.tsx` | Spec says "Spotify — Coming Soon" dropdown; implementation hardcodes `youtube` with no selector UI |
| FingerprintJS version | Spec says v4, installed v5.1.0 — API compatible, no functional impact |

---

## 2. Test Infra Spec + Plan — MOSTLY COMPLETE, 1 BLOCKER

87 total tests (47 unit + 40 integration). All test cases from the spec coverage plan are implemented. Test helpers, fixtures, and Docker config all correct.

### Not Satisfied (BLOCKER)
| Requirement | Issue |
|-------------|-------|
| `schema.prisma` missing `url = env("DATABASE_URL")` | Prisma CLI cannot connect to any database. `globalSetup.ts` (`prisma db push --force-reset`) and `test:db:reset` will both fail. **Integration tests cannot run.** |

### Partially Satisfied
| Requirement | Gap |
|-------------|-----|
| `db/index.ts` Neon conditional | Uses `PrismaPg` adapter + `await import()` instead of spec's vanilla `PrismaClient({ datasourceUrl })` — functional but departs from spec intent |
| NPM script `test:db:reset` | Uses `--config=prisma.config.ts` instead of `--schema=packages/db/prisma/schema` |

---

## 3. UI/UX Spec — WELL IMPLEMENTED, 6 GAPS

Color system, typography, component restyling, custom components, accessibility foundations all correctly implemented. Design tokens properly used throughout.

### Not Satisfied
| # | Requirement | Fix |
|---|-------------|-----|
| 1 | Logo component missing logomark (3 vertical bars) | Add `<EqualizerBars />` to Logo component |
| 2 | Landing page imports `Logo` but doesn't use it (duplicates markup inline) | Replace inline `<h1>` with `<Logo />` |
| 3 | Song search sheet uses `bg-background` not `bg-card` | Add `bg-card` to SheetContent |
| 4 | Song search sheet missing drag handle (32x4px bar) | Add drag handle div at top of SheetContent |
| 5 | Dashboard missing two-column desktop grid for player + QR | Wrap in `grid gap-6 lg:grid-cols-2` |
| 6 | Dashboard search thumbnails `alt=""` instead of `alt={track.title}` | Change to `alt={track.title}` |

### Partially Satisfied
| Requirement | Gap |
|-------------|-----|
| Session ended overlay | `backdrop-blur-sm` (4px) instead of spec's `blur(8px)`; keyboard focus not trapped behind overlay |
| Session ended keyboard trap | Content behind overlay still focusable — needs `inert` or `aria-hidden` |

---

## Priority Actions

### P0 — Blocking
1. **Add `url = env("DATABASE_URL")` to `packages/db/prisma/schema/schema.prisma`** — Without this, no integration test can run.

### P1 — Should Fix
2. Fix `alt=""` on dashboard search thumbnails → `alt={track.title}`
3. Add `inert` attribute to content behind session-ended overlay
4. Replace inline Logo markup on landing page with `<Logo />` component
5. Change `backdrop-blur-sm` to `backdrop-blur` on session-ended overlay

### P2 — Nice to Have
6. Add drag handle to song search sheet
7. Add logomark (EqualizerBars) to Logo component
8. Wrap dashboard player + QR in two-column desktop grid
9. Add `bg-card` to song search SheetContent
10. Add Spotify "Coming Soon" option to start-session form
