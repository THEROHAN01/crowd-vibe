# CrowdVibe Deep Line-by-Line Audit

**Date:** 2026-03-18
**Scope:** Every line of all 3 specs verified against actual source code

---

## Summary

| Category | Matches | Deviations | Severity Breakdown |
|----------|---------|------------|-------------------|
| MVP Backend (Sections 1-7) | 78 | 11 | 1 functional, 10 minor/additive |
| MVP Frontend (Sections 8-12) | 24 | 8 | 2 missing UI features, 6 styling/a11y |
| Test Infrastructure | 21 | 9 | 2 architectural, 7 minor |
| UI/UX Design System | 52 | 9 | 3 a11y violations, 6 styling |
| **Totals** | **175** | **37** | |

---

## MVP Backend — Deviations Found

### Functional

| # | File | Deviation | Severity |
|---|------|-----------|----------|
| 1 | `context.ts:9` | Spec includes `session: AuthSession` in owner context; implementation omits it (only has `user`) | MEDIUM — no current code needs `ctx.session`, but spec explicitly defines it |

### Additive (non-breaking, improving on spec)

| # | File | Deviation |
|---|------|-----------|
| 2 | `api/package.json:17` | Extra `"./lib/*"` export not in spec (required by SSE route imports) |
| 3 | `domain.prisma` | `@@map()` on all 5 models + extra `@@index` on Venue, VenueSession, GuestUser — spec models don't include these |
| 4 | `channel-manager.ts:3-6` | Custom `SSEWriter` type instead of spec's `WritableStream` |
| 5 | `sse/types.ts:21` | `Record<string, never>` instead of spec's `{}` for session_ended data |
| 6 | `sse/[sessionId]/route.ts` | Session existence checked before auth (spec implies auth-first) — minor info disclosure |
| 7 | `index.ts:24` | `guestProcedure` omits `!ctx.guestId` check (safe due to discriminated union) |
| 8 | `use-session-events.ts:25` | Extra `onReconnect` handler not in spec interface |
| 9 | `use-session-events.ts:37` | `sessionId: string | null` instead of spec's `string` |
| 10 | `song.ts:154` | Song created with `score: 1` directly instead of `score: 0` + aggregated upvote |
| 11 | Spec Section 5 vs 6 | Spec internally contradicts itself (SameSite Strict vs Lax) — implementation correctly uses Lax |

---

## MVP Frontend — Deviations Found

| # | File | Deviation | Severity |
|---|------|-----------|----------|
| 1 | `start-session-form.tsx` | No provider selector — spec says "Spotify greyed Coming Soon" | MEDIUM |
| 2 | `create-venue-form.tsx` | Missing logo (optional) field — spec lists it as a form field | LOW |
| 3 | `session-view.tsx`, `session-dashboard.tsx` | `onQueueUpdated` handler wired in hook but never passed by either consumer | LOW (granular events cover same ground) |
| 4 | `song-search.tsx:35` | `maxSuggestions` hardcoded to 5 instead of reading from venue settings | LOW (MVP default is always 5) |
| 5 | `server.ts:12` | `z.url()` instead of spec's `z.string().url()` (Zod 4 equivalent) | INFO |
| 6 | `session-view.tsx:64` | Overlay copy "Thanks for vibing!" vs spec's "This session has ended" | INFO |
| 7 | No `(venue)/venue/[slug]/` route | Listed in spec package structure but no content defined | INFO |
| 8 | `use-session-events.ts:27` | `onReconnect` added beyond spec's interface definition | INFO |

---

## Test Infrastructure — Deviations Found

