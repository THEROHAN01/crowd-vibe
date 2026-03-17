# Task 2: Database Schema — Code Review

**Date:** 2026-03-17
**Commit:** `1b65fb6`
**Files changed:** `packages/db/prisma/schema/domain.prisma` (created), `packages/db/prisma/schema/auth.prisma` (modified)

---

## Issues

No issues found.

---

## Verification

- `domain.prisma`: All 5 models (Venue, VenueSession, GuestUser, Song, Vote) match the plan exactly.
- Indexes: `@@index([ownerId])` on Venue, `@@index([venueId])` and `@@index([isActive])` on VenueSession, `@@index([sessionId])` on GuestUser, `@@index([sessionId, status, score])` on Song — all present and correct.
- Unique constraints: `@@unique([sessionId, fingerprint])` on GuestUser, `@@unique([songId, guestId])` on Vote — present.
- Cascade deletes: Venue→VenueSession, VenueSession→Song, VenueSession→GuestUser, Song→Vote, GuestUser→Vote all have `onDelete: Cascade`. Song→GuestUser (suggestedBy) has `onDelete: SetNull`. Correct.
- `@@map()` on all models for snake_case table names. Good.
- `auth.prisma`: `venues Venue[]` added after `accounts Account[]` on User model. Correct placement.

**Verdict:** Clean commit. Matches plan and spec exactly.
