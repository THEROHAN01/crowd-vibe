# Test Infrastructure Design Spec — Code Review

**Date:** 2026-03-17
**Commit:** `2681a8d`
**File:** `docs/superpowers/specs/2026-03-17-crowdvibe-test-infra-design.md`

---

## Issues

### ISSUE-01: `resetDatabase()` truncation order missing Vote table cleanup of cascading data

**File:** Spec line 71
**Severity:** MEDIUM
**Description:** The spec says truncation order is `Vote → Song → GuestUser → VenueSession → Venue, then auth tables`. This is correct for foreign key dependencies. However, since the schema uses `onDelete: Cascade` on all relations, truncating just `Venue` would cascade-delete everything underneath. The explicit order is safer (doesn't rely on cascade behavior) but the spec should note that `$executeRawUnsafe('TRUNCATE ... CASCADE')` would be simpler and achieve the same result.

**Recommendation:** Consider using `TRUNCATE venue, venue_session, guest_user, song, vote CASCADE` as a single statement. It's faster (one round-trip) and PostgreSQL handles the ordering.

---

### ISSUE-02: Integration tests for `queue-helpers.ts` (`advanceQueue`) are missing from coverage plan

**File:** Spec line 155-163
**Severity:** MEDIUM
**Description:** `advanceQueue` is the most critical shared function — it handles the race-condition-prone queue advancement with a `$transaction`. The coverage plan tests it indirectly via `queue.next`, `queue.skip`, and `vote.cast` auto-skip, but there's no direct test for:
- Two concurrent `advanceQueue` calls on the same session (the actual race condition it prevents)
- `advanceQueue` when no songs are queued (should broadcast `now_playing: null`)
- `advanceQueue` when no song is currently playing (the `updateMany` matches 0 rows)

**Recommendation:** Add `queue-helpers.integration.test.ts` to the file map, or explicitly note these scenarios under the `queue` router integration tests.

---

### ISSUE-03: No test for the guest join route handler (`/api/guest/join`)

**File:** Spec line 155-163
**Severity:** MEDIUM
**Description:** The guest join route (`apps/web/src/app/api/guest/join/route.ts`) is a raw Next.js route handler, not a tRPC router. It handles HMAC cookie signing, rate limiting, fingerprint-based upsert, and is the only public HTTP endpoint. It's not covered by any integration test in the plan.

Testing it would require either:
- A lightweight HTTP test (using `next/test-utils` or constructing a `NextRequest`)
- Or extracting the logic into a testable function and testing that

**Recommendation:** Add `guest-join.integration.test.ts` to the file map. Even a simple test that constructs a `NextRequest` and calls the `POST` handler directly would catch regressions.

---

### ISSUE-04: YouTube provider unit test — `search` and `getTrack` mock approach not specified

**File:** Spec line 150
**Severity:** LOW
**Description:** The spec says to mock `global.fetch` with `vi.fn()` for YouTube tests, but doesn't specify whether to use `vi.stubGlobal('fetch', ...)` or `vi.spyOn(globalThis, 'fetch')`. The latter is preferable because it auto-restores in `afterEach`, preventing test pollution.

**Recommendation:** Note `vi.spyOn(globalThis, 'fetch')` as the approach. Minor detail.

---

### ISSUE-05: `dotenv-cli` used for `test:db:reset` script but not for `test:integration`

**File:** Spec line 179
**Severity:** LOW
**Description:** The `test:db:reset` script uses `dotenv -e .env.test --` to load env vars, but `test:integration` just runs `vitest run --project integration`. The integration tests need `DATABASE_URL` from `.env.test` to connect. This should either:
- Use `dotenv -e .env.test -- vitest run --project integration`
- Or be handled by Vitest's `globalSetup.ts` loading `.env.test` via `dotenv/config`

The spec mentions `globalSetup.ts` runs `prisma db push` but doesn't say it loads `.env.test`. If globalSetup loads it, the tests inherit the env. But this should be explicit.

**Recommendation:** Clarify how `.env.test` is loaded for the integration test suite — either in the npm script or in `globalSetup.ts`.

---

## What's Done Well

- **Two-project Vitest workspace** — clean separation between fast unit tests and DB-dependent integration tests. Good DX.
- **Caller factories** — `createOwnerCaller` / `createGuestCaller` using `t.createCallerFactory` means tests call routers directly without HTTP. Fast and accurate.
- **Fixture factories** — composable, override-friendly. Standard pattern.
- **Docker test DB on port 5433** — avoids conflict with local dev DB. No volume (ephemeral). Clean.
- **Test coverage plan** — comprehensive for an MVP. Covers the critical paths (vote transactions, suggestion limits, queue advancement).
- **Co-located tests** — `*.test.ts` next to source files. Good discoverability.

---

## Summary

| ID | Severity | Status |
|----|----------|--------|
| ISSUE-01 | MEDIUM | Consider `TRUNCATE ... CASCADE` instead of ordered truncation |
| ISSUE-02 | MEDIUM | `advanceQueue` not directly tested — critical shared function |
| ISSUE-03 | MEDIUM | Guest join route handler not in test coverage plan |
| ISSUE-04 | LOW | YouTube mock approach not specified (`vi.spyOn` preferred) |
| ISSUE-05 | LOW | `.env.test` loading strategy for integration tests unclear |

**Verdict:** Well-structured test design. The three MEDIUM items are coverage gaps — `advanceQueue` direct testing, guest join route testing, and truncation strategy. The architecture (workspace, callers, fixtures) is solid.