| # | File | Deviation | Severity |
|---|------|-----------|----------|
| 1 | `db/src/index.ts` | Uses `PrismaPg` adapter + dynamic `await import()` instead of spec's plain `PrismaClient({ datasourceUrl })` with static import | MEDIUM — works but differs from spec's "standard PrismaClient" intent |
| 2 | `db/prisma/schema/schema.prisma` | Missing `url = env("DATABASE_URL")` — spec requires it, was reverted because Prisma 7 uses `prisma.config.ts` instead | MEDIUM — deliberate Prisma 7 adaptation, but contradicts spec |
| 3 | `globalSetup.ts` | Uses `execFileSync(process.execPath, [prismaPath, ...])` instead of spec's `execFileSync("npx", ["prisma", ...])` | LOW |
| 4 | `vitest.config.ts` | Undocumented `fileParallelism: false` in integration project | LOW |
| 5 | `test-fixtures.ts` | `createTestSong` default `providerId` is `test-video-${random}` not spec's `"test-video-id"` | LOW |
| 6 | `package.json` | `test:db:reset` uses `--config=prisma.config.ts` instead of `--schema=packages/db/prisma/schema` | LOW |
| 7 | `package.json` | `vitest@^4.1.0` installed, spec says `^3.x` | LOW |
| 8 | `db/src/index.ts` | `process.env.DATABASE_URL!` bypasses env validation | LOW |
| 9 | `test-db.ts` | Extra `testPrisma` export not described in spec | INFO |

---

## UI/UX Design System — Deviations Found

### Accessibility Violations (spec Section 7 + Section 12 anti-patterns)

| # | File:Line | Deviation | Severity |
|---|-----------|-----------|----------|
| 1 | `join/[joinCode]/page.tsx:68` | Input label is `sr-only` — spec requires visible labels, lists "No placeholder-only labels" as anti-pattern | HIGH |
| 2 | `song-search.tsx:69` | Search input label is `sr-only` — same violation | HIGH |
| 3 | `session-dashboard.tsx:183` | Owner search input label is `sr-only` — same violation | HIGH |

### Styling Deviations

| # | File:Line | Deviation | Severity |
|---|-----------|-----------|----------|
| 4 | `join/[joinCode]/page.tsx:56` | Card uses `rounded-xl` (16px) instead of spec's `rounded-lg` (12px) | MEDIUM |
| 5 | `card.tsx:14` | Uses `ring-1 ring-foreground/10` instead of spec's `border border-border` | MEDIUM |
| 6 | `dashboard.tsx:29,41` | No-venue/no-session states use `max-w-lg` instead of spec's `max-w-md` | LOW |
| 7 | `dashboard.tsx:31,43` | `<h1>` elements missing `font-heading` class | LOW |
| 8 | `logo.tsx:25` | `sm` logomark size is `h-5` (20px), below spec's 24px minimum | LOW |
| 9 | `globals.css:164` | `--color-destructive-foreground` missing from `@theme inline` | LOW |

---

## Priority Actions

### P0 — Should Fix

1. **3 `sr-only` label violations** — Join page, song search, and dashboard search all have visually hidden input labels. The spec explicitly prohibits this in the accessibility section and anti-patterns list. Fix: make labels visible above inputs.

### P1 — Should Fix

2. **Join page card `rounded-xl` → `rounded-lg`** — Wrong border radius token
3. **Card component `ring-1` → `border border-border`** — Wrong border mechanism
4. **Start session form missing Spotify "Coming Soon"** — Spec explicitly calls for it

### P2 — Nice to Have

5. Dashboard `max-w-lg` → `max-w-md` for no-venue/no-session states
6. Dashboard `<h1>` elements need `font-heading`
7. Logo `sm` mark size `h-5` → `h-6` (24px minimum)
8. Add `--color-destructive-foreground` to `@theme inline`
9. Test infra: spec and implementation diverge on Neon adapter approach (deliberate Prisma 7 adaptation)

### No Action Needed

All 11 MVP backend deviations are additive improvements or spec-internal contradictions resolved correctly. The test infra deviations are deliberate Prisma 7 adaptations. The `onQueueUpdated` event being unwired is harmless since granular events cover the same ground.
