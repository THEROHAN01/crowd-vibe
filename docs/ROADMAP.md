# CrowdVibe — Product Roadmap

> Last updated: 2026-06-07  
> Status key: ✅ Done · 🔧 In Progress · 📋 Planned · 💡 Future

---

## Phase 0 — Foundation (Complete)

Core infrastructure and the end-to-end happy path.

| Item | Status | Notes |
|---|---|---|
| Monorepo structure (apps/web, packages/*) | ✅ | npm workspaces |
| Prisma schema (Venue, VenueSession, Song, Vote, GuestUser) | ✅ | Multi-file schema |
| Better-Auth owner auth (email/password + Google OAuth) | ✅ | |
| Guest auth (fingerprint + HMAC-signed cookie) | ✅ | No account required |
| tRPC API layer (venue, session, song, queue, vote, guest routers) | ✅ | |
| SSE realtime channel manager (7 event types) | ✅ | Debounced, max 100 subscribers |
| YouTube music search + server-side cache | ✅ | 15min TTL, 500 entries |
| Queue state machine (queued → playing → played/skipped) | ✅ | Atomic via Prisma $transaction |
| Voting with auto-skip (score ≤ −3) | ✅ | Configurable threshold |
| Guest session UI (queue, now-playing, vote, search) | ✅ | |
| Owner dashboard (queue manager, YouTube player, stats) | ✅ | |
| Landing page | ✅ | |
| Unit + integration test suite | ✅ | 13 test files |

---

## Phase 1 — Stability & Polish (Current Sprint)

Fix breaking UI issues identified in the June 2026 audit before any new feature work.

| Item | Status | Priority | Issue Ref |
|---|---|---|---|
| Owner dashboard search: add loading + error states | 📋 | P1 | ui-breaking-001 |
| Owner dashboard queue/stats/now-playing: add error handling | 📋 | P1 | ui-breaking-002 |
| Owner dashboard: guard for ended/non-existent sessions | 📋 | P1 | ui-breaking-010 |
| Guest session view: add React Error Boundary | 📋 | P1 | ui-breaking-008 |
| Queue: show loading skeleton instead of empty state | 📋 | P2 | ui-breaking-003 |
| Guest suggest song: add onError toast handler | 📋 | P2 | ui-breaking-004 |
| Vote buttons: add optimistic updates | 📋 | P2 | ui-breaking-009 |
| Add song button: disable + show spinner while pending | 📋 | P2 | ui-breaking-007 |
| SSE disconnection: surface connection status to users | 📋 | P2 | ui-breaking-005 |
| Song thumbnails: add onError fallback image | 📋 | P2 | ui-breaking-006 |
| Fix existing audit issues (schema, indexes, perf) | 📋 | P2 | audit-001 → perf-020 |

---

## Phase 2 — Venue Owner Experience

Tools that give venue owners more control and insight.

| Item | Status | Priority | Notes |
|---|---|---|---|
| Venue settings admin UI | 📋 | P1 | Edit max suggestions, cooldown, skip threshold, explicit content — schema exists, no UI |
| Session history page | 📋 | P2 | View past sessions, songs played, peak listener count |
| Manual queue reorder (drag-and-drop) | 📋 | P2 | Override crowd vote ordering |
| Blacklist / block specific songs or artists | 📋 | P2 | Venue-level content control |
| QR code customisation (logo, colors) | 📋 | P3 | Branded guest join experience |
| Multiple venues per owner | 📋 | P2 | Already supported in schema, needs dashboard switcher |
| Session scheduling (start at time X) | 💡 | P3 | |

---

## Phase 3 — Guest Experience

Features that improve guest engagement and delight.

| Item | Status | Priority | Notes |
|---|---|---|---|
| Guest display names | 📋 | P2 | Optional nickname at join — `displayName` already in schema |
| Song deduplification warning | 📋 | P2 | Warn guest if song is already in queue before suggesting |
| Guest suggestion history | 📋 | P3 | Show which songs a guest has suggested in session |
| Reaction emojis on now-playing | 💡 | P3 | Lightweight engagement layer |
| Guest leaderboard (top voters) | 💡 | P3 | Gamification |
| Progressive Web App (PWA) | 📋 | P2 | Install prompt, offline fallback page |

---

## Phase 4 — Music Provider Expansion

| Item | Status | Priority | Notes |
|---|---|---|---|
| Spotify search + playback | 📋 | P1 | Provider stub exists, needs OAuth + API implementation |
| Apple Music integration | 💡 | P3 | |
| SoundCloud integration | 💡 | P3 | |
| Provider fallback (YouTube → Spotify for same track) | 💡 | P3 | |
| Explicit content filtering (allowExplicitContent setting) | 📋 | P2 | Setting exists, enforcement not wired |

---

## Phase 5 — Monetisation

| Item | Status | Priority | Notes |
|---|---|---|---|
| Polar payments integration | 📋 | P1 | Config present, no checkout UI |
| Free tier limits enforcement | 📋 | P1 | No limits currently enforced |
| Pro plan (unlimited sessions, venues, Spotify, analytics) | 📋 | P2 | Define tier boundaries |
| Venue subscription management page | 📋 | P2 | Upgrade, cancel, billing history |
| Usage dashboard for owners | 📋 | P3 | Sessions used, songs played, guests served |

---

## Phase 6 — Scale & Reliability

| Item | Status | Priority | Notes |
|---|---|---|---|
| Redis-backed rate limiting | 📋 | P1 | Current in-memory limiter resets on deploy |
| SSE reconnect state replay | 📋 | P2 | Clients miss events during reconnect window |
| Database connection pooling (PgBouncer / Neon pooled URL) | 📋 | P2 | Required at scale |
| CDN-cached YouTube thumbnail proxying | 📋 | P3 | Avoid broken images, improve load time |
| Horizontal SSE scaling (Redis pub/sub) | 💡 | P3 | Current channel manager is single-process only |
| Observability (Sentry, OpenTelemetry) | 📋 | P2 | No error tracking currently |
| Load testing session with 100+ concurrent guests | 📋 | P2 | Validate SSE at scale before launch |

---

## Phase 7 — Platform Expansion

| Item | Status | Priority | Notes |
|---|---|---|---|
| Native mobile apps (React Native) | 💡 | P3 | |
| Venue kiosk mode (TV display, read-only) | 💡 | P3 | Show now-playing + queue on venue screen |
| API for third-party integrations | 💡 | P3 | Let venues build custom clients |
| Webhook support (song played, session ended events) | 💡 | P3 | |

---

## Known Stubs / Tech Debt

| Item | Notes |
|---|---|
| Spotify provider | All methods throw — `packages/api/src/music/providers/spotify.ts` |
| Polar payments UI | Config in `packages/auth/src/index.ts`, no user-facing flow |
| Rate limiter reset on deploy | In-memory only — `packages/api/src/lib/rate-limiter.ts` |
| No React Error Boundaries | Session views can white-screen on unhandled errors |
| SSE no reconnect replay | Clients refetch on reconnect but miss events during gap |
